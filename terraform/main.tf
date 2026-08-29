terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------
# S3 Bucket
# ---------------------------------------------------------

resource "aws_s3_bucket" "building_data" {
  bucket = var.bucket_name

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------
# Block all public access
# ---------------------------------------------------------

resource "aws_s3_bucket_public_access_block" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------
# Enable versioning
# ---------------------------------------------------------

resource "aws_s3_bucket_versioning" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ---------------------------------------------------------
# Server-side encryption
# ---------------------------------------------------------

resource "aws_s3_bucket_server_side_encryption_configuration" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ---------------------------------------------------------
# Upload building-index.json
# ---------------------------------------------------------

resource "aws_s3_object" "building_index" {
  bucket = aws_s3_bucket.building_data.id
  key    = "building-index.json"
  source = "${path.module}/../building-data/building-index.json"

  etag = filemd5("${path.module}/../building-data/building-index.json")

  content_type = "application/json"
}

# ---------------------------------------------------------
# Upload building JSON files
# ---------------------------------------------------------

resource "aws_s3_object" "building_files" {
  for_each = fileset(
    "${path.module}/../building-data/building",
    "*.json"
  )

  bucket = aws_s3_bucket.building_data.id
  key    = "building/${each.value}"
  source = "${path.module}/../building-data/building/${each.value}"

  etag = filemd5(
    "${path.module}/../building-data/building/${each.value}"
  )

  content_type = "application/json"
}

# ---------------------------------------------------------
# Upload floor plan SVG files
# ---------------------------------------------------------

resource "aws_s3_object" "floor_plans" {
  for_each = fileset(
    "${path.module}/../building-data/floor-plan",
    "**/*.svg"
  )

  bucket = aws_s3_bucket.building_data.id
  key    = "floor-plan/${each.value}"
  source = "${path.module}/../building-data/floor-plan/${each.value}"

  etag = filemd5(
    "${path.module}/../building-data/floor-plan/${each.value}"
  )

  content_type = "image/svg+xml"
}   