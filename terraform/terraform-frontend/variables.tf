# CS361_G06/terraform/frontend/variables.tf

variable "aws_region" {
  description = "AWS region where the frontend bucket is deployed."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for the frontend website."
  type        = string
}

variable "project_name" {
  description = "Project name used for resource tags."
  type        = string
  default     = "CS361-G06"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

variable "frontend_build_dir" {
  description = "Directory containing the built frontend application."
  type        = string
  default     = "../../frontend/dist"
}