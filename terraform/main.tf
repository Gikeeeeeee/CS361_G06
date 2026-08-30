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

# ---------------------------------------------------------
# Lambda & API Gateway Setup
# AWS Academy IAM LabRole
# ---------------------------------------------------------

data "aws_iam_role" "lab_role" {
  name = var.iam_role_name
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
  role             = data.aws_iam_role.lab_role.arn

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