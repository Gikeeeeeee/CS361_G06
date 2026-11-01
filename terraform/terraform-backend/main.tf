
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ===========================================================================
# State migration
# ===========================================================================
# Previous resources were managed directly by the root module.
# These moved blocks change only the Terraform state address so that the
# existing AWS resources are now managed by child modules.

# ---------------------------------------------------------------------------
# S3 -> module.storage
# ---------------------------------------------------------------------------

moved {
  from = aws_s3_bucket.building_data
  to   = module.storage.aws_s3_bucket.this
}

moved {
  from = aws_s3_bucket_public_access_block.building_data
  to   = module.storage.aws_s3_bucket_public_access_block.this
}

moved {
  from = aws_s3_bucket_versioning.building_data
  to   = module.storage.aws_s3_bucket_versioning.this
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.building_data
  to   = module.storage.aws_s3_bucket_server_side_encryption_configuration.this
}

moved {
  from = aws_s3_bucket_cors_configuration.building_data
  to   = module.storage.aws_s3_bucket_cors_configuration.this
}

moved {
  from = aws_s3_object.building_index
  to   = module.storage.aws_s3_object.building_index
}

moved {
  from = aws_s3_object.building_files
  to   = module.storage.aws_s3_object.building_files
}

moved {
  from = aws_s3_object.floor_plans
  to   = module.storage.aws_s3_object.floor_plans
}

moved {
  from = aws_s3_object.images
  to   = module.storage.aws_s3_object.images
}

# ---------------------------------------------------------------------------
# API Gateway -> module.api_gateway
# ---------------------------------------------------------------------------

moved {
  from = aws_apigatewayv2_api.this
  to   = module.api_gateway.aws_apigatewayv2_api.this
}

moved {
  from = aws_apigatewayv2_stage.default
  to   = module.api_gateway.aws_apigatewayv2_stage.default
}

moved {
  from = aws_apigatewayv2_integration.lambda
  to   = module.api_gateway.aws_apigatewayv2_integration.lambda
}

moved {
  from = aws_apigatewayv2_route.get_buildings
  to   = module.api_gateway.aws_apigatewayv2_route.get_buildings
}

moved {
  from = aws_apigatewayv2_route.get_building
  to   = module.api_gateway.aws_apigatewayv2_route.get_building
}

moved {
  from = aws_apigatewayv2_route.get_floor
  to   = module.api_gateway.aws_apigatewayv2_route.get_floor
}

moved {
  from = aws_apigatewayv2_route.get_room
  to   = module.api_gateway.aws_apigatewayv2_route.get_room
}

moved {
  from = aws_apigatewayv2_route.get_facility
  to   = module.api_gateway.aws_apigatewayv2_route.get_facility
}

moved {
  from = aws_apigatewayv2_route.get_room_schedules
  to   = module.api_gateway.aws_apigatewayv2_route.get_room_schedules
}

moved {
  from = aws_apigatewayv2_route.post_room_schedules
  to   = module.api_gateway.aws_apigatewayv2_route.post_room_schedules
}

moved {
  from = aws_apigatewayv2_route.put_schedule
  to   = module.api_gateway.aws_apigatewayv2_route.put_schedule
}

moved {
  from = aws_apigatewayv2_route.delete_schedule
  to   = module.api_gateway.aws_apigatewayv2_route.delete_schedule
}

moved {
  from = aws_apigatewayv2_route.default
  to   = module.api_gateway.aws_apigatewayv2_route.default
}

moved {
  from = aws_apigatewayv2_route.search
  to   = module.api_gateway.aws_apigatewayv2_route.search
}

moved {
  from = aws_lambda_permission.api_gateway
  to   = module.api_gateway.aws_lambda_permission.api_gateway
}

# ---------------------------------------------------------------------------
# OpenSearch access policy -> module.lambda
# ---------------------------------------------------------------------------

moved {
  from = aws_opensearchserverless_access_policy.lambda
  to   = module.lambda.aws_opensearchserverless_access_policy.lambda
}

# ===========================================================================
# Modules
# ===========================================================================

module "storage" {
  source = "./modules/storage"

  bucket_name  = var.bucket_name
  project_name = var.project_name
  environment  = var.environment
}

module "dynamodb" {
  source = "./modules/dynamodb"

  table_name = var.dynamodb_table_name
}

module "opensearch" {
  source = "./modules/opensearch"

  project_name    = var.project_name
  environment     = var.environment
  collection_name = var.opensearch_collection_name
}

module "lambda" {
  source = "./modules/lambda"

  project_name = var.project_name
  environment  = var.environment

  source_dir = "${path.module}/../../backend"

  # S3
  bucket_name    = module.storage.bucket_name
  bucket_arn     = module.storage.bucket_arn
  buildings_file = "building-index.json"
  asset_base_url = "https://${module.storage.cdn_domain}"

  # DynamoDB
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  dynamodb_stream_arn = module.dynamodb.stream_arn

  # OpenSearch
  opensearch_collection_arn  = module.opensearch.collection_arn
  opensearch_collection_name = module.opensearch.collection_name
  opensearch_endpoint        = module.opensearch.collection_endpoint
  opensearch_index           = var.opensearch_index

  #Supabase
  supabase_url        = var.supabase_url
  supabase_jwt_secret = var.supabase_jwt_secret
  supabase_anon_key   = var.supabase_anon_key
}

module "api_gateway" {
  source = "./modules/api_gateway"

  project_name         = var.project_name
  environment          = var.environment
  lambda_function_name = module.lambda.function_name
  lambda_invoke_arn    = module.lambda.invoke_arn
}

# ===========================================================================
# Monitoring (#247)
# ===========================================================================
# Alarms publish to one SNS topic. No subscriber yet: subscribe an email or
# chat webhook to the topic later; no code change needed.

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts-${var.environment}"
}

# handler.py turns every exception into a 500 response, so Lambda's own
# Errors metric stays at 0. API Gateway's 5xx count is the real error signal
# (it also includes Lambda timeouts / integration failures).
resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "${var.project_name}-api-5xx-rate-${var.environment}"
  alarm_description   = "API 5xx rate > 1% over 5 minutes."
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  metric_query {
    id          = "rate"
    expression  = "IF(requests > 0, 100 * errors / requests, 0)"
    label       = "5xx rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "5xx"
      dimensions  = { ApiId = module.api_gateway.api_id }
      stat        = "Sum"
      period      = 300
    }
  }

  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      dimensions  = { ApiId = module.api_gateway.api_id }
      stat        = "Sum"
      period      = 300
    }
  }
}

# ThrottledRequests counts requests throttled on the table or any GSI.
# Its dimensions are TableName + Operation, so a Metrics Insights query sums
# every operation into one series.
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${var.project_name}-dynamodb-throttles-${var.environment}"
  alarm_description   = "Any throttled DynamoDB request on the table or its GSIs."
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  metric_query {
    id          = "throttles"
    expression  = "SELECT SUM(ThrottledRequests) FROM SCHEMA(\"AWS/DynamoDB\", Operation, TableName) WHERE TableName = '${module.dynamodb.table_name}'"
    period      = 60
    return_data = true
  }
}

resource "aws_cloudwatch_metric_alarm" "indexer_iterator_age" {
  alarm_name          = "${var.project_name}-indexer-iterator-age-${var.environment}"
  alarm_description   = "Indexer is falling behind the DynamoDB stream (IteratorAge > 60s for 3 minutes)."
  namespace           = "AWS/Lambda"
  metric_name         = "IteratorAge"
  dimensions          = { FunctionName = module.lambda.indexer_function_name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 60000
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
