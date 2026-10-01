# Existing shared DynamoDB table managed by Terraform.
# The table already exists in AWS and must be imported into Terraform state.
resource "aws_dynamodb_table" "this" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "PK"
  range_key = "SK"

  # DynamoDB Streams
  #
  # The indexer only needs NewImage for INSERT/MODIFY.
  # REMOVE events use Keys.
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"


  lifecycle {
    ignore_changes = [
      server_side_encryption,
      tags,
    ]
  }

  # Primary key
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI0
  attribute {
    name = "GSI0PK"
    type = "S"
  }

  attribute {
    name = "GSI0SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI0"
    hash_key        = "GSI0PK"
    range_key       = "GSI0SK"
    projection_type = "ALL"
  }

  # GSI1
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # GSI2
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  # GSI3
  attribute {
    name = "GSI3PK"
    type = "S"
  }

  attribute {
    name = "GSI3SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI3"
    hash_key        = "GSI3PK"
    range_key       = "GSI3SK"
    projection_type = "ALL"
  }

  # GSI4
  attribute {
    name = "GSI4PK"
    type = "S"
  }

  attribute {
    name = "GSI4SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI4"
    hash_key        = "GSI4PK"
    range_key       = "GSI4SK"
    projection_type = "ALL"
  }

  # GSI5
  attribute {
    name = "GSI5PK"
    type = "S"
  }

  attribute {
    name = "GSI5SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI5"
    hash_key        = "GSI5PK"
    range_key       = "GSI5SK"
    projection_type = "ALL"
  }

  # GSI6
  attribute {
    name = "GSI6PK"
    type = "S"
  }

  attribute {
    name = "GSI6SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI6"
    hash_key        = "GSI6PK"
    range_key       = "GSI6SK"
    projection_type = "ALL"
  }

}