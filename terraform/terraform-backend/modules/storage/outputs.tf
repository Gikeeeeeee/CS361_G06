# CS361_G06/terraform/backend/modules/storage/outputs.tf

output "bucket_name" {
  description = "S3 bucket name."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.this.arn
}

output "bucket_region" {
  description = "AWS region containing the bucket."
  value       = aws_s3_bucket.this.region
}