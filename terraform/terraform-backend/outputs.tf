output "bucket_name" {
  description = "Building-data S3 bucket."
  value       = module.storage.bucket_name
}

output "bucket_arn" {
  description = "Building-data S3 bucket ARN."
  value       = module.storage.bucket_arn
}

output "lambda_function_name" {
  description = "API Lambda function name."
  value       = module.lambda.function_name
}

output "indexer_lambda_function_name" {
  description = "Indexer Lambda function name."
  value       = module.lambda.indexer_function_name
}

output "api_endpoint" {
  description = "API Gateway HTTP API endpoint."
  value       = module.api_gateway.api_endpoint
}

output "buildings_url" {
  description = "GET /api/v1/buildings endpoint."
  value       = "${module.api_gateway.api_endpoint}/api/v1/buildings"
}

output "opensearch_collection_name" {
  description = "OpenSearch Serverless collection name."
  value       = module.opensearch.collection_name
}

output "opensearch_collection_endpoint" {
  description = "OpenSearch Serverless collection endpoint."
  value       = module.opensearch.collection_endpoint
}

output "opensearch_index" {
  description = "OpenSearch index used by this deployment."
  value       = var.opensearch_index
}