# taxflow-api

Express backend for TaxFlow with Box vault integration.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Requires `box_config.json` (see `BOX_CONFIG_PATH`). Defaults: port `3001`, SQLite `DB_SCHEMA=full`.

## Schema modes

| `DB_SCHEMA` | Use |
|-------------|-----|
| `full` | Local SQLite, all tables (default) |
| `production` | Postgres + Box as system of record (AWS) |
| `minimal` | Deprecated legacy 4-table mode — use `production` |

See [../docs/DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md) and [src/services/README.md](src/services/README.md).

## Scripts

```bash
npm run dev
npm test
npm run sync-seed-box
```

Env reference: [`.env.example`](.env.example). Deploy: [../docs/DEPLOYMENT_AWS.md](../docs/DEPLOYMENT_AWS.md).
