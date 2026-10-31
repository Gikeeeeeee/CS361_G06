# CS361_G06/terraform/backend/modules/api_gateway/outputs.tf

output "api_id" {
  description = "HTTP API ID."
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "HTTP API endpoint."
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "access_log_group_arn" {
  description = "CloudWatch Log Group ARN for API Gateway access logs."
  value       = aws_cloudwatch_log_group.api_gw_access_logs.arn
}

