# Implementation Plan: TaxFlow Box Integration

## Overview

Incremental implementation of 15 service modules, 8 new routes, and 1 middleware into the existing `taxflow-api/` Express.js project. Tasks follow a 7-phase structure: infrastructure first, then onboarding, tokens, webhooks, review workflows, portal/sign/notifications, and compliance/AI. Each phase builds on the previous, with checkpoints to validate integration.

## Tasks

- [x] 1. Infrastructure layer — CacheLayer, RateLimiter, CircuitBreaker, PaginationHelper
  - [x] 1.1 Create `taxflow-api/src/services/cacheLayer.js` with in-memory LRU cache
    - Implement `get`, `set`, `del`, `getOrFetch` methods
    - Use a Map-based LRU cache with configurable max entries (default 1000) and per-entry TTL
    - Automatic LRU eviction when max entries exceeded
    - Key format: `mq:{query_hash}` for metadata queries, `token:{user_id}:{scope}` for tokens
    - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6_

  - [x] 1.2 Create `taxflow-api/src/services/rateLimiter.js` with in-memory priority queue
    - Implement `enqueue` with priority support (urgent, high, normal, low)
    - Enforce max 10 concurrent requests/second
    - Handle HTTP 429 responses by re-queuing with `Retry-After` delay
    - Reject low-priority requests when queue depth exceeds 1000
    - Implement `getQueueDepth` method
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5_

  - [x] 1.3 Create `taxflow-api/src/services/circuitBreaker.js`
    - Track failure rates over rolling 60-second window
    - Open circuit at >50% failure rate with minimum 10 requests
    - Implement half-open state with single probe request after 30s cooldown
    - Emit state change events via `onStateChange` listener
    - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5_

  - [x] 1.4 Create `taxflow-api/src/services/paginationHelper.js`
    - Implement `paginate` with marker-based pagination, limit clamped to [1, 200]
    - Implement `collectAll` for aggregation queries processing in batches of 100
    - _Requirements: 39.1, 39.2, 39.3, 39.4, 39.5_

  - [ ]* 1.5 Write unit tests for CacheLayer
    - Test get/set/del with in-memory cache
    - Test `getOrFetch` cache-through pattern
    - Test LRU eviction when max entries exceeded
    - _Requirements: 35.4, 35.5, 35.6_

  - [ ]* 1.6 Write unit tests for CircuitBreaker
    - Test state transitions: closed → open → half-open → closed
    - Test failure rate threshold with rolling window
    - Test probe request in half-open state
    - _Requirements: 38.1, 38.2, 38.3, 38.4_

  - [x] 1.7 Extend `taxflow-api/src/config.js` with new environment variables
    - Add webhook, deep link, notification, rate limiting, circuit breaker, upload, sign, file request, and AI config entries per design
    - _Requirements: 35.1, 37.2, 38.1, 36.1_

- [x] 2. Checkpoint — Ensure infrastructure services pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Token management — TokenService
  - [x] 3.1 Create `taxflow-api/src/services/tokenService.js`
    - Implement `getServiceAccountToken` for admin operations, cached at 90% TTL
    - Implement `getAppUserToken` via JWT bearer grant for client-scoped ops
    - Implement `getDownscopedToken` via token exchange with scope and resource URL
    - Implement `getPreviewToken` with `item_preview` scope and max 60-minute TTL
    - Implement `refreshIfNeeded` for proactive refresh within 10% of expiry
    - Retry once after 1-second delay on token generation failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 16.1, 16.2, 16.3, 16.4_

  - [x] 3.2 Create `taxflow-api/src/routes/tokens.js`
    - POST `/api/tokens/preview` — generate preview token for Box Content Preview
    - Wire to TokenService.getPreviewToken
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ]* 3.3 Write unit tests for TokenService
    - Test token caching with 90% TTL
    - Test proactive refresh within 10% of expiry
    - Test retry on failure
    - Test downscoped token with scope and resource
    - _Requirements: 5.3, 5.4, 5.5, 6.1, 6.5_

