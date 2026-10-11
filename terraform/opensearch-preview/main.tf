terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket       = "cs361-g06-terraform-state"
    key          = "terraform/opensearch-preview/placeholder.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "pr_number" {
  type = string

  validation {
    condition     = can(regex("^[0-9]+$", var.pr_number))
    error_message = "pr_number must contain only digits."
  }
}

locals {
  collection_name = "cs361-pr-${var.pr_number}"
  group_name      = "cs361-pr-${var.pr_number}-group"
  encryption_name = "cs361-pr-enc-${var.pr_number}"
  network_name    = "cs361-pr-net-${var.pr_number}"
  access_name     = "cs361-pr-access-${var.pr_number}"
}

resource "aws_opensearchserverless_security_policy" "encryption" {
  name = local.encryption_name
  type = "encryption"

  policy = jsonencode({
    Rules = [{
      ResourceType = "collection"
      Resource     = ["collection/${local.collection_name}"]
    }]
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "network" {
  name = local.network_name
  type = "network"

  policy = jsonencode([{
    Description = "Temporary network policy for PR preview"
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/${local.collection_name}"]
      },
      {
        ResourceType = "dashboard"
        Resource     = ["collection/${local.collection_name}"]
      }
    ]
    AllowFromPublic = true
  }])
}

resource "aws_opensearchserverless_collection_group" "this" {
  name             = local.group_name
  generation       = "NEXTGEN"
  standby_replicas = "ENABLED"

  capacity_limits {
    min_indexing_capacity_in_ocu = 0
    max_indexing_capacity_in_ocu = 2
    min_search_capacity_in_ocu   = 0
    max_search_capacity_in_ocu   = 2
  }

  tags = {
    Project     = "CS361-G06"
    Environment = "pr-preview"
    PR          = var.pr_number
    ManagedBy   = "Terraform"
  }
}

resource "aws_opensearchserverless_collection" "this" {
  name                  = local.collection_name
  type                  = "SEARCH"
  collection_group_name = aws_opensearchserverless_collection_group.this.name
  standby_replicas      = "ENABLED"

  depends_on = [
    aws_opensearchserverless_security_policy.encryption,
    aws_opensearchserverless_security_policy.network
  ]

  tags = {
    Project     = "CS361-G06"
    Environment = "pr-preview"
    PR          = var.pr_number
    ManagedBy   = "Terraform"
  }
}

resource "aws_opensearchserverless_access_policy" "preview" {
  name = local.access_name
  type = "data"

  policy = jsonencode([{
    Description = "Temporary data access for PR preview"
    Principal   = [data.aws_caller_identity.current.arn]
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/${local.collection_name}"]
        Permission   = ["aoss:DescribeCollectionItems"]
      },
      {
        ResourceType = "index"
        Resource     = ["index/${local.collection_name}/*"]
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
  }])

  depends_on = [
    aws_opensearchserverless_collection.this
  ]
}

output "collection_endpoint" {
  value = aws_opensearchserverless_collection.this.collection_endpoint
}

output "collection_name" {
  value = aws_opensearchserverless_collection.this.name
}