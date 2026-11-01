# CS361_G06/terraform/backend/modules/api_gateway/main.tf

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-http-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]

    allow_methods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ]

    allow_headers = ["*"]

    max_age = 300
  }
}

resource "aws_cloudwatch_log_group" "api_gw_access_logs" {
  name              = "/aws/v2/api-gateway/${var.project_name}-http-api-${var.environment}"
  retention_in_days = var.log_retention_in_days

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.this.id

  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = var.throttling_burst_limit
    throttling_rate_limit    = var.throttling_rate_limit
  }

  route_settings {
    route_key                = aws_apigatewayv2_route.search.route_key
    detailed_metrics_enabled = true
    throttling_burst_limit   = 100
    throttling_rate_limit    = 50
  }

  route_settings {
    route_key                = aws_apigatewayv2_route.post_schedule_imports.route_key
    detailed_metrics_enabled = true
    throttling_burst_limit   = 10
    throttling_rate_limit    = 5
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_access_logs.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      sourceIp                = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      latency                 = "$context.responseLatency"
      integrationLatency      = "$context.integrationLatency"
      integrationStatus       = "$context.integrationStatus"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  depends_on = [
    aws_apigatewayv2_route.search,
    aws_apigatewayv2_route.post_schedule_imports,
  ]
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.this.id

  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_invoke_arn

  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_buildings" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/buildings"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_building" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/buildings/{buildingId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_floor" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/floors/{floorId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_room" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/rooms/{roomId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_facility" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/facilities/{facilityId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_room_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/rooms/{roomId}/schedules"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/schedules"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_room_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "POST /api/v1/rooms/{roomId}/schedules"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "put_schedule" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "PUT /api/v1/rooms/{roomId}/schedules/{scheduleId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "delete_schedule" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "DELETE /api/v1/rooms/{roomId}/schedules/{scheduleId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "search" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/search"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_schedule_imports" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "POST /api/v1/schedules/imports"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_users_me" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/users/me"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_bookmarks" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/bookmarks"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_bookmarks" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "POST /api/v1/bookmarks"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "delete_bookmark" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "DELETE /api/v1/bookmarks/{entityId}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "$default"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id = "AllowAPIGatewayInvoke"

  action = "lambda:InvokeFunction"

  function_name = var.lambda_function_name

  principal = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
