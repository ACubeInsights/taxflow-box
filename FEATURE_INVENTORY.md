# TaxFlow Pro — Feature & Functionality Inventory

**Generated:** Phase 1, June 26, 2026
**Source:** Verified from codebase inspection (not inferred from documentation alone)

---

## 1. Authentication & Session Management

### 1.1 JWT Authentication (Box SDK)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Loads `box_config.json`, validates structure, initializes Box SDK with JWT auth, returns singleton BoxClient |
| **Box API Surface** | JWT token exchange via `box-node-sdk` v10 `BoxJwtAuth` / `JwtConfig` |
| **Location** | `box-wrapper-service/src/auth/JWTAuthModule.ts` |
| **Status** | Complete — 34/34 tests passing |
| **Limitations** | No key rotation mechanism. No token refresh monitoring. Single config file path (no multi-app support). |

### 1.2 User Authentication (Application-Level)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Email + password login, session creation (48-byte random tokens), session refresh, password change/reset, logout |
| **Box API Surface** | Fallback login searches Box users by `externalAppUserId` field (GET /users) |
| **Location** | `taxflow-api/src/services/authService.js`, `routes/auth.js` |
| **Status** | Complete — working in production |
| **Limitations** | Uses SHA-256 hashing (not bcrypt/argon2 — cryptographically inadequate for passwords). Password stored encoded in Box `externalAppUserId` field (non-standard, couples auth data to Box). Session stored in DB (sessions table), 1hr TTL. |

### 1.3 Client Invitations & Self-Signup

| Attribute | Detail |
|-----------|--------|
| **What it does** | Employee creates invitation, sends email with signed token. Client validates token, completes signup with password, triggers full onboarding |
| **Box API Surface** | None directly (signup triggers onboarding which uses Box) |
| **Location** | `taxflow-api/src/services/inviteService.js`, `signupService.js`, `routes/invites.js` |
| **Status** | Complete |
| **Limitations** | Token stored in invite_records table. Resend mechanism exists. No rate limiting on signup endpoint. |

---

## 2. Client Onboarding (Box Provisioning)

### 2.1 App User Creation

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates Box platform-access-only App User for each client. Stores password hash + email in `externalAppUserId` field. Handles 409 conflict (existing user). |
| **Box API Surface** | `POST /2.0/users` with `isPlatformAccessOnly: true`, `externalAppUserId`, `spaceAmount` |
| **Location** | `taxflow-api/src/services/onboardingService.js` → `createAppUser()` |
| **Status** | Complete |
| **Limitations** | 10GB default space. Duplicate email detection queries all users (performance concern at scale). Password in externalAppUserId is a security anti-pattern. |

### 2.2 Folder Hierarchy Creation

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates nested structure: `ClientName (externalId)` → `Year` → `Projects` → 5 subfolders (Tax, Uploads, SupportingDocs, SignedDocuments, InternalNotes) |
| **Box API Surface** | `POST /2.0/folders` (×8 calls per client). 409 conflict handling with fallback to folder listing. |
| **Location** | `taxflow-api/src/services/onboardingService.js` → `createFolderHierarchy()` |
| **Status** | Complete |
| **Limitations** | Sequential folder creation (not parallelized). No cleanup on partial failure. Relies on folder naming convention for vault discovery. |

### 2.3 Folder Locks

| Attribute | Detail |
|-----------|--------|
| **What it does** | Locks root, SignedDocuments, InternalNotes folders (prevent move/delete). Enterprise tier: mandatory. Free tier: non-fatal. |
| **Box API Surface** | `POST /2.0/folder_locks` with `lockedOperations: { move: true, delete: true }` |
| **Location** | `taxflow-api/src/services/onboardingService.js` → `applyFolderLocks()` |
| **Status** | Partial — currently forced to free tier, so locks always fail silently |
| **Limitations** | Folder locks require Business Plus or Enterprise plan. Currently disabled by forced free tier. |

### 2.4 Collaboration Setup

| Attribute | Detail |
|-----------|--------|
| **What it does** | Sets client App User permissions: Uploads→viewer_uploader, Tax→viewer, SignedDocuments→viewer. Employee: root→editor. NO client access to InternalNotes. |
| **Box API Surface** | `POST /2.0/collaborations` (×4 calls: 3 for client by user ID, 1 for employee by login) |
| **Location** | `taxflow-api/src/services/onboardingService.js` → `setupCollaborations()` |
| **Status** | Complete — 409 conflict treated as success |
| **Limitations** | No verification that collaborations are correctly applied after creation. No group-based collaboration (individual only). |

