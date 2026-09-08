# CS361_G06/terraform/backend/modules/lambda/variables.tf

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