- [x] 4. Client onboarding — OnboardingService
  - [x] 4.1 Create `taxflow-api/src/services/onboardingService.js`
    - Implement `createAppUser` — POST /users with `is_platform_access_only: true`, handle 409 conflict by retrieving existing user, set `space_amount` to configured quota (default 10GB)
    - Implement `createFolderHierarchy` — sequential creation: root `{clientName} ({externalId})` → year → 5 subfolders (Tax, Uploads, SupportingDocs, SignedDocuments, InternalNotes), return FolderManifest
    - Implement `applyFolderLocks` — POST /folder_locks on root, SignedDocuments, InternalNotes; continue on failure
    - Implement `setupCollaborations` — per permission matrix: Uploads→viewer_uploader, Tax→viewer, SignedDocuments→viewer for client; root→editor for employee; handle 409 conflicts; NO client access to InternalNotes
    - Implement `createFileRequest` — POST /file-requests/{template_id}/copy with expiry (due date + 7 days), `is_email_required: true`
    - Implement `onboardClient` orchestrator — chains all steps, returns OnboardingResult manifest
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 4.2 Create `taxflow-api/src/routes/onboarding.js`
    - POST `/api/onboarding` — accepts clientName, externalId, email, employeeEmail, financialYear; calls OnboardingService.onboardClient; returns 201 with OnboardingResult
    - _Requirements: 1.1, 2.1_

  - [ ]* 4.3 Write unit tests for OnboardingService
    - Test App User creation and 409 conflict handling
    - Test folder hierarchy creation order (root → year → subfolders)
    - Test folder lock application continues on individual failure
    - Test collaboration setup per permission matrix
    - Test file request creation with expiry calculation
    - _Requirements: 1.1, 1.4, 2.1, 2.5, 2.6, 3.4, 4.6, 4.7, 11.1_

- [x] 5. Webhook infrastructure — WebhookService, middleware, PostUploadPipeline
  - [x] 5.1 Create `taxflow-api/src/middleware/webhookRawBody.js`
    - Middleware that captures raw request body as Buffer for HMAC verification
    - Apply only to the webhook route
    - _Requirements: 8.2_

  - [x] 5.2 Create `taxflow-api/src/services/webhookService.js`
    - Implement `registerWebhook` — POST /webhooks on folder with FILE.UPLOADED, FILE.DELETED, FILE.MOVED triggers; store webhook ID and signature keys; handle 409 conflict
    - Implement `verifySignature` — HMAC-SHA256 with constant-time comparison; check primary key first, fall back to secondary
    - Implement `processEvent` — route verified events to appropriate handlers
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.3 Create `taxflow-api/src/services/postUploadPipeline.js`
    - Implement `processUpload` — detect new upload vs revision flow
    - Implement `applyMetadata` — POST /files/{id}/metadata/enterprise/taxflow_document with client_id, status: "uploaded", financial_year, priority: "normal"
    - Implement `createReviewTask` — POST /tasks with action: review, completion_rule: all_assignees; POST /tasks/{id}/assignments
    - Implement `handleRevision` — reset status to "uploaded", clear review_comments, create new task for original reviewer, add re-upload comment
    - Queue for retry via RateLimiter on metadata failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 18.1, 18.2, 18.3, 18.4_

  - [x] 5.4 Create `taxflow-api/src/routes/webhooks.js`
    - POST `/api/webhooks/box` — apply webhookRawBody middleware, verify signatures, process event; return 200 or 403
    - _Requirements: 8.1, 8.3, 8.5_

  - [ ]* 5.5 Write unit tests for WebhookService
    - Test HMAC-SHA256 signature verification (primary and secondary)
    - Test constant-time comparison prevents timing attacks
    - Test 403 rejection on invalid signatures
    - Test webhook registration and 409 conflict handling
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 7.4_

  - [ ]* 5.6 Write unit tests for PostUploadPipeline
    - Test new upload metadata application
    - Test revision detection and status reset
    - Test task creation and assignment
    - Test retry queuing on metadata failure
    - _Requirements: 9.1, 9.2, 9.6, 18.1, 18.2_