### 2.5 Webhook Registration

| Attribute | Detail |
|-----------|--------|
| **What it does** | Registers webhook on client root folder for FILE.UPLOADED, FILE.DELETED, FILE.MOVED events. Stores signature keys in DB. |
| **Box API Surface** | `POST /2.0/webhooks` with target folder, triggers, and callback address |
| **Location** | `taxflow-api/src/services/webhookService.js` → `registerWebhook()` |
| **Status** | Complete |
| **Limitations** | Webhook address must be publicly reachable (blocks local dev without tunnel). No webhook health monitoring. No re-registration on key rotation. |

### 2.6 File Request Creation

| Attribute | Detail |
|-----------|--------|
| **What it does** | Copies a file request template to the client's Uploads folder with 7-day expiry and email requirement |
| **Box API Surface** | `POST /2.0/file_requests/{id}/copy` |
| **Location** | `taxflow-api/src/services/onboardingService.js` → `createFileRequest()` |
| **Status** | Conditional — requires `FILE_REQUEST_TEMPLATE_ID` env var (skipped if not set) |
| **Limitations** | Template must be pre-created manually in Box. No template existence validation at startup. |

---

## 3. Document Management

### 3.1 File Upload (Standard)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Uploads file buffer to specified Box folder. Updates document_request record in DB with file ID and status. |
| **Box API Surface** | `POST /2.0/files/content` (uploads.uploadFile with stream) |
| **Location** | `taxflow-api/src/services/boxService.js` → `uploadFile()`, `routes/documents.js` |
| **Status** | Complete |
| **Limitations** | 50MB limit (multer). No chunked upload implementation in current code despite architecture docs claiming it. No SHA-1 verification in current implementation. |

### 3.2 File Listing

| Attribute | Detail |
|-----------|--------|
| **What it does** | Lists items in a Box folder |
| **Box API Surface** | `GET /2.0/folders/{id}/items` |
| **Location** | `taxflow-api/src/services/boxService.js` → `listFiles()` |
| **Status** | Complete |
| **Limitations** | No pagination (returns all items from single call). No field selection optimization. |

### 3.3 File Download

| Attribute | Detail |
|-----------|--------|
| **What it does** | Returns a download URL for a Box file |
| **Box API Surface** | `GET /2.0/files/{id}/content` (follow redirect to download URL) |
| **Location** | `taxflow-api/src/services/boxService.js` → `getFileDownloadUrl()` |
| **Status** | Complete |
| **Limitations** | No expiring download link generation (URL may expire quickly). No streaming download option. |

### 3.4 File Deletion

| Attribute | Detail |
|-----------|--------|
| **What it does** | Deletes a file from Box |
| **Box API Surface** | `DELETE /2.0/files/{id}` |
| **Location** | `taxflow-api/src/services/boxService.js` → `deleteFile()` |
| **Status** | Complete |
| **Limitations** | No soft-delete / trash management. No permission check before delete. |

### 3.5 File Preview (Embed)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Returns an expiring embed link for Box Content Preview |
| **Box API Surface** | `GET /2.0/files/{id}?fields=expiring_embed_link` |
| **Location** | `taxflow-api/src/routes/vaults.js` → `GET /files/:fileId/embed` |
| **Status** | Complete |
| **Limitations** | Embed link has short TTL (typically 60 min). No fallback for unsupported file types. |

### 3.6 File Versions

| Attribute | Detail |
|-----------|--------|
| **What it does** | Returns version history for a file sorted by version number descending |
| **Box API Surface** | `GET /2.0/files/{id}/versions` |
| **Location** | `taxflow-api/src/services/portalService.js` → `getFileVersions()` |
| **Status** | Complete |
| **Limitations** | No version restore capability. No version comparison. |

### 3.7 Zip Download

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates a zip archive of up to 100 files with polling for completion |
| **Box API Surface** | `POST /2.0/zip_downloads`, poll status URL |
| **Location** | `taxflow-api/src/services/portalService.js` → `createZipDownload()` |
| **Status** | Complete |
| **Limitations** | 100 file maximum. 60-second polling timeout. No progress reporting to client. |

---

## 4. Metadata Management

