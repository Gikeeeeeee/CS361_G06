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

variable "is_learner_lab" {
  description = "Set to true if deploying in AWS Academy / Learner Lab to bypass IAM creation"
  type        = bool
  default     = false
}

variable "lab_role_name" {
  description = "The name of the pre-existing LabRole (only used if is_learner_lab is true)"
  type        = string
  default     = "LabRole"
}