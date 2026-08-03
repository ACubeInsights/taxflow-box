# AWS Deployment Guide — TaxFlow

Step-by-step cutover from local SQLite (Render) to AWS RDS + App Runner.

## Architecture

```
Vercel (taxflow-app) → App Runner (taxflow-api) → RDS PostgreSQL
                              ↓
                         Box Enterprise API
```

## Prerequisites

- AWS account with CLI/Terraform access
- Box Enterprise app credentials
- Domain / Vercel frontend deployed

## Phase 1 — Provision infrastructure

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit frontend_url and environment

terraform init
terraform plan
terraform apply
```

Save outputs:

```bash
terraform output apprunner_service_url
terraform output ecr_repository_url
terraform output secrets_manager_arn
```

## Phase 2 — Configure secrets

In AWS Console → Secrets Manager → `taxflow/staging/app-secrets`, update JSON with real values. The `DATABASE_URL` is pre-populated by Terraform; rotate `DEEP_LINK_SECRET` and Box keys.

## Phase 3 — Build and deploy API

```bash
# From monorepo root
ECR_URL=$(cd infrastructure/terraform && terraform output -raw ecr_repository_url)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR_URL%/*}

docker build -f taxflow-api/Dockerfile -t taxflow-api .
docker tag taxflow-api:latest $ECR_URL:latest
docker push $ECR_URL:latest
```

Trigger App Runner deployment (Console or CLI).

## Phase 4 — Verify database

Migrations run automatically on API boot (`DB_SCHEMA=production`).

Local Postgres smoke test (optional):

```bash
docker compose -f docker-compose.postgres.yml up -d
cd taxflow-api
INTEGRATION_POSTGRES_URL=postgresql://taxflow:taxflow_dev@localhost:5432/taxflow npm run test:postgres
```

## Phase 5 — Seed users

```bash
# Point at RDS (temporarily set DATABASE_URL in taxflow-api/.env)
DB_DIALECT=postgres
DATABASE_URL=postgresql://taxflow:PASSWORD@RDS_HOST:5432/taxflow
DB_SCHEMA=production
node scripts/seed-dev-users.js
```

Production: create real employee accounts; disable demo passwords.

## Phase 6 — Frontend cutover

Set Vercel env:

```
VITE_API_URL=https://<apprunner-url>/api
```

Redeploy frontend.

## Phase 7 — Smoke test checklist

- [ ] `GET /health` returns `status: ok`
- [ ] Employee login
- [ ] Client list loads (from Box + users table)
- [ ] Document list / preview
- [ ] Comment thread
- [ ] Notification bell
- [ ] Approve + undo within 10 minutes
- [ ] File upload links to Box metadata
- [ ] Webhook receives Box events
- [ ] Client onboarding + invite signup

## Phase 8 — Retire Render SQLite

Once AWS is stable:

1. Update DNS / `VITE_API_URL` to App Runner only
2. Remove or archive `render.yaml` SQLite disk config
3. Delete Render API service (optional)

## Environment reference

| Variable | Staging/Prod value |
|----------|-------------------|
| `NODE_ENV` | `production` |
| `DB_DIALECT` | `postgres` |
| `DB_SCHEMA` | `production` |
| `DB_SSL` | `true` |
| `ALLOW_MOCK_AUTH` | `false` |
| `FRONTEND_URL` | Your Vercel URL |

## Local development (unchanged)

```bash
DB_DIALECT=sqlite
DATABASE_URL=./data/taxflow.db
DB_SCHEMA=full
```

## Rollback

1. Point `VITE_API_URL` back to Render
2. Keep RDS running (data preserved)
3. Investigate App Runner logs in CloudWatch

## Monitoring

- **RDS**: CPU, connections, free storage (CloudWatch)
- **App Runner**: Request count, 5xx rate, health check
- **API**: `/health` endpoint includes Box connectivity

## Cost summary

~$20–30/month for staging (`db.t4g.micro` + App Runner 0.25 vCPU). Scale `db_instance_class` to `db.t4g.small` for production traffic.

See also: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [infrastructure/terraform/README.md](../infrastructure/terraform/README.md).
