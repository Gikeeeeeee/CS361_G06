data "aws_caller_identity" "current" {}

resource "terraform_data" "build" {
  triggers_replace = concat(
    [
      filesha256("${var.source_dir}/requirements.txt")
    ],
    [
      for file in sort(fileset(var.source_dir, "**/*.py")) :
      filesha256("${var.source_dir}/${file}")
    ]
  )

  provisioner "local-exec" {
    command = <<-EOT
      set -e

      rm -rf "${path.module}/build"
      mkdir -p "${path.module}/build"

      docker run --rm --platform linux/amd64 \
        --user "$(id -u):$(id -g)" \
        --entrypoint /bin/sh \
        -e HOME=/tmp \
        -v "${abspath(var.source_dir)}:/src:ro" \
        -v "${abspath("${path.module}/build")}:/out" \
        public.ecr.aws/lambda/python:3.12 \
        -c 'python -m pip install -r /src/requirements.txt -t /out'

      cp -r "${var.source_dir}/." "${path.module}/build/"

      rm -rf "${path.module}/build/env"
      rm -rf "${path.module}/build/venv"
      rm -rf "${path.module}/build/.venv"
      rm -rf "${path.module}/build/__pycache__"
      rm -rf "${path.module}/build/.pytest_cache"
      rm -rf "${path.module}/build/tests"
    EOT
  }
}

data "archive_file" "package" {
  type        = "zip"
  source_dir  = "${path.module}/build"
  output_path = "${path.module}/lambda.zip"

  excludes = [
    "venv",
    ".venv",
    "__pycache__",
    "**/__pycache__",
    ".pytest_cache",
    "tests",
    "requirements.txt",
    "pytest.ini",
    "test_local.py",
    "test_*.py",
    "smoke_local.py",
    "README.md",
  ]

  depends_on = [
    terraform_data.build
  ]
}

# ===========================================================================
# API Lambda
# ===========================================================================

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

# ---------------------------------------------------------------------------
# S3 read access
# ---------------------------------------------------------------------------

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
      },
      {
        Effect = "Allow"

        Action = [
          "s3:ListBucket"
        ]

        Resource = var.bucket_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_read" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.s3_read.arn
}

# ---------------------------------------------------------------------------
# DynamoDB access
# ---------------------------------------------------------------------------

resource "aws_iam_policy" "dynamodb_access" {
  name = "${var.project_name}-lambda-dynamodb-access-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "dynamodb:BatchGetItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem"
        ]

        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "dynamodb_access" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# ---------------------------------------------------------------------------
# OpenSearch access
# ---------------------------------------------------------------------------

resource "aws_iam_policy" "opensearch_access" {
  name = "${var.project_name}-lambda-opensearch-access-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "aoss:APIAccessAll"
        ]

        Resource = var.opensearch_collection_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "opensearch_access" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.opensearch_access.arn
}

resource "aws_lambda_function" "this" {
  function_name = "${var.project_name}-building-api-${var.environment}"

  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256

  runtime = "python3.12"
  handler = "handler.lambda_handler"

  role = aws_iam_role.this.arn

  timeout     = 60
  memory_size = 256

  environment {
    variables = {
      BUCKET_NAME         = var.bucket_name
      BUILDINGS_FILE      = var.buildings_file
      DYNAMODB_TABLE_NAME = var.dynamodb_table_name

      OPENSEARCH_ENDPOINT = var.opensearch_endpoint
      OPENSEARCH_INDEX    = var.opensearch_index
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ===========================================================================
# Indexer Lambda
# ===========================================================================

resource "aws_iam_role" "indexer" {
  name = "${var.project_name}-indexer-lambda-exec-${var.environment}"

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

resource "aws_iam_role_policy_attachment" "indexer_basic_execution" {
  role       = aws_iam_role.indexer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ---------------------------------------------------------------------------
# DynamoDB Stream read access
# ---------------------------------------------------------------------------

resource "aws_iam_policy" "indexer_stream_read" {
  name = "${var.project_name}-indexer-stream-read-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]

        Resource = var.dynamodb_stream_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "indexer_stream_read" {
  role       = aws_iam_role.indexer.name
  policy_arn = aws_iam_policy.indexer_stream_read.arn
}

# ---------------------------------------------------------------------------
# OpenSearch access for Indexer
# ---------------------------------------------------------------------------

resource "aws_iam_policy" "indexer_opensearch_access" {
  name = "${var.project_name}-indexer-opensearch-access-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "aoss:APIAccessAll"
        ]

        Resource = var.opensearch_collection_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "indexer_opensearch_access" {
  role       = aws_iam_role.indexer.name
  policy_arn = aws_iam_policy.indexer_opensearch_access.arn
}

resource "aws_lambda_function" "indexer" {
  function_name = "${var.project_name}-indexer-${var.environment}"

  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256

  runtime = "python3.12"
  handler = "indexer.handler.lambda_handler"

  role = aws_iam_role.indexer.arn

  timeout     = 60
  memory_size = 256

  environment {
    variables = {
      OPENSEARCH_ENDPOINT = var.opensearch_endpoint
      OPENSEARCH_INDEX    = var.opensearch_index
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# DynamoDB Stream -> Indexer Lambda
# ---------------------------------------------------------------------------

resource "aws_lambda_event_source_mapping" "indexer" {
  event_source_arn  = var.dynamodb_stream_arn
  function_name     = aws_lambda_function.indexer.arn
  starting_position = "LATEST"

  batch_size                         = 100
  maximum_batching_window_in_seconds = 5
  enabled                            = true

  depends_on = [
    aws_iam_role_policy_attachment.indexer_stream_read,
    aws_iam_role_policy_attachment.indexer_opensearch_access
  ]
}

# ---------------------------------------------------------------------------
# OpenSearch Serverless Data Access Policy
# ---------------------------------------------------------------------------

resource "aws_opensearchserverless_access_policy" "lambda" {
  name = "cs361-os-lambda-${var.environment}"
  type = "data"

  policy = jsonencode([
    {
      Rules = [
        {
          ResourceType = "collection"

          Resource = [
            "collection/${var.opensearch_collection_name}"
          ]

          Permission = [
            "aoss:DescribeCollectionItems"
          ]
        },
        {
          ResourceType = "index"

          Resource = [
            "index/${var.opensearch_collection_name}/${var.opensearch_index}"
          ]

          Permission = [
            "aoss:CreateIndex",
            "aoss:DeleteIndex",
            "aoss:UpdateIndex",
            "aoss:DescribeIndex",
            "aoss:ReadDocument",
            "aoss:WriteDocument"
          ]
        }
      ]

      Principal = [
        aws_iam_role.this.arn,
        aws_iam_role.indexer.arn,
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/terraform-deployer"
      ]
    }
  ])
}
