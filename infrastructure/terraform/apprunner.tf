resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.environment != "production"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_security_group" "apprunner_connector" {
  name_prefix = "${var.project_name}-apprunner-"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-apprunner-connector-sg"
  }
}

resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "${var.project_name}-${var.environment}-vpc"
  subnets            = data.aws_subnets.default.ids
  security_groups    = [aws_security_group.apprunner_connector.id]
}

resource "aws_iam_role" "apprunner_instance" {
  name = "${var.project_name}-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "apprunner_secrets" {
  name = "${var.project_name}-apprunner-secrets"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [aws_secretsmanager_secret.app.arn]
    }]
  })
}

resource "aws_iam_role" "apprunner_access" {
  name = "${var.project_name}-apprunner-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "build.apprunner.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_apprunner_service" "api" {
  service_name = "${var.project_name}-api-${var.environment}"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = "3001"
        runtime_environment_variables = {
          NODE_ENV         = "production"
          PORT             = "3001"
          DB_DIALECT       = "postgres"
          DB_SCHEMA        = "production"
          DB_SSL           = "true"
          ALLOW_MOCK_AUTH  = "false"
          FRONTEND_URL     = var.frontend_url
          BOX_CONFIG_PATH  = "/tmp/box_config.json"
          BOX_ROOT_FOLDER_ID = "0"
        }
        runtime_environment_secrets = {
          DATABASE_URL      = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"
          DEEP_LINK_SECRET  = "${aws_secretsmanager_secret.app.arn}:DEEP_LINK_SECRET::"
          BOX_CLIENT_ID     = "${aws_secretsmanager_secret.app.arn}:BOX_CLIENT_ID::"
          BOX_CLIENT_SECRET = "${aws_secretsmanager_secret.app.arn}:BOX_CLIENT_SECRET::"
          BOX_PUBLIC_KEY_ID = "${aws_secretsmanager_secret.app.arn}:BOX_PUBLIC_KEY_ID::"
          BOX_PRIVATE_KEY   = "${aws_secretsmanager_secret.app.arn}:BOX_PRIVATE_KEY::"
          BOX_PASSPHRASE    = "${aws_secretsmanager_secret.app.arn}:BOX_PASSPHRASE::"
          BOX_ENTERPRISE_ID = "${aws_secretsmanager_secret.app.arn}:BOX_ENTERPRISE_ID::"
        }
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = var.apprunner_cpu
    memory            = var.apprunner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 3
  }

  depends_on = [aws_db_instance.postgres]
}
