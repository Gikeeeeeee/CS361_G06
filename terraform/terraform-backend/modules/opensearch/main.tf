data "aws_vpc" "default" {
  default = true
}

resource "aws_opensearchserverless_security_policy" "encryption" {
  name = "cs361-os-enc-${var.environment}"
  type = "encryption"

  policy = jsonencode({
    Rules = [
      {
        ResourceType = "collection"

        Resource = [
          "collection/${var.collection_name}"
        ]
      }
    ]

    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "network" {
  name = "cs361-os-net-${var.environment}"
  type = "network"

  policy = jsonencode([
    {
      Description = "Public access for OpenSearch"

      Rules = [
        {
          ResourceType = "collection"
          Resource = [
            "collection/${var.collection_name}"
          ]
        },
        {
          ResourceType = "dashboard"
          Resource = [
            "collection/${var.collection_name}"
          ]
        }
      ]

      AllowFromPublic = true
    }
  ])
}

resource "aws_opensearchserverless_collection_group" "this" {
  name             = "${var.collection_name}-group"
  generation       = "NEXTGEN"
  standby_replicas = "ENABLED"

  capacity_limits {
    min_indexing_capacity_in_ocu = 0
    max_indexing_capacity_in_ocu = 2

    min_search_capacity_in_ocu = 0
    max_search_capacity_in_ocu = 2
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_opensearchserverless_collection" "this" {
  name = var.collection_name
  type = "SEARCH"

  collection_group_name = aws_opensearchserverless_collection_group.this.name

  standby_replicas = "ENABLED"

  depends_on = [
    aws_opensearchserverless_security_policy.encryption,
    aws_opensearchserverless_security_policy.network
  ]

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

output "collection_arn" {
  value = aws_opensearchserverless_collection.this.arn
}

output "collection_endpoint" {
  value = aws_opensearchserverless_collection.this.collection_endpoint
}

output "collection_name" {
  value = aws_opensearchserverless_collection.this.name
}

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "collection_name" {
  type = string
}
