variable "aws_region" {
  description = "AWS region where backend resources are deployed."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for building data."
  type        = string
}

variable "project_name" {
  description = "Project name used for resource names and tags."
  type        = string
  default     = "CS361-G06"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

variable "dynamodb_table_name" {
  description = "Shared DynamoDB table."
  type        = string
  default     = "CS361-G06-rickoroxd-data-dynamodb"
}

variable "lambda_subnet_id" {
  description = "Subnet used by API and Indexer Lambda."
  type        = string

  default = "subnet-0212ce078587bd0d8"
}

variable "opensearch_collection_name" {
  description = "Shared OpenSearch Serverless collection."
  type        = string

  default = "faculty-search"
}

variable "opensearch_index" {
  description = "OpenSearch index owned by this developer."
  type        = string
}