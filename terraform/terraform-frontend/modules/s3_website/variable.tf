# CS361_G06/terraform/frontend/modules/s3_website/variables.tf

variable "bucket_name" {
  description = "Globally unique S3 bucket name."
  type        = string
}

variable "project_name" {
  description = "Project name used for resource tags."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "frontend_build_dir" {
  description = "Path to the built frontend files."
  type        = string
}