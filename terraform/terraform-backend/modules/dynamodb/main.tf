# Existing shared table. Terraform reads it for Lambda configuration but never
# creates, seeds, or manages it.
data "aws_dynamodb_table" "this" {
  name = var.table_name
}
