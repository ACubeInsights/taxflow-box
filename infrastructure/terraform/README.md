# TaxFlow AWS Infrastructure (Terraform)

Provisions RDS PostgreSQL, Secrets Manager placeholders, and App Runner for the API.

## Prerequisites

- Terraform >= 1.5
- AWS CLI configured (`aws configure`)
- Box credentials ready for Secrets Manager / App Runner env

## Quick start

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

## What gets created

| Resource | Purpose |
|----------|---------|
| RDS PostgreSQL 16 (`db.t4g.micro`) | Production database |
| DB subnet group + security group | Network isolation |
| Secrets Manager secret | `DATABASE_URL`, `DEEP_LINK_SECRET` placeholders |
| ECR repository | API container images |
| App Runner service | Runs `taxflow-api` with VPC connector to RDS |
| IAM roles | App Runner → Secrets Manager, ECR pull |

## After apply

1. Set secret values in AWS Console → Secrets Manager → `taxflow/app-secrets`:
   ```json
   {
     "DATABASE_URL": "postgresql://taxflow:PASSWORD@RDS_ENDPOINT:5432/taxflow",
     "DEEP_LINK_SECRET": "your-long-random-string",
     "BOX_CLIENT_ID": "...",
     "BOX_CLIENT_SECRET": "...",
     "BOX_PUBLIC_KEY_ID": "...",
     "BOX_PRIVATE_KEY": "...",
     "BOX_PASSPHRASE": "...",
     "BOX_ENTERPRISE_ID": "..."
   }
   ```

2. Build and push API image:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
   docker build -t taxflow-api -f taxflow-api/Dockerfile .
   docker tag taxflow-api:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/taxflow-api:latest
   docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/taxflow-api:latest
   ```

3. Redeploy App Runner (or trigger auto-deploy if configured).

4. Seed users: `node taxflow-api/scripts/seed-dev-users.js` against RDS (update script `DATABASE_URL`).

5. Point frontend `VITE_API_URL` to App Runner URL from `terraform output`.

## Environment variables (App Runner)

Set automatically via Secrets Manager reference:

- `NODE_ENV=production`
- `DB_DIALECT=postgres`
- `DB_SCHEMA=production`
- `DB_SSL=true`
- `ALLOW_MOCK_AUTH=false`

## Cost estimate (us-east-1)

| Service | ~Monthly |
|---------|----------|
| RDS db.t4g.micro | $12–15 |
| App Runner (0.25 vCPU) | $5–15 |
| Secrets Manager | $1 |
| **Total** | **~$20–30** |

## Destroy

```bash
terraform destroy
```

⚠️ RDS has `skip_final_snapshot = false` in production tfvars; dev can skip snapshot.
