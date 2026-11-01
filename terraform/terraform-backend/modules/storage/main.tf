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

  asset_cache_control = "public, max-age=86400"
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

  content_type  = "image/svg+xml"
  cache_control = local.asset_cache_control
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
  cache_control = local.asset_cache_control
}

# ---------------------------------------------------------------------------
# CloudFront CDN for floor plans and images
# The bucket stays private; only this distribution can read it (OAC).
# ---------------------------------------------------------------------------

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# The frontend fetch()es floor-plan SVGs cross-origin, so CORS headers are needed.
data "aws_cloudfront_response_headers_policy" "simple_cors" {
  name = "Managed-SimpleCORS"
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "assets" {
  enabled     = true
  comment     = "${var.project_name} ${var.environment} media assets"
  price_class = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = "s3-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-assets"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.simple_cors.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Only media prefixes are served; JSON data stays readable by Lambda only.
resource "aws_s3_bucket_policy" "cloudfront_read" {
  bucket = aws_s3_bucket.this.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid       = "CloudFrontReadAssets"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource = [
          "${aws_s3_bucket.this.arn}/floor-plan/*",
          "${aws_s3_bucket.this.arn}/image/*",
        ]
        Condition = {
          StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.assets.arn }
        }
      }
    ]
  })
}
