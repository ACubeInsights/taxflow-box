# taxflow-app

React + Vite frontend for TaxFlow (client portal, employee workspace, superadmin).

## Setup

```bash
npm install
cp .env.example .env
```

Typical env:

```
VITE_API_URL=http://localhost:3001
```

Run the API (`taxflow-api` on port 3001) before using the UI.

## Scripts

```bash
npm run dev      # http://localhost:5173
npm run build    # production bundle → dist/
npm run preview  # serve dist/
npm run lint
```

## Layout

- `src/views/` — page-level screens (including `client-detail/`)
- `src/components/` — shared UI
- `src/services/api/` — HTTP clients; import from `services/api` (barrel)
- `src/context/` — auth and app state

Staff and client routes are gated by role after login. Demo login controls, if present, are development-only.