### 4.1 taxFlowClientProfile Template (Vault-Level)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Ensures a 5-field metadata template exists on Box for vault folders: client_external_id, client_email, tax_year_current, vault_status (enum: Active/Pending/Archived), firm_id |
| **Box API Surface** | `GET /2.0/metadata_templates/{scope}/{template}`, `POST /2.0/metadata_templates/schema` |
| **Location** | `box-wrapper-service/src/schema/SchemaSyncEngine.ts` |
| **Status** | Complete — with field discrepancy detection |
| **Limitations** | No auto-remediation of missing fields (only warns). No field addition/deletion support. |

### 4.2 taxflow_document Template (File-Level)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Enterprise metadata template with 10 fields for per-document tracking: client_id, engagement_id, request_id, document_type, financial_year, status (7-value enum), reviewer, review_comments, reviewed_at, priority (4-value enum) |
| **Box API Surface** | `POST /2.0/metadata_templates/schema`, `GET /2.0/metadata_templates/enterprise/taxflow_document` |
| **Location** | `taxflow-api/src/services/metadataTemplateDefinition.js` |
| **Status** | Complete — synced on server startup |
| **Limitations** | Enterprise-scope only (fails on free tier). Field discrepancy warning but no auto-fix. |

### 4.3 Metadata Application (Files)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Applies taxflow_document metadata to uploaded files, updates on review/approval/rejection/sign |
| **Box API Surface** | `POST /2.0/files/{id}/metadata/enterprise/taxflow_document`, `PUT` with JSON Patch ops |
| **Location** | `taxflow-api/src/services/postUploadPipeline.js`, `reviewService.js`, `signService.js` |
| **Status** | Complete |
| **Limitations** | Enterprise metadata operations fail on free-tier Box accounts. No fallback mechanism for metadata on free tier. |

### 4.4 Metadata Cascade Policies

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates cascade policy on vault root folder to propagate taxFlowClientProfile metadata to descendants |
| **Box API Surface** | `POST /2.0/metadata_cascade_policies` |
| **Location** | `box-wrapper-service/src/services/BoxWrapperService.ts` → `createAutomatedVault()` |
| **Status** | Partial — skipped on free tier (returns 'skipped' as policy ID) |
| **Limitations** | Cascade policies require Enterprise plan. Currently non-functional due to forced free tier. |

### 4.5 Metadata Queries

| Attribute | Detail |
|-----------|--------|
| **What it does** | Queries files by metadata fields: client progress (by client_id), employee dashboard (by reviewer+status), CXO portfolio (cross-client aggregation), vault lookup (by client_external_id) |
| **Box API Surface** | `POST /2.0/metadata_queries/execute_read` |
| **Location** | `taxflow-api/src/services/portalService.js`, `box-wrapper-service/src/services/BoxWrapperService.ts` |
| **Status** | Complete with DB fallback for portalService |
| **Limitations** | Metadata queries require Enterprise plan. Falls back to DB queries on free tier (portalService). BoxWrapperService falls back to search API on free tier. |

---

## 5. Tier Detection & Dual-Mode Operation

| Attribute | Detail |
|-----------|--------|
| **What it does** | Probes Box API to determine enterprise vs free tier by attempting to access enterprise metadata templates. Routes operations accordingly. |
| **Box API Surface** | `GET /2.0/metadata_templates/enterprise/taxFlowClientProfile` (probe) |
| **Location** | `box-wrapper-service/src/services/BoxWrapperService.ts` → `detectTier()` |
| **Status** | Complete — but currently **forced to free tier** in boxService.js |
| **Limitations** | Tier is hardcoded to 'free' in `taxflow-api/src/services/boxService.js` regardless of detection result. This disables all enterprise features (metadata, cascade, locks, metadata queries). |

---

## 6. Document Workflow

### 6.1 Status Transition Engine

| Attribute | Detail |
|-----------|--------|
| **What it does** | Manages 6-state document lifecycle: Not_Requested → Uploaded → Under_Review → Approved/Revision_Requested/Waived. Optimistic concurrency via version field. |
| **Box API Surface** | None (DB-only state machine) |
| **Location** | `taxflow-api/src/services/statusTransitionService.js` |
| **Status** | Complete |
| **Limitations** | In-memory state store (not DB-backed in statusTransitionService). Bulk transition support. |

### 6.2 Approval Undo

