# TaxFlow Pro

Tax document management system with Box.com secure vault integration.

## Structure

```
taxflow/
├── box-wrapper-service/   # Box.com TypeScript integration layer
├── taxflow-api/           # Express backend API
├── taxflow-app/           # React + Vite frontend
└── box_config.json        # Box JWT credentials (DO NOT COMMIT)
```

## Prerequisites

- Node.js v18+
- Box.com developer account with JWT app configured
- `box_config.json` placed in project root

## Setup

```bash
# Install all dependencies
cd box-wrapper-service && npm install && cd ..
cd taxflow-api && npm install && cd ..
cd taxflow-app && npm install && cd ..

# Configure environment
cd taxflow-api && cp .env.example .env  # edit as needed
cd ../taxflow-app && cp .env.example .env
```

## Run

```bash
# Terminal 1: API server
cd taxflow-api && npm run dev

# Terminal 2: Frontend
cd taxflow-app && npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/clients | Create client vault |
| GET | /api/clients/:externalId/vault | Get client vault |
| POST | /api/documents/upload | Upload document (multipart) |
| GET | /api/documents/:folderId | List documents |
| GET | /api/vaults/:folderId/files | List vault files |
| GET | /api/vaults/files/:fileId/download | Get download URL |
| DELETE | /api/vaults/files/:fileId | Delete file |

## Testing

```bash
cd box-wrapper-service && npm test
```
