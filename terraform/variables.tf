variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name"
  type        = string
}

variable "project_name" {
  description = "Project name used for resource tags"
  type        = string
  default     = "CS361-G06"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}