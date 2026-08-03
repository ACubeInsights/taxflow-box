# TaxFlow Database Schema — Production Classification

This document is the Phase 1 sign-off for the Postgres migration. It defines what stays in RDS vs Box.

## Schema modes

| `DB_SCHEMA` | Dialect | Tables | Use case |
|-------------|---------|--------|----------|
| `full` | SQLite (default) | 16 legacy tables | Local development |
| `production` | PostgreSQL | 11 tables (Box-first) | AWS RDS staging/prod |
| `minimal` | PostgreSQL | 4 tables (deprecated) | Superseded by `production` |

## Keep in Postgres

### Auth (required)

| Table | Purpose | Sensitive |
|-------|---------|-----------|
| `users` | Staff + client accounts, `box_user_id`, bcrypt `password_hash` | Yes — passwords, PII |
| `sessions` | Bearer session tokens (1h TTL) | Yes — session tokens |
| `reset_tokens` | Password reset flow (30m TTL) | Yes — reset tokens |
| `invite_records` | Pre-account onboarding pipeline | PII — email, client name |

### Operational (small, preserves all workflows)

| Table | Purpose | Box alternative? |
|-------|---------|------------------|
| `comments` | Document comment threads | Box Comments API — deferred (high effort) |
| `notifications` | In-app notification feed | No native equivalent |
| `activity_log` | Dashboard activity timeline | Box Events API — incomplete for UX |
| `webhook_keys` | Box webhook HMAC verification | Secrets Manager possible later |
| `approval_undo` | 10-minute approve undo window | App-specific, ephemeral |
| `box_collaborations` | Employee vault editor grants (audit index) | Box API query — slower |
| `edit_sessions` | Per-employee document edit audit | App-specific |

## Store in Box only (not Postgres in production)

| Former table | Box location |
|--------------|--------------|
| `clients` | `users` where `role=client` + `box_folder_id` |
| `projects` | Vault `Projects` subfolder ID |
| `document_requests` | Marker files + `taxflow_document` metadata |
| `client_vaults` | Discovered folder tree ([`vaultDiscoveryService`](../taxflow-api/src/services/vaultDiscoveryService.js)) |
| `resource_permissions` | Box collaborations ([`boxCollaborationAccessService`](../taxflow-api/src/services/boxCollaborationAccessService.js)) |

## Sensitive data rules

- **Never in Box metadata**: `password_hash`, session tokens, reset tokens, webhook HMAC keys.
- **Never in Postgres (prod)**: tax document file bytes, full Box JWT private key (use Secrets Manager).
- **Deprecate**: legacy password embedded in Box `externalAppUserId` — use `taxflow:{userId}` + DB hash.

## Cost rationale

RDS instance cost (~$15–30/mo for `db.t4g.micro`) dominates. The 7 operational tables add negligible storage. Keeping them avoids reimplementing comments, notifications, and activity feeds against Box APIs.

## Migration path

1. Local dev: continue `DB_SCHEMA=full` + SQLite.
2. AWS: fresh Postgres with `DB_SCHEMA=production`; domain data already in Box.
3. Migrate only `users`, `invite_records` if cutover from existing env; force re-login for sessions.

See [DEPLOYMENT_AWS.md](./DEPLOYMENT_AWS.md) for infrastructure and cutover steps.
