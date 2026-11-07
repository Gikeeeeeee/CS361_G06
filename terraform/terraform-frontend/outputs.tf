# CS361_G06/terraform/frontend/outputs.tf

output "bucket_name" {
  description = "Frontend S3 bucket name."
  value       = module.s3_website.bucket_name
}

output "bucket_arn" {
  description = "Frontend S3 bucket ARN."
  value       = module.s3_website.bucket_arn
}

output "cloudfront_domain" {
  description = "CloudFront domain serving the frontend."
  value       = module.s3_website.cloudfront_domain
}

output "website_url" {
  description = "HTTPS URL of the frontend (CloudFront)."
  value       = module.s3_website.website_url
}
