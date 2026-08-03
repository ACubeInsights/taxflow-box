# TaxFlow

Tax document vault for firms: clients upload and view documents; staff manage vaults, permissions, reviews, and requests. Storage and collaboration run through Box.

## Packages

| Package | Role |
|---------|------|
| `taxflow-api` | Express API (auth, vaults, documents, invites, webhooks) |
| `taxflow-app` | React + Vite UI (client, employee, superadmin) |
| `box-wrapper-service` | Box SDK helpers (compiled `dist/` used by the API) |

## Prerequisites

- Node.js 18+
- Box JWT app + `box_config.json` at repo root (do not commit)
- Local: SQLite. AWS: Postgres (`DB_SCHEMA=production`) — see [docs/DEPLOYMENT_AWS.md](docs/DEPLOYMENT_AWS.md)

## Local setup

```bash
cd box-wrapper-service && npm install && cd ..
cd taxflow-api && npm install && cp .env.example .env   # set BOX_ADMIN_EMAIL, etc.
cd ../taxflow-app && npm install && cp .env.example .env
```

Place `box_config.json` in the repo root (path defaults to `../box_config.json` from the API).

## Run

```bash
# Terminal 1
cd taxflow-api && npm run dev    # http://localhost:3001

# Terminal 2
cd taxflow-app && npm run dev    # http://localhost:5173
```

Default local DB schema is `full` (SQLite, all tables). Production uses `DB_SCHEMA=production` with Box as system of record for clients/projects/documents. `minimal` is deprecated — prefer `production`.

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Schema modes and tables |
| [docs/DEPLOYMENT_AWS.md](docs/DEPLOYMENT_AWS.md) | App Runner / RDS deploy notes |
| [infrastructure/terraform/README.md](infrastructure/terraform/README.md) | Terraform |
| [MISTAKES.md](MISTAKES.md) | Known pitfalls |
| [taxflow-api/src/services/README.md](taxflow-api/src/services/README.md) | Services / dual storage notes |
| [docs/archive/](docs/archive/) | Historical planning docs |

## Tests

```bash
cd taxflow-api && npm test
cd taxflow-app && npm run build
```