- [x] 6. Checkpoint — Ensure onboarding and webhook pipeline pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Review workflows — ReviewService
  - [x] 7.1 Create `taxflow-api/src/services/reviewService.js`
    - Implement `approveDocument` — PATCH metadata (status: approved, reviewer, reviewed_at, clear review_comments), complete task assignment, notify client; use JSON Patch ops; fail metadata → do NOT complete task
    - Implement `rejectDocument` — PATCH metadata (status: revision_requested, reviewer, reviewed_at, review_comments), create file comment with tagged client, notify client; task remains open; return 400 if reason empty
    - Implement `waiveDocument` — PATCH metadata (status: waived, reviewer, reviewed_at, review_comments), complete task, notify client
    - Implement `bulkApprove` — process array with max concurrency 5, continue on individual failures, return summary with success/failure counts
    - Implement `createInternalNote` — upload to InternalNotes subfolder, name: `{timestamp}_{author}_{subject}.txt`, apply metadata with document_type: "internal_note", status: "approved"
    - Implement `listInternalNotes` — return notes sorted by creation date descending
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 15.4, 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 7.2 Create `taxflow-api/src/routes/reviews.js`
    - POST `/api/reviews/:fileId/approve` — calls ReviewService.approveDocument
    - POST `/api/reviews/:fileId/reject` — validates non-empty reason, calls ReviewService.rejectDocument
    - POST `/api/reviews/:fileId/waive` — calls ReviewService.waiveDocument
    - POST `/api/reviews/bulk-approve` — accepts fileIds array, calls ReviewService.bulkApprove
    - POST `/api/reviews/:clientFolderId/notes` — calls ReviewService.createInternalNote
    - GET `/api/reviews/:clientFolderId/notes` — calls ReviewService.listInternalNotes
    - _Requirements: 12.1, 13.1, 14.1, 15.1, 17.1_

  - [ ]* 7.3 Write unit tests for ReviewService
    - Test approve updates metadata and completes task
    - Test reject does NOT complete task, requires non-empty reason
    - Test waive completes task
    - Test bulk approve with concurrency limit and partial failures
    - Test internal note naming pattern and metadata
    - _Requirements: 12.1, 12.4, 12.5, 13.4, 13.5, 15.2, 15.4, 17.2_

- [x] 8. Upload service — UploadService with chunked upload support
  - [x] 8.1 Create `taxflow-api/src/services/uploadService.js`
    - Implement `upload` — route to standard or chunked upload based on 50MB threshold
    - Implement `chunkedUpload` — create session, upload 8MB chunks with Content-Range, commit with SHA-1 digest; retry failed chunks 3x; abort session on persistent failure
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5_

  - [ ]* 8.2 Write unit tests for UploadService
    - Test routing based on file size threshold
    - Test chunk retry logic
    - Test session abort on persistent failure
    - _Requirements: 36.1, 36.4, 36.5_

