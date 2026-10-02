variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "collection_name" {
  type = string
}

variable "subnet_ids" {
  description = "Subnets used by the OpenSearch Serverless VPC endpoint."
  type        = list(string)
}