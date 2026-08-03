resource "aws_secretsmanager_secret" "app" {
  name = "${var.project_name}/${var.environment}/app-secrets"
}

resource "aws_secretsmanager_secret_version" "app_placeholder" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL      = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
    DEEP_LINK_SECRET  = "REPLACE_ME_AFTER_APPLY"
    BOX_CLIENT_ID     = "REPLACE_ME"
    BOX_CLIENT_SECRET = "REPLACE_ME"
    BOX_PUBLIC_KEY_ID = "REPLACE_ME"
    BOX_PRIVATE_KEY   = "REPLACE_ME"
    BOX_PASSPHRASE    = "REPLACE_ME"
    BOX_ENTERPRISE_ID = "REPLACE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