- [x] 9. Portal service — PortalService with metadata queries and dashboards
  - [x] 9.1 Create `taxflow-api/src/services/portalService.js`
    - Implement `getClientProgress` — metadata query by client_id, group by status, cache 60s
    - Implement `getEmployeeDashboard` — metadata query by reviewer + status in (uploaded, under_review), sort by priority then upload date, flag overdue items, document checklist per client, cache 30s
    - Implement `getCXOPortfolio` — cross-client aggregation with marker-based pagination in batches of 100, per-client summary rows, firm-wide totals (compliance rate, overdue count), cache 120s
    - Implement `getInactiveClients` — Events API with admin_logs stream, compare last event per client against configurable threshold (default 30 days), use stream_position pagination
    - Implement `getFileVersions` — GET /files/{id}/versions, sorted by version number descending, handle single-version files
    - Implement `createZipDownload` — POST /zip_downloads, poll status_url, return download_url; enforce max 100 files
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 20.1, 20.2, 20.3, 20.4, 20.5, 21.1, 21.2, 21.3, 21.4, 21.5, 22.1, 22.2, 22.3, 22.4, 22.5, 23.1, 23.2, 23.3, 23.4, 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x] 9.2 Create `taxflow-api/src/routes/portal.js`
    - GET `/api/portal/client/:clientId/progress` — calls PortalService.getClientProgress
    - GET `/api/portal/employee/:employeeId/dashboard` — calls PortalService.getEmployeeDashboard
    - GET `/api/portal/cxo/portfolio` — accepts cursor and limit query params, calls PortalService.getCXOPortfolio
    - GET `/api/portal/inactive-clients` — calls PortalService.getInactiveClients
    - GET `/api/portal/files/:fileId/versions` — calls PortalService.getFileVersions
    - POST `/api/portal/zip-download` — validates max 100 files, calls PortalService.createZipDownload
    - _Requirements: 19.1, 20.1, 21.1, 22.1, 23.1, 24.1_

  - [ ]* 9.3 Write unit tests for PortalService
    - Test metadata query caching with correct TTLs (60s, 30s, 120s)
    - Test CXO portfolio aggregation and pagination
    - Test inactive client detection with threshold
    - Test zip download max 100 file enforcement
    - _Requirements: 19.4, 20.5, 21.5, 22.2, 24.5_

- [x] 10. Checkpoint — Ensure review, upload, and portal services pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Box Sign integration — SignService
  - [x] 11.1 Create `taxflow-api/src/services/signService.js`
    - Implement `createSignRequest` — POST /sign_requests with source_files, signers, parent_folder (SignedDocuments), redirect URLs; return embed_url when isEmbedded; update metadata status to "pending_signature"
    - Implement `handleSignEvent` — process SIGN_REQUEST.COMPLETED (status→signed, copy to SignedDocuments), DECLINED (status→revision_requested), EXPIRED (status→pending_upload, notify)
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 26.1, 26.2, 26.3, 26.4, 26.5_

  - [x] 11.2 Create `taxflow-api/src/routes/sign.js`
    - POST `/api/sign/request` — accepts fileId, signerEmail, signedDocsFolderId, isEmbedded; calls SignService.createSignRequest
    - _Requirements: 25.1_

  - [ ]* 11.3 Write unit tests for SignService
    - Test sign request creation with embedded and non-embedded modes
    - Test webhook event handling for completed, declined, expired
    - Test metadata status transitions
    - _Requirements: 25.4, 25.5, 26.1, 26.3, 26.4_

- [x] 12. Notification service — NotificationService with deep links
  - [x] 12.1 Create `taxflow-api/src/services/notificationService.js`
    - Implement `dispatch` — translate Box event to business notification, send via email and store in-app (in memory, ephemeral)
    - Implement `generateDeepLinkToken` — signed JWT with file_id, client_id, action, 72-hour expiry using DEEP_LINK_SECRET
    - Implement `verifyDeepLinkToken` — verify signature and expiry, return 401 if invalid
    - Implement `sendEmail` — SendGrid/SES with deep-link URL, retry 3x with exponential backoff
    - Implement `storeInAppNotification` — store in memory with recipient_id, event_type, message, document_reference, read status, created_at. Notifications are ephemeral and reset on server restart.
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

  - [x] 12.2 Create `taxflow-api/src/routes/notifications.js`
    - GET `/api/notifications/:recipientId` — retrieve in-app notifications
    - GET `/api/deep-link` — verify token and redirect or return 401
    - _Requirements: 27.4, 27.5, 28.6_

  - [ ]* 12.3 Write unit tests for NotificationService
    - Test deep-link token generation and verification
    - Test expired token returns 401
    - Test email retry with exponential backoff
    - Test in-app notification storage
    - _Requirements: 27.1, 27.3, 27.5, 28.5_

