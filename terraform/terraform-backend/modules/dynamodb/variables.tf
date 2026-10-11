# CS361_G06/terraform/backend/modules/dynamodb/variables.tf
variable "table_name" {
  description = "Existing shared DynamoDB table name."
  type        = string
}