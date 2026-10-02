terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket = "cs361-g06-terraform-state"
    key    = "terraform/shared/opensearch.tfstate"
    region = "us-east-1"
  }

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

module "opensearch" {
  source = "./modules/opensearch"

  project_name = var.project_name
  environment  = var.environment

  collection_name = var.collection_name

  subnet_ids = [
    var.opensearch_subnet_id
  ]
}

output "collection_name" {
  value = module.opensearch.collection_name
}

output "collection_arn" {
  value = module.opensearch.collection_arn
}

output "collection_endpoint" {
  value = module.opensearch.collection_endpoint
}