- [x] 13. Compliance service — RetentionPolicy, LegalHold, SecurityClassification
  - [x] 13.1 Create `taxflow-api/src/services/complianceService.js`
    - Implement `ensureRetentionPolicy` — POST /retention_policies with 7-year (2555 days), finite, permanently_delete, are_owners_notified: true, can_owner_extend_retention: false; handle 409 by retrieving existing
    - Implement `assignRetentionPolicy` — POST /retention_policy_assignments for approved files
    - Implement `createLegalHold` — POST /legal_hold_policies + POST /legal_hold_policy_assignments
    - Implement `releaseLegalHold` — DELETE assignment, log release
    - Implement `applyClassification` — POST for new, PATCH for existing; support Public, Internal, Confidential levels
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 30.1, 30.2, 30.3, 30.4, 31.1, 31.2, 31.3, 31.4_

  - [x] 13.2 Create `taxflow-api/src/routes/compliance.js`
    - POST `/api/compliance/retention/assign` — assign retention policy to file
    - POST `/api/compliance/legal-hold` — create legal hold
    - DELETE `/api/compliance/legal-hold/:assignmentId` — release legal hold
    - POST `/api/compliance/classify/:fileId` — apply security classification
    - _Requirements: 29.3, 30.1, 30.4, 31.1_

  - [ ]* 13.3 Write unit tests for ComplianceService
    - Test retention policy creation and 409 handling
    - Test legal hold create and release
    - Test classification POST vs PATCH logic
    - _Requirements: 29.1, 29.4, 30.1, 30.4, 31.4_

- [x] 14. AI extraction — AIExtractionService
  - [x] 14.1 Create `taxflow-api/src/services/aiExtractionService.js`
    - Implement `extractStructuredData` — POST /ai/extract_structured with taxflow_document template, map extracted fields to metadata, flag low-confidence (<60%) for manual review by setting priority to "high"
    - Implement `validateDocument` — POST /ai/ask with completeness prompt, return structured result (is_complete, missing_fields, warnings, confidence_score), set priority to "high" if incomplete
    - Implement `ensureAIAgent` — POST /ai/agents if not found, configure with tax document system prompt and taxflow_document template; fall back to default extraction on failure
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 33.1, 33.2, 33.3, 33.4, 34.1, 34.2, 34.3, 34.4_

  - [ ]* 14.2 Write unit tests for AIExtractionService
    - Test structured extraction field mapping
    - Test low-confidence flagging threshold
    - Test AI agent creation fallback
    - Test document validation response parsing
    - _Requirements: 32.2, 32.5, 33.2, 34.4_

- [x] 15. Checkpoint — Ensure sign, notification, compliance, and AI services pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Metadata template setup and wiring
  - [x] 16.1 Add `taxflow_document` metadata template definition to `taxflow-api/src/services/onboardingService.js` or a shared constants file
    - Define template with all 10 fields per design: client_id, engagement_id, request_id, document_type, financial_year, status (enum), reviewer, review_comments, reviewed_at, priority (enum)
    - Scope: enterprise, templateKey: taxflow_document
    - Ensure client_id, engagement_id, and status are queryable
    - Handle 409 if template already exists, verify fields
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 17. Wire all routes into Express server and integrate services
  - [x] 17.1 Update `taxflow-api/src/server.js` to register all new routes
    - Import and mount: onboarding, webhooks, reviews, portal, sign, tokens, notifications, compliance routes
    - Apply webhookRawBody middleware to webhook route before JSON parsing
    - Initialize ComplianceService.ensureRetentionPolicy and AIExtractionService.ensureAIAgent on server startup
    - Wire WebhookService.processEvent to route sign events to SignService.handleSignEvent
    - _Requirements: 7.3, 29.1, 34.1_

  - [x] 17.2 Wire PostUploadPipeline to call AIExtractionService.extractStructuredData after metadata application
    - After metadata is applied to a new upload, trigger AI extraction
    - _Requirements: 9.1, 32.1_

  - [x] 17.3 Wire ReviewService.approveDocument to call ComplianceService.assignRetentionPolicy after approval
    - After a document is approved, assign the 7-year retention policy
    - _Requirements: 29.3_

- [x] 18. Final checkpoint — Ensure all tests pass and all routes are wired
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All services use ES module syntax consistent with the existing taxflow-api codebase
- The existing `boxService.js` is extended indirectly — new services use the Box SDK client via `boxService.getBoxClient()`
