variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Shared project name."
  type        = string
  default     = "CS361-G06"
}

variable "environment" {
  description = "Shared environment."
  type        = string
  default     = "shared"
}

variable "collection_name" {
  description = "Shared OpenSearch Serverless collection."
  type        = string
  default     = "faculty-search"
}

variable "opensearch_subnet_id" {
  description = "Subnet used by OpenSearch Serverless VPC endpoint."
  type        = string
  default     = "subnet-0212ce078587bd0d8"
}
