output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = var.bucket_name
}

/*
output "frontend_bucket_name" {
  description = "Name of the frontend static website S3 bucket"
  value       = var.frontend_bucket_name
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = "arn:aws:s3:::${var.bucket_name}"
}
*/

output "bucket_region" {
  description = "AWS region of the S3 bucket"
  value       = var.aws_region
}

/*
output "frontend_website_endpoint" {
  description = "S3 static website endpoint for the frontend"
  value       = aws_s3_bucket_website_configuration.frontend_website.website_endpoint
}

output "frontend_website_url" {
  description = "HTTP URL for the frontend static website"
  value       = "http://${aws_s3_bucket_website_configuration.frontend_website.website_endpoint}"
}
*/

output "api_endpoint" {
  description = "HTTP API base URL"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "building_api_example_url" {
  description = "Example URL to query building details"
  value       = "${aws_apigatewayv2_api.http_api.api_endpoint}/buildings/LC4"
}

output "floor_api_example_url" {
  description = "Example URL to query floor details with SVG map"
  value       = "${aws_apigatewayv2_api.http_api.api_endpoint}/buildings/LC4/floors/floor-uuid"
}
