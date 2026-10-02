variable "project_name" {
  description = "Project name."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "source_dir" {
  description = "Directory containing the Lambda source code."
  type        = string
}

variable "bucket_name" {
  description = "Building-data S3 bucket name."
  type        = string
}

variable "bucket_arn" {
  description = "Building-data S3 bucket ARN."
  type        = string
}

variable "buildings_file" {
  description = "S3 key for the building index."
  type        = string
  default     = "building-index.json"
}

variable "dynamodb_table_name" {
  description = "Existing DynamoDB table name."
  type        = string
}

variable "dynamodb_table_arn" {
  description = "Existing DynamoDB table ARN."
  type        = string
}

variable "dynamodb_stream_arn" {
  description = "DynamoDB Stream ARN used by the indexer Lambda."
  type        = string
}

variable "opensearch_collection_arn" {
  description = "OpenSearch Serverless collection ARN."
  type        = string
}

variable "opensearch_endpoint" {
  description = "OpenSearch Serverless collection endpoint."
  type        = string
}

variable "opensearch_index" {
  description = "OpenSearch index name."
  type        = string
  default     = "university"
}

# ---------------------------------------------------------------------------
# Lambda VPC configuration
# ---------------------------------------------------------------------------

variable "lambda_subnet_ids" {
  description = "Subnets used by the API and indexer Lambda functions."
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group attached to the API and indexer Lambda functions."
  type        = string
}