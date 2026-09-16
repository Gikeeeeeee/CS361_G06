# CS361_G06/terraform/backend/modules/storage/main.tf

locals {
  building_data_dir = abspath("${path.module}/../../../../building-data")
  building_dir      = "${local.building_data_dir}/building"
  floor_plan_dir    = "${local.building_data_dir}/floor-plan"
  image_dir         = "${local.building_data_dir}/image"

  image_content_types = {
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    png  = "image/png"
    gif  = "image/gif"
    webp = "image/webp"
    svg  = "image/svg+xml"
  }
}

resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ---------------------------------------------------------------------------
# Building index
# ---------------------------------------------------------------------------

resource "aws_s3_object" "building_index" {
  bucket = aws_s3_bucket.this.id

  key    = "building-index.json"
  source = "${local.building_data_dir}/building-index.json"

  etag = filemd5("${local.building_data_dir}/building-index.json")

  content_type = "application/json"
}

# ---------------------------------------------------------------------------
# Building JSON files
# S3:
#   building/LC3.json
#   building/LC4.json
# ---------------------------------------------------------------------------

resource "aws_s3_object" "building_files" {
  for_each = fileset(local.building_dir, "*.json")

  bucket = aws_s3_bucket.this.id

  key    = "building/${each.value}"
  source = "${local.building_dir}/${each.value}"

  etag = filemd5("${local.building_dir}/${each.value}")

  content_type = "application/json"
}

# ---------------------------------------------------------------------------
# Floor plan SVG files
# S3:
#   floor-plan/<relative-path>.svg
# ---------------------------------------------------------------------------

resource "aws_s3_object" "floor_plans" {
  for_each = fileset(local.floor_plan_dir, "**/*.svg")

  bucket = aws_s3_bucket.this.id

  key    = "floor-plan/${each.value}"
  source = "${local.floor_plan_dir}/${each.value}"

  etag = filemd5("${local.floor_plan_dir}/${each.value}")

  content_type = "image/svg+xml"
}

# ---------------------------------------------------------------------------
# Image assets
#
# Local:
#   building-data/image/building/LC3.webp
#   building-data/image/building/LC4.webp
#   building-data/image/room/CLASSROOM.webp
#   ...
#
# S3:
#   image/building/LC3.webp
#   image/building/LC4.webp
#   image/room/CLASSROOM.webp
#   ...
# ---------------------------------------------------------------------------

resource "aws_s3_object" "images" {
  for_each = {
    for file in fileset(local.image_dir, "**/*") :
    file => file
    if !endswith(file, "/")
  }

  bucket = aws_s3_bucket.this.id

  key    = "image/${each.value}"
  source = "${local.image_dir}/${each.value}"

  etag = filemd5("${local.image_dir}/${each.value}")

  content_type = lookup(
    local.image_content_types,
    lower(element(reverse(split(".", each.value)), 0)),
    "application/octet-stream"
  )
}