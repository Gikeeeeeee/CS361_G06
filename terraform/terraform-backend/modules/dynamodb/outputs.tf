output "table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.faculty_navigator.name
}

output "table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.faculty_navigator.arn
}