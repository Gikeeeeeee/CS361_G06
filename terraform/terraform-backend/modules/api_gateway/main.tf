# CS361_G06/terraform/backend/modules/api_gateway/main.tf

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-http-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]

    allow_methods = [
      "GET",
      "POST",
      "OPTIONS"
    ]

    allow_headers = ["*"]

    max_age = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.this.id

  name        = "$default"
  auto_deploy = true
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

# Route keys below must match backend/handler.py ROUTES byte for byte.
resource "aws_apigatewayv2_route" "get_room_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /api/v1/rooms/{roomId}/schedules"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_room_schedules" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "POST /api/v1/rooms/{roomId}/schedules"

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