| Attribute | Detail |
|-----------|--------|
| **What it does** | Allows reverting an approval within a 10-minute window using optimistic concurrency |
| **Box API Surface** | None (DB-only) |
| **Location** | `taxflow-api/src/services/statusTransitionService.js` |
| **Status** | Complete |
| **Limitations** | 10-minute fixed window (not configurable). |

### 6.3 Document Review (Box Integration)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Approve: PATCH metadata→approved + complete task + assign retention. Reject: PATCH metadata→revision_requested + file comment. Waive: PATCH metadata→waived + complete task. |
| **Box API Surface** | `PUT /2.0/files/{id}/metadata/enterprise/taxflow_document` (JSON Patch), `GET /2.0/files/{id}/tasks`, `PUT /2.0/task_assignments/{id}`, `POST /2.0/comments` |
| **Location** | `taxflow-api/src/services/reviewService.js` |
| **Status** | Complete |
| **Limitations** | Task completion iterates all tasks/assignments (O(n) calls). No batch task API usage. |

### 6.4 Bulk Approval

| Attribute | Detail |
|-----------|--------|
| **What it does** | Approves up to N documents concurrently (max 5 parallel operations) |
| **Box API Surface** | Same as single approval × N |
| **Location** | `taxflow-api/src/services/reviewService.js` → `bulkApprove()` |
| **Status** | Complete |
| **Limitations** | Concurrency capped at 5. Individual failures don't roll back others. |

---

## 7. Webhook Event Processing

### 7.1 Webhook Signature Verification

| Attribute | Detail |
|-----------|--------|
| **What it does** | Verifies Box webhook payloads using dual HMAC-SHA256 signatures with constant-time comparison |
| **Box API Surface** | Incoming webhook verification (headers: BOX-SIGNATURE-PRIMARY, BOX-SIGNATURE-SECONDARY) |
| **Location** | `taxflow-api/src/services/webhookService.js` → `verifySignature()` |
| **Status** | Complete |
| **Limitations** | Keys stored in DB (webhook_keys table). Verifies against all stored keys (linear scan). |

### 7.2 Post-Upload Pipeline

| Attribute | Detail |
|-----------|--------|
| **What it does** | On FILE.UPLOADED: extract context from folder hierarchy, apply metadata, trigger AI extraction (fire-and-forget), create review task, send notification. Detects revision vs new upload. |
| **Box API Surface** | `GET /2.0/files/{id}?fields=parent`, `GET /2.0/folders/{id}` (×4 for hierarchy walk), `POST metadata`, `POST /2.0/tasks`, `POST /2.0/task_assignments` |
| **Location** | `taxflow-api/src/services/postUploadPipeline.js` |
| **Status** | Complete |
| **Limitations** | Context extraction walks 4 levels up (4 API calls per upload event). No caching of folder hierarchy. Metadata failures queued for retry via rate limiter. |

### 7.3 Sign Event Handling

| Attribute | Detail |
|-----------|--------|
| **What it does** | Processes SIGN_REQUEST.COMPLETED (→signed, copy to SignedDocs), DECLINED (→revision_requested), EXPIRED (→pending_upload) |
| **Box API Surface** | Metadata PATCH, `POST /2.0/files/{id}/copy` |
| **Location** | `taxflow-api/src/services/signService.js` → `handleSignEvent()` |
| **Status** | Complete |
| **Limitations** | No notification dispatch on sign events (only metadata update). |

---

## 8. E-Signature (Box Sign)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates Box Sign requests with source file, signer email, parent folder for signed copies. Supports embedded signing. Updates metadata to pending_signature. |
| **Box API Surface** | `POST /2.0/sign_requests` |
| **Location** | `taxflow-api/src/services/signService.js` → `createSignRequest()` |
| **Status** | Complete |
| **Limitations** | Single signer only (no multi-party signing). No signing order. No prefill of sign fields. Requires Box Business Plus or above. |

---

## 9. Compliance

### 9.1 Retention Policies

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates/retrieves 7-year (2555 days) finite retention policy. Assigns to approved files (triggered by approval flow). |
| **Box API Surface** | `POST /2.0/retention_policies`, `GET /2.0/retention_policies`, `POST /2.0/retention_policy_assignments` |
| **Location** | `taxflow-api/src/services/complianceService.js` |
| **Status** | Complete |
| **Limitations** | Requires Box Governance add-on. Permanent delete on disposition. Assignment is fire-and-forget after approval. |

