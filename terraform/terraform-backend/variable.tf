# CS361_G06/terraform/backend/variables.tf

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