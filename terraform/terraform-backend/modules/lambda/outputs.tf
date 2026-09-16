# CS361_G06/terraform/backend/modules/lambda/outputs.tf

output "function_name" {
  description = "Lambda function name."
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Lambda function ARN."
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN used by API Gateway."
  value       = aws_lambda_function.this.invoke_arn
}