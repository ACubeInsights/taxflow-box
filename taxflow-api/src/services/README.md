# Services layer

Domain logic for TaxFlow API. Routes stay thin; services own Box + DB orchestration.

## Repository injection

After DB init, `setRepositories(...)` is called on services that support it. Until then (and in unit tests without a DB), many services keep in-memory Maps seeded from `fixtures/seedData.js`.

- **Production / local with DB:** repository path is authoritative.
- **Tests / fallback:** Maps remain for behavior-compatible unit tests. Collapsing dual paths is a separate initiative.

## Schema modes

See `db/schemaMode.js`: `full` (local SQLite), `production` (Box-first Postgres), `minimal` (deprecated legacy).

## Notifications

- Client/staff in-app + email: prefer `notificationService` (`notifyClient`, `dispatch`, `dispatchUploadNotification`).
- Staff alerts for client uploads: **only** `routes/documents/uploadRoutes.js` (avoids double-fire when Box also emits `FILE.UPLOADED`).
- `postUploadPipeline` handles metadata/tasks for webhook uploads; it does not dispatch upload notifications.
