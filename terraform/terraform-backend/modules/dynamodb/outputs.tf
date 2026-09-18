output "table_name" {
  description = "Existing DynamoDB table name."
  value       = data.aws_dynamodb_table.this.name
}

output "table_arn" {
  description = "Existing DynamoDB table ARN."
  value       = data.aws_dynamodb_table.this.arn
}
