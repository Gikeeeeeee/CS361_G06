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

variable "throttling_rate_limit" {
  description = "Default rate limit for API Gateway stage (requests per second)."
  type        = number
  default     = 300
}

variable "throttling_burst_limit" {
  description = "Default burst limit for API Gateway stage."
  type        = number
  default     = 500
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention in days for API Gateway access logs."
  type        = number
  default     = 14
}
