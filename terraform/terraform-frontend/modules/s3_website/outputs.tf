# CS361_G06/terraform/frontend/modules/s3_website/outputs.tf

output "bucket_name" {
  description = "S3 bucket name."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.this.arn
}

output "website_endpoint" {
  description = "S3 static website endpoint."
  value       = aws_s3_bucket_website_configuration.this.website_endpoint
}

output "website_url" {
  description = "HTTP URL of the website."
  value       = "http://${aws_s3_bucket_website_configuration.this.website_endpoint}"
}