# CS361_G06/terraform/frontend/outputs.tf

output "bucket_name" {
  description = "Frontend S3 bucket name."
  value       = module.s3_website.bucket_name
}

output "bucket_arn" {
  description = "Frontend S3 bucket ARN."
  value       = module.s3_website.bucket_arn
}

output "website_endpoint" {
  description = "S3 static website endpoint."
  value       = module.s3_website.website_endpoint
}

output "website_url" {
  description = "HTTP URL of the static frontend website."
  value       = module.s3_website.website_url
}