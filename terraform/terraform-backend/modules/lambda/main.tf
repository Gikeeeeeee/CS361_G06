# CS361_G06/terraform/backend/modules/lambda/main.tf

data "archive_file" "package" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${path.module}/lambda.zip"

  excludes = [
    "venv",
    ".venv",
    "__pycache__",
    "**/__pycache__",
    ".pytest_cache",
    "tests",
    "pytest.ini",
    "test_local.py",
    "test_*.py",
    "smoke_local.py",
    "README.md"
  ]
}

resource "aws_iam_role" "this" {
  name = "${var.project_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"

        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "s3_read" {
  name = "${var.project_name}-lambda-s3-read-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "s3:GetObject"
        ]

        Resource = "${var.bucket_arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_read" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.s3_read.arn
}

resource "aws_lambda_function" "this" {
  function_name = "${var.project_name}-building-api-${var.environment}"

  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256

  runtime = "python3.12"
  handler = "handler.lambda_handler"

  role = aws_iam_role.this.arn

  timeout     = 10
  memory_size = 256

  environment {
    variables = {
      BUCKET_NAME    = var.bucket_name
      BUILDINGS_FILE = var.buildings_file
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}