### 9.2 Legal Holds

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates legal hold policies and assigns them to files or folders. Release by deleting assignment. |
| **Box API Surface** | `POST /2.0/legal_hold_policies`, `POST /2.0/legal_hold_policy_assignments`, `DELETE /2.0/legal_hold_policy_assignments/{id}` |
| **Location** | `taxflow-api/src/services/complianceService.js` |
| **Status** | Complete |
| **Limitations** | Requires Box Governance add-on. No listing of active holds. No audit of hold creation. |

### 9.3 Security Classification

| Attribute | Detail |
|-----------|--------|
| **What it does** | Applies Public/Internal/Confidential classification to files via Box's built-in classification template |
| **Box API Surface** | `POST /2.0/files/{id}/metadata/enterprise/securityClassification-6VMVochwUWo`, `PUT` with JSON Patch on conflict |
| **Location** | `taxflow-api/src/services/complianceService.js` → `applyClassification()` |
| **Status** | Complete |
| **Limitations** | Classification template key is hardcoded (`securityClassification-6VMVochwUWo`). Requires Box Shield or Enterprise. |

---

## 10. Token Management

### 10.1 Service Account Token

| Attribute | Detail |
|-----------|--------|
| **What it does** | Retrieves service account token via SDK downscoping. Cached at 90% TTL. Single retry on failure. |
| **Box API Surface** | `auth.downscopeToken(['item_readwrite'])` |
| **Location** | `taxflow-api/src/services/tokenService.js` |
| **Status** | Complete |
| **Limitations** | Single retry only. No circuit breaker on token service. |

### 10.2 App User Token

| Attribute | Detail |
|-----------|--------|
| **What it does** | Generates token scoped to specific App User. Cached at 90% TTL. |
| **Box API Surface** | `auth.downscopeToken(['item_readwrite'], undefined, { userId })` |
| **Location** | `taxflow-api/src/services/tokenService.js` |
| **Status** | Complete |
| **Limitations** | No per-user rate limit tracking. |

### 10.3 Downscoped Token

| Attribute | Detail |
|-----------|--------|
| **What it does** | Token exchange to restrict scope (item_preview, item_download, item_upload, item_readwrite) and optionally restrict to a specific resource URL |
| **Box API Surface** | `auth.downscopeToken([scope], resource)` |
| **Location** | `taxflow-api/src/services/tokenService.js` |
| **Status** | Complete |
| **Limitations** | Requires parent token as input. |

### 10.4 Preview Token

| Attribute | Detail |
|-----------|--------|
| **What it does** | Generates `item_preview` scoped token for Box Content Preview embedding. Uses token exchange API directly when SDK method unavailable. Capped at 60-minute TTL. |
| **Box API Surface** | `POST /oauth2/token` (token exchange grant), or `auth.downscopeToken(['item_preview'], resourceUrl)` |
| **Location** | `taxflow-api/src/services/tokenService.js` → `getPreviewToken()` |
| **Status** | Complete |
| **Limitations** | Falls back to direct HTTP call to Box token endpoint. Mixed SDK/raw HTTP approaches. |

---

## 11. Box AI Integration

### 11.1 Structured Data Extraction

| Attribute | Detail |
|-----------|--------|
| **What it does** | Runs Box AI extraction against uploaded files using taxflow_document template. Maps extracted fields to metadata. Flags low-confidence fields for manual review. |
| **Box API Surface** | `POST /2.0/ai/extract_structured` |
| **Location** | `taxflow-api/src/services/aiExtractionService.js` → `extractStructuredData()` |
| **Status** | Complete |
| **Limitations** | Requires Box AI add-on (Enterprise). Confidence threshold configurable (default 0.6). Extraction is fire-and-forget (no user-facing status). |

### 11.2 Document Validation

| Attribute | Detail |
|-----------|--------|
| **What it does** | Uses Box AI Ask to evaluate document completeness. Returns is_complete, missing fields, warnings, confidence score. |
| **Box API Surface** | `POST /2.0/ai/ask` (single_item_qa mode) |
| **Location** | `taxflow-api/src/services/aiExtractionService.js` → `validateDocument()` |
| **Status** | Complete |
| **Limitations** | AI response parsing is heuristic (tries JSON, falls back to regex). Not invoked automatically (must be called explicitly). |

