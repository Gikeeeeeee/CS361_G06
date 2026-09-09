# CS361_G06/terraform/frontend/main.tf

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

module "s3_website" {
  source = "./modules/s3_website"

  bucket_name = var.bucket_name

  project_name = var.project_name
  environment  = var.environment

  frontend_build_dir = var.frontend_build_dir
}