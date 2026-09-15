terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"

      configuration_aliases = [
        aws.dynamodb
      ]
    }

    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

resource "aws_dynamodb_table" "faculty_navigator" {
  provider = aws.dynamodb

  name         = "${var.project_name}-data-dynamodb"
  billing_mode = "PAY_PER_REQUEST"

  # ==========================================================
  # Base Table
  # ==========================================================

  hash_key  = "PK"
  range_key = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # ==========================================================
  # GSI0 - Entity Type Index
  # ==========================================================

  attribute {
    name = "GSI0PK"
    type = "S"
  }

  attribute {
    name = "GSI0SK"
    type = "S"
  }

  # ==========================================================
  # GSI1 - Floors by Building
  # ==========================================================

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # ==========================================================
  # GSI2 - Rooms by Floor
  # ==========================================================

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # ==========================================================
  # GSI3 - Facilities by Floor
  # ==========================================================

  attribute {
    name = "GSI3PK"
    type = "S"
  }

  attribute {
    name = "GSI3SK"
    type = "S"
  }

  # ==========================================================
  # GSI4 - Schedules by Room
  # ==========================================================

  attribute {
    name = "GSI4PK"
    type = "S"
  }

  attribute {
    name = "GSI4SK"
    type = "S"
  }

  # ==========================================================
  # GSI5 - Schedules by Course
  # ==========================================================

  attribute {
    name = "GSI5PK"
    type = "S"
  }

  attribute {
    name = "GSI5SK"
    type = "S"
  }

  # ==========================================================
  # GSI6 - Schedules by Type
  # ==========================================================

  attribute {
    name = "GSI6PK"
    type = "S"
  }

  attribute {
    name = "GSI6SK"
    type = "S"
  }

  # ==========================================================
  # GSI0 - Entity Type Index
  # ==========================================================

  global_secondary_index {
    name            = "GSI0"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI0PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI0SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # GSI1 - Floors by Building
  # ==========================================================

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI1PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI1SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # GSI2 - Rooms by Floor
  # ==========================================================

  global_secondary_index {
    name            = "GSI2"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI2PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI2SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # GSI3 - Facilities by Floor
  # ==========================================================

  global_secondary_index {
    name            = "GSI3"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI3PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI3SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # GSI4 - Schedules by Room
  # ==========================================================

  global_secondary_index {
    name            = "GSI4"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI4PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI4SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # GSI5 - Schedules by Course
  # ==========================================================

  global_secondary_index {
    name            = "GSI5"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI5PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI5SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # GSI6 - Schedules by Type
  # ==========================================================

  global_secondary_index {
    name            = "GSI6"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI6PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI6SK"
      key_type       = "RANGE"
    }
  }

  # ==========================================================
  # Recovery / Encryption
  # ==========================================================

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  # ==========================================================
  # Tags
  # ==========================================================

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ==========================================================
# Seed Mock Data
# ==========================================================

resource "null_resource" "seed_mock_data" {
  depends_on = [
    aws_dynamodb_table.faculty_navigator
  ]

  triggers = {
    file_sha256 = filesha256("${path.module}/mock-data.json")
  }

  provisioner "local-exec" {
    command = "aws dynamodb batch-write-item --request-items file://${path.module}/mock-data.json --region us-east-1"
  }
}