### 11.3 Custom AI Agent

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates a "TaxFlow Document Analyzer" AI agent configured for US tax forms. Falls back gracefully if agent API unavailable. |
| **Box API Surface** | `POST /2.0/ai/agents` |
| **Location** | `taxflow-api/src/services/aiExtractionService.js` → `ensureAIAgent()` |
| **Status** | Complete (non-fatal on failure) |
| **Limitations** | Agent creation API may not be available on all Box plans. Agent ID cached in memory only (lost on restart). |

---

## 12. Notifications & Communication

### 12.1 Email Notifications

| Attribute | Detail |
|-----------|--------|
| **What it does** | Sends emails via SMTP (Nodemailer) for revision requests, approvals, new requests, welcome emails |
| **Box API Surface** | None (uses SMTP) |
| **Location** | `taxflow-api/src/services/emailService.js`, `notificationService.js` |
| **Status** | Complete |
| **Limitations** | SMTP configuration required. Retry with exponential backoff (3 attempts). |

### 12.2 In-App Notifications

| Attribute | Detail |
|-----------|--------|
| **What it does** | Stores and retrieves notifications per recipient. Event types: upload, revision_requested, approved, permission_updated, @mention |
| **Box API Surface** | None (DB-backed) |
| **Location** | `taxflow-api/src/services/notificationService.js`, `inAppNotificationStore.js` |
| **Status** | Complete |
| **Limitations** | In-memory store (not persisted across restarts in current implementation). No WebSocket/SSE for real-time delivery. |

### 12.3 Deep-Link Tokens

| Attribute | Detail |
|-----------|--------|
| **What it does** | Generates HMAC-SHA256 signed tokens for email links. Configurable expiry (default 72h, revision emails 7 days). Redirect on verification. |
| **Box API Surface** | None |
| **Location** | `taxflow-api/src/services/deepLinkTokenService.js`, `routes/notifications.js` |
| **Status** | Complete |
| **Limitations** | Requires DEEP_LINK_SECRET env var. No token revocation mechanism. |

---

## 13. Internal Notes

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates .txt files in InternalNotes subfolder with naming convention: `{timestamp}_{author}_{subject}.txt`. Lists notes sorted by creation date descending. Applies `internal_note` metadata. |
| **Box API Surface** | `POST /2.0/files/content` (upload), `GET /2.0/folders/{id}/items`, `POST metadata` |
| **Location** | `taxflow-api/src/services/reviewService.js` → `createInternalNote()`, `listInternalNotes()` |
| **Status** | Complete |
| **Limitations** | Notes stored as plain text files (no rich text). Metadata parsing relies on filename convention. |

---

## 14. Comments System

| Attribute | Detail |
|-----------|--------|
| **What it does** | Add/edit comments on documents. Types: review, internal. @mention autocomplete. 5-minute edit window. |
| **Box API Surface** | `POST /2.0/comments` (used in rejection flow for file-level comments) |
| **Location** | `taxflow-api/src/services/commentService.js`, `routes/comments.js` |
| **Status** | Complete |
| **Limitations** | Application-level comments stored in DB. Box file comments created only on rejection. No comment deletion. |

---

## 15. Portal & Dashboards

### 15.1 Client Progress

| Attribute | Detail |
|-----------|--------|
| **What it does** | Returns documents for a client with status counts. Box metadata query with DB fallback. Cached 60s. |
| **Box API Surface** | `POST /2.0/metadata_queries/execute_read` (enterprise scope) |
| **Location** | `taxflow-api/src/services/portalService.js` → `getClientProgress()` |
| **Status** | Complete with fallback |
| **Limitations** | Metadata query fails on free tier (falls back to DB which has less data). |

### 15.2 Employee Dashboard

| Attribute | Detail |
|-----------|--------|
| **What it does** | Pending reviews sorted by priority, overdue flagging (>7 days), client checklists. Cached 30s. |
| **Box API Surface** | `POST /2.0/metadata_queries/execute_read` |
| **Location** | `taxflow-api/src/services/portalService.js` → `getEmployeeDashboard()` |
| **Status** | Complete |
| **Limitations** | No DB fallback (requires enterprise metadata queries). |

### 15.3 CXO Portfolio

