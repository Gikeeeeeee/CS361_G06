# CS361_G06/terraform/backend/modules/storage/variables.tf

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