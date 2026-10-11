output "function_name" {
  description = "API Lambda function name."
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "API Lambda function ARN."
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN used by API Gateway."
  value       = aws_lambda_function.this.invoke_arn
}

output "lambda_role_arn" {
  description = "API Lambda execution role ARN."
  value       = aws_iam_role.this.arn
}

output "indexer_function_name" {
  description = "Indexer Lambda function name."
  value       = aws_lambda_function.indexer.function_name
}

output "indexer_function_arn" {
  description = "Indexer Lambda function ARN."
  value       = aws_lambda_function.indexer.arn
}

output "indexer_role_arn" {
  description = "Indexer Lambda execution role ARN."
  value       = aws_iam_role.indexer.arn
}