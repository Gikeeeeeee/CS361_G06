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
# Default VPC
# ---------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

# ---------------------------------------------------------------------------
# Lambda subnet
# ---------------------------------------------------------------------------

data "aws_subnet" "lambda" {
  id = var.lambda_subnet_id
}

# ---------------------------------------------------------------------------
# Lambda Security Group
# ---------------------------------------------------------------------------

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-${var.environment}"
  description = "Security group for API and Indexer Lambda functions"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "Allow outbound traffic"

    from_port = 0
    to_port   = 0

    protocol = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# Shared DynamoDB
# ---------------------------------------------------------------------------

module "dynamodb" {
  source = "./modules/dynamodb"

  table_name = var.dynamodb_table_name
}

# ---------------------------------------------------------------------------
# Per-developer S3
#
# Keep the existing v2 implementation.
# ---------------------------------------------------------------------------

module "storage" {
  source = "./modules/storage"

  bucket_name  = var.bucket_name
  project_name = var.project_name
  environment  = var.environment
}

# ---------------------------------------------------------------------------
# Shared OpenSearch Serverless Collection
#
# IMPORTANT:
# This should eventually be moved to shared Terraform state.
# For now this module is shown here only if your current implementation
# already expects the collection to be managed from this state.
# ---------------------------------------------------------------------------

module "opensearch" {
  source = "./modules/opensearch"

  project_name = var.project_name
  environment  = var.environment

  collection_name = var.opensearch_collection_name

  subnet_ids = [
    data.aws_subnet.lambda.id
  ]

  lambda_security_group_id = aws_security_group.lambda.id
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
  bucket_name    = module.storage.bucket_name
  bucket_arn     = module.storage.bucket_arn
  buildings_file = "building-index.json"

  # DynamoDB
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  dynamodb_stream_arn = module.dynamodb.stream_arn

  # OpenSearch
  opensearch_collection_arn = module.opensearch.collection_arn
  opensearch_endpoint       = module.opensearch.collection_endpoint
  opensearch_index          = var.opensearch_index

  # Lambda networking
  lambda_subnet_ids = [
    data.aws_subnet.lambda.id
  ]

  lambda_security_group_id = aws_security_group.lambda.id
}

# ---------------------------------------------------------------------------
# OpenSearch Data Access
#
# This developer's Lambda roles get access only to the shared collection's
# indexes. The index itself is developer-specific.
# ---------------------------------------------------------------------------

resource "aws_opensearchserverless_access_policy" "lambda" {
  name = "cs361-os-${var.environment}-access"
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
# ---------------------------------------------------------------------------

module "api_gateway" {
  source = "./modules/api_gateway"

  project_name = var.project_name
  environment  = var.environment

  lambda_function_name = module.lambda.function_name
  lambda_function_arn  = module.lambda.function_arn
  lambda_invoke_arn    = module.lambda.invoke_arn
}