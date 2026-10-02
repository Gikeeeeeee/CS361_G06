data "aws_vpc" "default" {
  default = true
}


resource "aws_security_group" "private_access" {
  name        = "${var.project_name}-private-access-${var.environment}"
  description = "Private access for Lambda and OpenSearch Serverless"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTPS inside VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"

    cidr_blocks = [
      data.aws_vpc.default.cidr_block
    ]
  }

  egress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"

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
# OpenSearch Serverless VPC endpoint
# ---------------------------------------------------------------------------

resource "aws_opensearchserverless_vpc_endpoint" "this" {
  name = "${var.collection_name}-${var.environment}"

  vpc_id     = data.aws_vpc.default.id
  subnet_ids = var.subnet_ids

  security_group_ids = [
    aws_security_group.private_access.id
  ]
}

# ---------------------------------------------------------------------------
# Encryption policy
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Network policy
# ---------------------------------------------------------------------------

resource "aws_opensearchserverless_security_policy" "network" {
  name = "cs361-os-net-${var.environment}"
  type = "network"

  policy = jsonencode([
    {
      Description = "Private access through VPC endpoint"

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

      AllowFromPublic = false

      SourceVPCEs = [
        aws_opensearchserverless_vpc_endpoint.this.id
      ]
    }
  ])
}

# ---------------------------------------------------------------------------
# OpenSearch Serverless collection group
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# OpenSearch Serverless collection
# ---------------------------------------------------------------------------

resource "aws_opensearchserverless_collection" "this" {
  name = var.collection_name
  type = "SEARCH"

  collection_group_name = aws_opensearchserverless_collection_group.this.name

  standby_replicas = "ENABLED"

  depends_on = [
    aws_opensearchserverless_security_policy.encryption,
    aws_opensearchserverless_security_policy.network,
    aws_opensearchserverless_vpc_endpoint.this
  ]

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}