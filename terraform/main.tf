terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  frontend_build_dir = abspath("${path.module}/${var.frontend_build_dir}")
  frontend_files     = fileset(local.frontend_build_dir, "**")

  frontend_content_types = {
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
}

resource "terraform_data" "frontend_build_check" {
  input = local.frontend_build_dir

  lifecycle {
    precondition {
      condition     = length(local.frontend_files) > 0
      error_message = "No frontend build files found in ${local.frontend_build_dir}. Build the Vite app first so frontend/dist contains index.html and asset files."
    }
  }
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

resource "aws_s3_bucket" "frontend_website" {
  bucket = var.frontend_bucket_name

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

resource "aws_s3_bucket_public_access_block" "frontend_website" {
  bucket = aws_s3_bucket.frontend_website.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
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

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend_website" {
  bucket = aws_s3_bucket.frontend_website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_website_configuration" "frontend_website" {
  bucket = aws_s3_bucket.frontend_website.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "frontend_website_public_read" {
  bucket = aws_s3_bucket.frontend_website.id

  depends_on = [
    aws_s3_bucket_public_access_block.frontend_website
  ]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadWebsiteAssets"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend_website.arn}/*"
      }
    ]
  })
}

# ---------------------------------------------------------
# S3 Bucket CORS Configuration
# ---------------------------------------------------------

resource "aws_s3_bucket_cors_configuration" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}


# ---------------------------------------------------------
# Upload building-index.json
# ---------------------------------------------------------

resource "aws_s3_object" "building_index" {
  bucket = aws_s3_bucket.building_data.id
  key    = "building-index.json"
  source = "${path.module}/../building-data/building-index.json"

  etag = filemd5(
    "${path.module}/../building-data/building-index.json"
  )

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

resource "aws_s3_object" "frontend_assets" {
  for_each = {
    for file in local.frontend_files : file => file
    if !endswith(file, "/")
  }

  depends_on = [terraform_data.frontend_build_check]

  bucket = aws_s3_bucket.frontend_website.id
  key    = each.value
  source = "${local.frontend_build_dir}/${each.value}"
  etag   = filemd5("${local.frontend_build_dir}/${each.value}")

  content_type = lookup(
    local.frontend_content_types,
    lower(element(reverse(split(".", each.value)), 0)),
    "application/octet-stream"
  )
}

# ---------------------------------------------------------
# IAM Role Configuration
# ---------------------------------------------------------

# Learner Lab Role (Data Source)
data "aws_iam_role" "lab_role" {
  count = var.is_learner_lab ? 1 : 0
  name  = var.lab_role_name
}

# Custom Role (Real AWS Account)
resource "aws_iam_role" "lambda_exec_role" {
  count = var.is_learner_lab ? 0 : 1
  name  = "${var.project_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count      = var.is_learner_lab ? 0 : 1
  role       = aws_iam_role.lambda_exec_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "s3_read" {
  count       = var.is_learner_lab ? 0 : 1
  name        = "${var.project_name}-s3-read-${var.environment}"
  description = "Allow Lambda to read from building data S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Effect = "Allow"
        Resource = [
          aws_s3_bucket.building_data.arn,
          "${aws_s3_bucket.building_data.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_read_attach" {
  count      = var.is_learner_lab ? 0 : 1
  role       = aws_iam_role.lambda_exec_role[0].name
  policy_arn = aws_iam_policy.s3_read[0].arn
}

# ---------------------------------------------------------
# Lambda Package
# ---------------------------------------------------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/lambda.zip"

  excludes = [
    "venv",
    "__pycache__",
    ".pytest_cache",
    "test_local.py"
  ]
}

# ---------------------------------------------------------
# Lambda Function
# ---------------------------------------------------------

resource "aws_lambda_function" "building_api" {
  function_name    = "${var.project_name}-building-api-${var.environment}"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.lambda_handler"
  role             = var.is_learner_lab ? data.aws_iam_role.lab_role[0].arn : aws_iam_role.lambda_exec_role[0].arn

  timeout     = 10
  memory_size = 256

  environment {
    variables = {
      BUCKET_NAME    = aws_s3_bucket.building_data.id
      BUILDINGS_FILE = "building-index.json"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# ---------------------------------------------------------
# API Gateway HTTP API
# ---------------------------------------------------------

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-http-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 300
  }
}

# ---------------------------------------------------------
# Default Stage
# ---------------------------------------------------------

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# ---------------------------------------------------------
# Lambda Integration
# ---------------------------------------------------------

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.building_api.arn
  payload_format_version = "2.0"
}

# ---------------------------------------------------------
# GET /api/v1/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}
# ---------------------------------------------------------

resource "aws_apigatewayv2_route" "get_room_info" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /api/v1/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# ---------------------------------------------------------
# GET /api/v1/buildings/{buildingId}/floors/{floorId}/facilities/{facilityId}
# ---------------------------------------------------------

resource "aws_apigatewayv2_route" "get_facility_info" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /api/v1/buildings/{buildingId}/floors/{floorId}/facilities/{facilityId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}


# GET /api/v1/buildings
resource "aws_apigatewayv2_route" "get_buildings" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /api/v1/buildings"

  target = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# GET /api/v1/buildings/{buildingId}
resource "aws_apigatewayv2_route" "get_building_by_id" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /api/v1/buildings/{buildingId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "get_floor_by_id" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /api/v1/buildings/{buildingId}/floors/{floorId}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.building_api.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# ---------------------------------------------------------
# API URL
# ---------------------------------------------------------

output "api_url" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}
