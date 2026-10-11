# modules/opensearch/variables.tf

variable "project_name" {
  description = "Project name used for resource names and tags."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "collection_name" {
  description = "OpenSearch Serverless collection name."
  type        = string
}


