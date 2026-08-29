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

# ---------------------------------------------------------
# Lambda & API Gateway Setup (Added)
# ---------------------------------------------------------

data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/lambda_function.zip"
  
  excludes = [
    "venv",
    "__pycache__",
    ".pytest_cache",
    "test_local.py"
  ]
}

resource "aws_lambda_function" "building_api" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "cs361-building-api"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      bucket_name    = aws_s3_bucket.building_data.id
      BUILDINGS_FILE = "building-index.json"
    }
  }
}

resource "aws_apigatewayv2_api" "lambda_api" {
  name          = "cs361-http-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.lambda_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.lambda_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.building_api.invoke_arn
}

resource "aws_apigatewayv2_route" "get_buildings" {
  api_id    = aws_apigatewayv2_api.lambda_api.id
  route_key = "GET /buildings"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.building_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lambda_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "get_building_api_v1" {
  api_id    = aws_apigatewayv2_api.lambda_api.id
  route_key = "GET /api/v1/buildings"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

output "api_url" {
  value = aws_apigatewayv2_api.lambda_api.api_endpoint
}