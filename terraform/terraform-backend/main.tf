terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket = "cs361-g06-terraform-state"
    key    = "terraform/backend/terraform.tfstate"
    region = "us-east-1"
  }

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
# Existing shared DynamoDB table
# ---------------------------------------------------------------------------

module "dynamodb" {
  source = "./modules/dynamodb"

  table_name = "CS361-G06-rickoroxd-data-dynamodb"
}

# ---------------------------------------------------------------------------
# S3 Storage
# ---------------------------------------------------------------------------

module "storage" {
  source = "./modules/storage"

  bucket_name  = var.bucket_name
  project_name = var.project_name
  environment  = var.environment
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------

module "lambda" {
  source = "./modules/lambda"

  project_name = var.project_name
  environment  = var.environment

  source_dir = "${path.module}/../../backend"

  bucket_name    = module.storage.bucket_name
  bucket_arn     = module.storage.bucket_arn
  buildings_file = "building-index.json"

  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
}

# ---------------------------------------------------------------------------
# API Gateway
# ---------------------------------------------------------------------------

module "api_gateway" {
  source = "./modules/api_gateway"

  project_name = var.project_name
  environment  = var.environment

  lambda_function_name = module.lambda.function_name
  lambda_function_arn  = module.lambda.function_arn
  lambda_invoke_arn    = module.lambda.invoke_arn
}