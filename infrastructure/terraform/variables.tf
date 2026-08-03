variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "taxflow"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_name" {
  type    = string
  default = "taxflow"
}

variable "db_username" {
  type    = string
  default = "taxflow"
}

variable "frontend_url" {
  type        = string
  description = "CORS origin for taxflow-app"
}

variable "skip_final_snapshot" {
  type    = bool
  default = true
}

variable "apprunner_cpu" {
  type    = string
  default = "256"
}

variable "apprunner_memory" {
  type    = string
  default = "512"
}
