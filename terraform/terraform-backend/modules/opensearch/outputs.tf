output "collection_arn" {
  description = "OpenSearch Serverless collection ARN."
  value       = aws_opensearchserverless_collection.this.arn
}

output "collection_endpoint" {
  description = "OpenSearch Serverless collection endpoint."
  value       = aws_opensearchserverless_collection.this.collection_endpoint
}

output "collection_name" {
  description = "OpenSearch Serverless collection name."
  value       = aws_opensearchserverless_collection.this.name
}