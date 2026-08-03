output "rds_endpoint" {
  description = "RDS hostname"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  value = aws_db_instance.postgres.port
}

output "database_name" {
  value = aws_db_instance.postgres.db_name
}

output "database_username" {
  value = aws_db_instance.postgres.username
}

output "database_password" {
  description = "RDS master password (also in Secrets Manager DATABASE_URL)"
  value       = random_password.db_password.result
  sensitive   = true
}

output "secrets_manager_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "apprunner_service_url" {
  value = "https://${aws_apprunner_service.api.service_url}"
}

output "apprunner_service_arn" {
  value = aws_apprunner_service.api.arn
}
