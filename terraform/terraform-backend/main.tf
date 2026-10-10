
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

# ===========================================================================
# State migration
# ===========================================================================
# Previous resources were managed directly by the root module.
# These moved blocks change only the Terraform state address so that the
# existing AWS resources are now managed by child modules.

# ---------------------------------------------------------------------------
# S3 -> module.storage
# ---------------------------------------------------------------------------

moved {
  from = aws_s3_bucket.building_data
  to   = module.storage.aws_s3_bucket.this
}

moved {
  from = aws_s3_bucket_public_access_block.building_data
  to   = module.storage.aws_s3_bucket_public_access_block.this
}

moved {
  from = aws_s3_bucket_versioning.building_data
  to   = module.storage.aws_s3_bucket_versioning.this
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.building_data
  to   = module.storage.aws_s3_bucket_server_side_encryption_configuration.this
}

moved {
  from = aws_s3_bucket_cors_configuration.building_data
  to   = module.storage.aws_s3_bucket_cors_configuration.this
}

moved {
  from = aws_s3_object.building_index
  to   = module.storage.aws_s3_object.building_index
}

moved {
  from = aws_s3_object.building_files
  to   = module.storage.aws_s3_object.building_files
}

moved {
  from = aws_s3_object.floor_plans
  to   = module.storage.aws_s3_object.floor_plans
}

moved {
  from = aws_s3_object.images
  to   = module.storage.aws_s3_object.images
}

# ---------------------------------------------------------------------------
# API Gateway -> module.api_gateway
# ---------------------------------------------------------------------------

moved {
  from = aws_apigatewayv2_api.this
  to   = module.api_gateway.aws_apigatewayv2_api.this
}

moved {
  from = aws_apigatewayv2_stage.default
  to   = module.api_gateway.aws_apigatewayv2_stage.default
}

moved {
  from = aws_apigatewayv2_integration.lambda
  to   = module.api_gateway.aws_apigatewayv2_integration.lambda
}

moved {
  from = aws_apigatewayv2_route.get_buildings
  to   = module.api_gateway.aws_apigatewayv2_route.get_buildings
}

moved {
  from = aws_apigatewayv2_route.get_building
  to   = module.api_gateway.aws_apigatewayv2_route.get_building
}

moved {
  from = aws_apigatewayv2_route.get_floor
  to   = module.api_gateway.aws_apigatewayv2_route.get_floor
}

moved {
  from = aws_apigatewayv2_route.get_room
  to   = module.api_gateway.aws_apigatewayv2_route.get_room
}

moved {
  from = aws_apigatewayv2_route.get_facility
  to   = module.api_gateway.aws_apigatewayv2_route.get_facility
}

moved {
  from = aws_apigatewayv2_route.get_room_schedules
  to   = module.api_gateway.aws_apigatewayv2_route.get_room_schedules
}

moved {
  from = aws_apigatewayv2_route.post_room_schedules
  to   = module.api_gateway.aws_apigatewayv2_route.post_room_schedules
}

moved {
  from = aws_apigatewayv2_route.put_schedule
  to   = module.api_gateway.aws_apigatewayv2_route.put_schedule
}

moved {
  from = aws_apigatewayv2_route.delete_schedule
  to   = module.api_gateway.aws_apigatewayv2_route.delete_schedule
}

moved {
  from = aws_apigatewayv2_route.default
  to   = module.api_gateway.aws_apigatewayv2_route.default
}

moved {
  from = aws_apigatewayv2_route.search
  to   = module.api_gateway.aws_apigatewayv2_route.search
}

moved {
  from = aws_lambda_permission.api_gateway
  to   = module.api_gateway.aws_lambda_permission.api_gateway
}

# ---------------------------------------------------------------------------
# OpenSearch access policy -> module.lambda
# ---------------------------------------------------------------------------

moved {
  from = aws_opensearchserverless_access_policy.lambda
  to   = module.lambda.aws_opensearchserverless_access_policy.lambda
}

# ===========================================================================
# Modules
# ===========================================================================

module "storage" {
  source = "./modules/storage"

  bucket_name  = var.bucket_name
  project_name = var.project_name
  environment  = var.environment
}

module "dynamodb" {
  source = "./modules/dynamodb"

  table_name = var.dynamodb_table_name
}

module "opensearch" {
  source = "./modules/opensearch"

  project_name    = var.project_name
  environment     = var.environment
  collection_name = var.opensearch_collection_name
}

module "lambda" {
  source = "./modules/lambda"

  project_name = var.project_name
  environment  = var.environment

  source_dir = "${path.module}/../../backend"

  # S3
  bucket_name    = module.storage.bucket_name
  bucket_arn     = module.storage.bucket_arn
  buildings_file = "building-index.json"

  # DynamoDB
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  dynamodb_stream_arn = module.dynamodb.stream_arn

  # OpenSearch
  opensearch_collection_arn  = module.opensearch.collection_arn
  opensearch_collection_name = module.opensearch.collection_name
  opensearch_endpoint        = module.opensearch.collection_endpoint
  opensearch_index           = var.opensearch_index
}

module "api_gateway" {
  source = "./modules/api_gateway"

  project_name         = var.project_name
  environment          = var.environment
  lambda_function_name = module.lambda.function_name
  lambda_invoke_arn    = module.lambda.invoke_arn
}