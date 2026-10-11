variable "project_name" {
  description = "Project name."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "lambda_function_name" {
  description = "Lambda function name."
  type        = string
}

variable "lambda_invoke_arn" {
  description = "Lambda invoke ARN."
  type        = string
}