| Attribute | Detail |
|-----------|--------|
| **What it does** | Cross-client aggregation with pagination, compliance rates, firm totals. Cached 120s. |
| **Box API Surface** | `POST /2.0/metadata_queries/execute_read` with marker-based pagination |
| **Location** | `taxflow-api/src/services/portalService.js` → `getCXOPortfolio()` |
| **Status** | Complete |
| **Limitations** | Requires enterprise metadata queries. No DB fallback. |

### 15.4 Inactive Client Detection

| Attribute | Detail |
|-----------|--------|
| **What it does** | Queries Box Events API (admin_logs) to find clients with no activity within threshold days |
| **Box API Surface** | `GET /2.0/events?stream_type=admin_logs&event_type=UPLOAD,PREVIEW,DOWNLOAD` |
| **Location** | `taxflow-api/src/services/portalService.js` → `getInactiveClients()` |
| **Status** | Complete |
| **Limitations** | Paginates entire admin event stream (expensive). No caching. Maps by parent folder ID (imprecise client attribution). |

---

## 16. Employee Management

| Attribute | Detail |
|-----------|--------|
| **What it does** | Creates Box App Users for employees (isPlatformAccessOnly: true). Lists employees by filtering externalAppUserId for role=employee. |
| **Box API Surface** | `POST /2.0/users`, `GET /2.0/users?userType=all` |
| **Location** | `taxflow-api/src/services/employeeService.js` |
| **Status** | Complete |
| **Limitations** | Employee listing queries ALL Box users and filters client-side (O(n) at scale). Role stored in externalAppUserId field (non-standard). |

---

## 17. Granular Permissions

| Attribute | Detail |
|-----------|--------|
| **What it does** | Application-level resource permissions: set/get/revoke access for clients on specific files/folders. Supports: no_access, viewer, commenter, writer, delete, all. Email notification on permission change. |
| **Box API Surface** | None (DB-backed, applied at app layer) |
| **Location** | `taxflow-api/src/services/permissionService.js`, `routes/permissions.js` |
| **Status** | Complete |
| **Limitations** | Separate from Box collaborations (app-layer only). Not synced with Box-level permissions. |

---

## 18. Platform Resilience

### 18.1 Circuit Breaker

| Attribute | Detail |
|-----------|--------|
| **What it does** | Monitors Box API error rates. Opens circuit on 50% failure threshold within 60s window. 30s cooldown before half-open. |
| **Location** | `taxflow-api/src/services/circuitBreaker.js` |
| **Status** | Complete |

### 18.2 Rate Limiter

| Attribute | Detail |
|-----------|--------|
| **What it does** | Queues requests to respect Box API rate limits. Max 10 concurrent requests, max 1000 queue depth. Priority queuing (high/normal). |
| **Location** | `taxflow-api/src/services/rateLimiter.js` |
| **Status** | Complete |

### 18.3 Cache Layer

| Attribute | Detail |
|-----------|--------|
| **What it does** | In-memory cache with configurable TTL per key. Used for tokens, portal data, metadata query results. |
| **Location** | `taxflow-api/src/services/cacheLayer.js` |
| **Status** | Complete |
| **Limitations** | In-memory only (lost on restart). No cache invalidation on write. No distributed cache support. |

### 18.4 Retry with Backoff

| Attribute | Detail |
|-----------|--------|
| **What it does** | Exponential backoff retry utility for transient failures |
| **Location** | `taxflow-api/src/utils/retryWithBackoff.js` |
| **Status** | Complete |

### 18.5 Structured Logging

| Attribute | Detail |
|-----------|--------|
| **What it does** | Centralized logger with context metadata |
| **Location** | `taxflow-api/src/utils/logger.js` |
| **Status** | Complete |

### 18.6 Audit Engine

| Attribute | Detail |
|-----------|--------|
| **What it does** | Logs all state transitions and significant actions to activity_log table |
| **Location** | `taxflow-api/src/utils/auditEngine.js` |
| **Status** | Complete |

---

## 19. Document Type Catalog

| Attribute | Detail |
|-----------|--------|
| **What it does** | Curated catalog of 12 tax document types (W-2, 1099-DIV, 1099-INT, 1099-MISC, 1099-NEC, 1098, 1098-T, Schedule C, Schedule K-1, Trust Agreement, Bank Statements, Charitable Donation Receipts). Categorized, with entity-type filtering. |
| **Box API Surface** | None (static catalog) |
| **Location** | `taxflow-api/src/services/documentTypeService.js` |
| **Status** | Complete |

---

## Summary: Box API Coverage

