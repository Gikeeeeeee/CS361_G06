output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.building_data.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.building_data.arn
}

output "bucket_region" {
  description = "AWS region of the S3 bucket"
  value       = var.aws_region
}