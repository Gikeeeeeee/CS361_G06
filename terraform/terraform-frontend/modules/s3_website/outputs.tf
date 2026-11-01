# CS361_G06/terraform/frontend/modules/s3_website/outputs.tf

output "bucket_name" {
  description = "S3 bucket name."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.this.arn
}

output "cloudfront_domain" {
  description = "CloudFront domain serving the website."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "website_url" {
  description = "HTTPS URL of the website (CloudFront)."
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}
