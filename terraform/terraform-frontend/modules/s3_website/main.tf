# CS361_G06/terraform/frontend/modules/s3_website/main.tf

locals {
  content_types = {
    css   = "text/css"
    gif   = "image/gif"
    htm   = "text/html"
    html  = "text/html"
    ico   = "image/x-icon"
    jpeg  = "image/jpeg"
    jpg   = "image/jpeg"
    js    = "application/javascript"
    json  = "application/json"
    png   = "image/png"
    svg   = "image/svg+xml"
    txt   = "text/plain"
    webp  = "image/webp"
    woff  = "font/woff"
    woff2 = "font/woff2"
  }

  build_dir = abspath(var.frontend_build_dir)
  files     = fileset(local.build_dir, "**")
}

resource "terraform_data" "frontend_build_check" {
  input = local.build_dir

  lifecycle {
    precondition {
      condition     = length(local.files) > 0
      error_message = "No frontend build files found in ${local.build_dir}. Run the frontend build first."
    }
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

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_website_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket = aws_s3_bucket.this.id

  depends_on = [
    aws_s3_bucket_public_access_block.this
  ]

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid       = "PublicReadWebsiteAssets"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"

        Resource = "${aws_s3_bucket.this.arn}/*"
      }
    ]
  })
}

resource "aws_s3_object" "frontend_files" {
  for_each = {
    for file in local.files : file => file
    if !endswith(file, "/")
  }

  depends_on = [
    terraform_data.frontend_build_check
  ]

  bucket = aws_s3_bucket.this.id

  key    = each.value
  source = "${local.build_dir}/${each.value}"

  etag = filemd5("${local.build_dir}/${each.value}")

  content_type = lookup(
    local.content_types,
    lower(element(reverse(split(".", each.value)), 0)),
    "application/octet-stream"
  )
}