# CS361_G06/terraform/backend/outputs.tf

output "bucket_name" {
  description = "Building-data S3 bucket."
  value       = module.storage.bucket_name
}

output "bucket_arn" {
  description = "Building-data S3 bucket ARN."
  value       = module.storage.bucket_arn
}

output "lambda_function_name" {
  description = "Lambda function name."
  value       = module.lambda.function_name
}

output "api_endpoint" {
  description = "API Gateway HTTP API endpoint."
  value       = module.api_gateway.api_endpoint
}

output "buildings_url" {
  description = "GET /api/v1/buildings endpoint."
  value       = "${module.api_gateway.api_endpoint}/api/v1/buildings"
}