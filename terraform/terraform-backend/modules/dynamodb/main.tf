resource "aws_dynamodb_table" "faculty_navigator" {
  name         = "${var.project_name}-data"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "PK"
  range_key = "SK"

  # ==========================================================
  # Base Table
  # ==========================================================

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
  #
  # ENTITY#BUILDING
  # ENTITY#FLOOR
  # ENTITY#ROOM
  # ENTITY#FACILITY
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
  #
  # PK: BUILDING#{building_id}
  # SK: FLOOR#{floor_number}#{floor_id}
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
  #
  # PK: FLOOR#{floor_id}
  # SK: ROOM#{room_number}#{room_id}
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
  #
  # PK: FLOOR#{floor_id}
  # SK: FACILITY#{type}#{facility_id}
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
  #
  # PK: ROOM#{room_id}
  # SK: START#{start_at}#SCHEDULE#{schedule_id}
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
  #
  # PK: COURSE#{course_code}
  # SK: START#{start_at}#SCHEDULE#{schedule_id}
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
  #
  # PK: TYPE#{type}
  # SK: START#{start_at}#SCHEDULE#{schedule_id}
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
  # Global Secondary Indexes
  # ==========================================================

  global_secondary_index {
    name            = "GSI0"
    hash_key        = "GSI0PK"
    range_key       = "GSI0SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI3"
    hash_key        = "GSI3PK"
    range_key       = "GSI3SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI4"
    hash_key        = "GSI4PK"
    range_key       = "GSI4SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI5"
    hash_key        = "GSI5PK"
    range_key       = "GSI5SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "GSI6"
    hash_key        = "GSI6PK"
    range_key       = "GSI6SK"
    projection_type = "ALL"
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