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

# ---------------------------------------------------------------------------
# Default VPC
# ---------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

# ---------------------------------------------------------------------------
# S3 Storage
#
# Previously: modules/storage/main.tf
# Now managed directly by the root module.
# ---------------------------------------------------------------------------

locals {
  building_data_dir = abspath("${path.module}/../../building-data")
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

resource "aws_s3_bucket" "building_data" {
  bucket = var.bucket_name

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "building_data" {
  bucket = aws_s3_bucket.building_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

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

resource "aws_s3_object" "building_index" {
  bucket = aws_s3_bucket.building_data.id

  key    = "building-index.json"
  source = "${local.building_data_dir}/building-index.json"

  etag = filemd5("${local.building_data_dir}/building-index.json")

  content_type = "application/json"
}

resource "aws_s3_object" "building_files" {
  for_each = fileset(local.building_dir, "*.json")

  bucket = aws_s3_bucket.building_data.id

  key    = "building/${each.value}"
  source = "${local.building_dir}/${each.value}"

  etag = filemd5("${local.building_dir}/${each.value}")

  content_type = "application/json"
}

resource "aws_s3_object" "floor_plans" {
  for_each = fileset(local.floor_plan_dir, "**/*.svg")

  bucket = aws_s3_bucket.building_data.id

  key    = "floor-plan/${each.value}"
  source = "${local.floor_plan_dir}/${each.value}"

  etag = filemd5("${local.floor_plan_dir}/${each.value}")

  content_type = "image/svg+xml"
}

resource "aws_s3_object" "images" {
  for_each = {
    for file in fileset(local.image_dir, "**/*") :
    file => file
    if !endswith(file, "/")
  }

  bucket = aws_s3_bucket.building_data.id

  key    = "image/${each.value}"
  source = "${local.image_dir}/${each.value}"

  etag = filemd5("${local.image_dir}/${each.value}")

  content_type = lookup(
    local.image_content_types,
    lower(element(reverse(split(".", each.value)), 0)),
    "application/octet-stream"
  )
}

# ---------------------------------------------------------------------------
# Existing shared DynamoDB
# ---------------------------------------------------------------------------

module "dynamodb" {
  source = "./modules/dynamodb"

  table_name = var.dynamodb_table_name
}

# ---------------------------------------------------------------------------
# OpenSearch Serverless
# ---------------------------------------------------------------------------

module "opensearch" {
  source = "./modules/opensearch"

  project_name    = var.project_name
  environment     = var.environment
  collection_name = var.opensearch_collection_name

}

# ---------------------------------------------------------------------------
# API + Indexer Lambda
# ---------------------------------------------------------------------------

module "lambda" {
  source = "./modules/lambda"

  project_name = var.project_name
  environment  = var.environment

  source_dir = "${path.module}/../../backend"

  # S3
  bucket_name    = aws_s3_bucket.building_data.bucket
  bucket_arn     = aws_s3_bucket.building_data.arn
  buildings_file = "building-index.json"

  # DynamoDB
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  dynamodb_stream_arn = module.dynamodb.stream_arn

  # OpenSearch
  opensearch_collection_arn = module.opensearch.collection_arn
  opensearch_endpoint       = module.opensearch.collection_endpoint
  opensearch_index          = var.opensearch_index

}

# ---------------------------------------------------------------------------
# OpenSearch Serverless Data Access Policy
# ---------------------------------------------------------------------------

resource "aws_opensearchserverless_access_policy" "lambda" {
  name = "cs361-os-lambda-dev"
  type = "data"

  policy = jsonencode([
    {
      Rules = [
        {
          ResourceType = "collection"

          Resource = [
            "collection/${module.opensearch.collection_name}"
          ]

          Permission = [
            "aoss:DescribeCollectionItems"
          ]
        },
        {
          ResourceType = "index"

          Resource = [
            "index/${module.opensearch.collection_name}/${var.opensearch_index}"
          ]

          Permission = [
            "aoss:CreateIndex",
            "aoss:DeleteIndex",
            "aoss:UpdateIndex",
            "aoss:DescribeIndex",
            "aoss:ReadDocument",
            "aoss:WriteDocument"
          ]
        }
      ]

      Principal = [
        module.lambda.lambda_role_arn,
        module.lambda.indexer_role_arn
      ]
    }
  ])

  depends_on = [
    module.opensearch,
    module.lambda
  ]
}

# ---------------------------------------------------------------------------
# API Gateway
#
# Previously: modules/api_gateway/main.tf
# Now managed directly by the root module.
# ---------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-http-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]

    allow_methods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ]

    allow_headers = ["*"]

    max_age = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.this.id

  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.this.id

  integration_type = "AWS_PROXY"
  integration_uri  = module.lambda.invoke_arn

  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_buildings" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/buildings"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_building" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/buildings/{buildingId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_floor" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/floors/{floorId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_room" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/rooms/{roomId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_facility" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/facilities/{facilityId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_room_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/rooms/{roomId}/schedules"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_room_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "POST /api/v1/rooms/{roomId}/schedules"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "put_schedule" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "PUT /api/v1/rooms/{roomId}/schedules/{scheduleId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "delete_schedule" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "DELETE /api/v1/rooms/{roomId}/schedules/{scheduleId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "$default"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "search" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v2/search"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id = "AllowAPIGatewayInvoke"

  action = "lambda:InvokeFunction"

  function_name = module.lambda.function_name

  principal = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}