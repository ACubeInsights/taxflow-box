# TaxFlow API

Express backend for TaxFlow Pro with Box.com integration.

## Setup

```bash
npm install
cp .env.example .env  # configure your settings
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |
| NODE_ENV | development | Environment |
| BOX_CONFIG_PATH | ../box_config.json | Path to Box JWT config |
| BOX_ROOT_FOLDER_ID | 0 | Box root folder for vaults |
| FRONTEND_URL | http://localhost:5173 | CORS origin |
| BOX_ADMIN_EMAIL | | Your Box email for collaboration |

## Endpoints

See root [README.md](../README.md) for full API reference.