| Box API Area | Implemented | Notes |
|---|---|---|
| **Authentication (JWT)** | ✅ | Via box-node-sdk JwtConfig |
| **Users** | ✅ | Create App Users, list, filter |
| **Folders** | ✅ | Create, list items, get by ID |
| **Files** | ✅ | Upload, download URL, delete, get info, copy |
| **Collaborations** | ✅ | Create by user ID and login |
| **Folder Locks** | ✅ | Create (fails on free tier) |
| **Metadata Templates** | ✅ | Create, get, field validation |
| **File/Folder Metadata** | ✅ | Create, update (JSON Patch) |
| **Metadata Cascade** | ✅ | Create (skipped on free tier) |
| **Metadata Queries** | ✅ | Execute read with filters |
| **Tasks** | ✅ | Create, get file tasks, update assignments |
| **Comments** | ✅ | Create (on rejection) |
| **Webhooks** | ✅ | Create, verify signatures |
| **Events** | ✅ | Admin logs stream |
| **Retention Policies** | ✅ | Create, assign |
| **Legal Holds** | ✅ | Create policy, assign, release |
| **Security Classification** | ✅ | Apply/update via metadata |
| **Box Sign** | ✅ | Create sign requests |
| **Box AI** | ✅ | Extract structured, ask, create agent |
| **File Requests** | ✅ | Copy from template |
| **Zip Downloads** | ✅ | Create, poll status |
| **Token Exchange** | ✅ | Downscope tokens |
| **File Versions** | ✅ | List versions |
| **Expiring Embed Links** | ✅ | Get for preview |
| **Search** | ✅ | Content search (free-tier vault lookup) |

---

## Known Issues & Technical Debt

1. **Forced Free Tier** — `boxService.js` hardcodes `this.tier = 'free'`, disabling all enterprise features regardless of account capability.
2. **Password in externalAppUserId** — Security anti-pattern: password hash, email, and role encoded in Box user's `externalAppUserId` field.
3. **SHA-256 Password Hashing** — Not adequate for password hashing. Should be bcrypt or argon2.
4. **No Chunked Upload** — Architecture docs claim chunked upload (50MB+ / 8MB chunks), but implementation uses single-request upload with 50MB multer limit.
5. **In-Memory Stores** — Notifications, cache, status transitions lose state on restart.
6. **Employee Listing Scales Poorly** — Fetches ALL Box users and filters client-side.
7. **No Webhook Health Monitoring** — No mechanism to detect/recover from webhook delivery failures.
8. **No Token Refresh Monitoring** — JWT tokens managed by SDK, no observability into refresh failures.
9. **client_vaults.projects_folder_id missing in migration** — Migration has root/year/tax/uploads/supporting_docs/signed_documents/internal_notes but no projects_folder_id column (exists in code but missing from schema).

---

*This inventory is the baseline for Phase 2 research and Phase 3 gap analysis. Nothing beyond what is verifiably in the codebase is listed.*


---

## 20. Folder Management (Employee/Superadmin)

| Attribute | Detail |
|-----------|--------|
| **What it does** | Allows employees/superadmins to create, rename, and delete subfolders within a client's Box vault. Also provides a full folder+file contents listing endpoint for vault browsing. |
| **Box API Surface** | `POST /2.0/folders` (createFolder), `PUT /2.0/folders/:id` (updateFolderById), `DELETE /2.0/folders/:id` (deleteFolderById), `GET /2.0/folders/:id/items` (getFolderItems) |
| **Location** | `taxflow-api/src/routes/vaults.js` (4 new endpoints), `taxflow-app/src/components/views/ClientDetailView.jsx` (VaultTab), `taxflow-app/src/services/api.js` (vaultApi methods) |
| **Status** | Complete — all endpoints tested against live Box API |
| **Endpoints** | `POST /api/vaults/:parentFolderId/folders`, `PUT /api/vaults/folders/:folderId`, `DELETE /api/vaults/folders/:folderId`, `GET /api/vaults/:folderId/contents` |
| **Security** | Restricted to employee/superadmin roles. Clients are blocked (403). Root folder deletion prevented. Input validation: max 255 chars, no `.`/`..` names. |
| **Frontend** | "Vault" tab in ClientDetailView with breadcrumb navigation, inline create/rename/delete, folder tree browsing |
| **Limitations** | No move/copy folder support (can be added later). No bulk operations. |
