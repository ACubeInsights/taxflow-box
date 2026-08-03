# TaxFlow Pro — Implementation Plan

**Generated:** Phase 4, June 26, 2026
**Approved Decisions:** Phase 3 Gap Analysis discussion outcomes
**Execution Model:** Sequential sprints. Each sprint is complete (implemented, tested, verified) before the next begins.

---

## System Architecture (Post-Implementation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        taxflow-app (React)                           │
│   Dashboards │ Upload │ Preview │ Auth │ Notifications               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST + Bearer Token
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     taxflow-api (Express.js)                         │
│                                                                      │
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Auth     │  │ Onboarding  │  │ Documents  │  │ Reviews      │  │
│  │ (bcrypt) │  │ (6 phases)  │  │ (chunked)  │  │ (metadata)   │  │
│  └──────────┘  └─────────────┘  └────────────┘  └──────────────┘  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Webhooks │  │ Compliance  │  │ Portal     │  │ Box Sign     │  │
│  │ (HMAC+TS)│  │ (retention) │  │ (mdquery)  │  │ (embedded)   │  │
│  └──────────┘  └─────────────┘  └────────────┘  └──────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Infrastructure Layer                                          │  │
│  │ CircuitBreaker │ RateLimiter │ CacheLayer │ AuditEngine       │  │
│  │ RetryWithBackoff │ Logger │ ErrorHandler                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐  │
│  │ SQLite/PostgreSQL (Knex) │  │ box-wrapper-service (TS)       │  │
│  │ • users (bcrypt hashes)  │  │ • JWTAuthModule                │  │
│  │ • sessions               │  │ • SchemaSyncEngine             │  │
│  │ • clients                │  │ • BoxWrapperService            │  │
│  │ • projects               │  │ • Tier: auto-detect (enterprise)│  │
│  │ • document_requests      │  │                                │  │
│  │ • notifications (DB)     │  └───────────────┬────────────────┘  │
│  │ • client_vaults          │                  │                    │
│  │ • webhook_keys           │                  │ JWT Auth           │
│  │ • activity_log           │                  ▼                    │
│  └──────────────────────────┘  ┌────────────────────────────────┐  │
│                                │ Box Platform API (Enterprise)   │  │
│                                │ • Files/Folders/Uploads         │  │
│                                │ • Metadata (enterprise scope)   │  │
│                                │ • Webhooks (HMAC-SHA256)        │  │
│                                │ • Sign / Tasks / Comments       │  │
│                                │ • AI (extract/ask/agents)       │  │
│                                │ • Retention / Legal Holds       │  │
│                                │ • Events (admin_logs)           │  │
│                                └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Strategy (Post-Fix)

### Application-Level Auth
- **Algorithm:** bcrypt (cost factor 12)
- **Storage:** `users.password_hash` column (local DB only)
- **Session:** 48-byte random token, 1-hour TTL, DB-backed (sessions table)
- **Migration:** Transparent re-hash on login (detect old SHA-256 format → verify → re-hash with bcrypt → update DB)
- **Inactive user policy:** After 90 days on old hash, force reset on next login attempt

### Box API Auth
- **Method:** JWT (Server Authentication) via box-node-sdk
- **Identity:** Service Account (admin-level, owns all content)
- **Per-client isolation:** App Users (platform-access-only) with folder collaborations
- **Token caching:** 50-minute TTL (of 60-minute token lifetime), per Box best practices
- **Downscoping:** `item_preview` for client-facing preview, `item_upload` for upload widgets
- **externalAppUserId format:** `taxflow:{db_user_uuid}`

### Security Boundaries
- Box credentials: Environment variables in production, `.env`-referenced file in dev (NOT in repo)
- Private key: Encrypted at rest, passphrase in separate env var
- Webhook verification: HMAC-SHA256 over body+timestamp, 10-minute replay window, constant-time comparison
- Tokens never exposed to client-side without downscoping

---

## Sprint 1: Security Hardening

**Goal:** Eliminate all CRITICAL and HIGH security vulnerabilities. After this sprint, the authentication and webhook systems are secure against known attack vectors.

### Task 1.1: Fix Webhook Signature Verification

**Files modified:**
- `taxflow-api/src/services/webhookService.js`
- `taxflow-api/src/routes/webhooks.js`

**Changes:**
1. Update `verifySignature()` to accept `timestamp` parameter
2. Prepend timestamp validation (reject if older than 10 minutes)
3. Compute HMAC over `body + timestamp` bytes (per Box docs)
4. Update webhook route to pass `BOX-DELIVERY-TIMESTAMP` header to verification

**Verification logic (pseudocode):**
```
function verifyWebhook(rawBody, headers, allKeys):
  timestamp = headers['box-delivery-timestamp']
  
  // Step 1: Replay protection
  if (Date.now() - Date.parse(timestamp)) > 10 * 60 * 1000:
    return false  // Stale payload
  
  primarySig = headers['box-signature-primary']
  secondarySig = headers['box-signature-secondary']
  
  // Step 2: Try each stored key pair
  for keys in allKeys:
    hmacPrimary = HMAC-SHA256(keys.primaryKey, body + timestamp)
    if timingSafeEqual(base64(hmacPrimary), primarySig):
      return true
    
    hmacSecondary = HMAC-SHA256(keys.secondaryKey, body + timestamp)
    if timingSafeEqual(base64(hmacSecondary), secondarySig):
      return true
  
  return false
```

**Tests required:**
- Valid signature with correct timestamp → accepted
- Valid signature with stale timestamp (>10 min) → rejected
- Invalid signature with valid timestamp → rejected
- Tampered body → rejected
- Timing-safe comparison prevents timing attacks (verify constant time)
- Both primary and secondary key verification paths

**Traceable to:** [Box Signature Verification docs](https://developer.box.com/guides/webhooks/v2/signatures-v2.md)

---

### Task 1.2: Implement bcrypt Password Hashing with Migration

**Files modified:**
- `taxflow-api/src/services/authService.js`
- `taxflow-api/src/utils/authUtils.js`
- `taxflow-api/package.json` (add `bcrypt` dependency)

**New dependency:** `bcrypt@^6.0.0`

**Changes:**

1. Add `bcrypt` package
2. Create `hashPassword(plaintext)` → returns `$2b$12$...` bcrypt hash
3. Create `verifyPassword(plaintext, storedHash)`:
   - If hash starts with `$2b$` → bcrypt verify
   - If hash matches old format `pw:...|em:...|role:...` → extract SHA-256 hash, verify SHA-256(plaintext) against it
   - On successful legacy verify → re-hash with bcrypt → update DB → return true
4. Update `authService.login()` to use new `verifyPassword()`
5. Update `authService.changePassword()` to hash with bcrypt
6. Update `authService.resetPassword()` to hash with bcrypt
7. Mark legacy users: add `hash_algorithm` column or detect by format (format detection is simpler)

**Migration strategy:**
- No schema migration needed (format detection by prefix)
- Old format: `pw:HEXHASH|em:email|role:role` (SHA-256)
- New format: `$2b$12$...` (bcrypt)
- `verifyPassword()` handles both transparently
- On successful old-format verify: UPDATE users SET password_hash = bcrypt_hash WHERE id = user_id
- After 90 days: users still on old hash get forced to reset flow on next login

**Tests required:**
- New user registration → password stored as bcrypt
- Login with bcrypt hash → success
- Login with legacy SHA-256 hash → success + hash upgraded to bcrypt in DB
- After migration: subsequent login uses bcrypt path directly
- Wrong password on legacy hash → failure (no upgrade)
- Wrong password on bcrypt hash → failure
- Change password → stores bcrypt
- Reset password → stores bcrypt
- bcrypt cost factor = 12 verified (timing test: 200-400ms range)

---

### Task 1.3: Clean Up externalAppUserId

**Files modified:**
- `taxflow-api/src/services/onboardingService.js`
- `taxflow-api/src/services/employeeService.js`
- `taxflow-api/src/utils/authUtils.js`
- `taxflow-api/src/services/authService.js` (remove Box user fallback login)

**Changes:**

1. `buildExternalId()` → now returns `taxflow:{db_user_uuid}` (not password+email+role)
2. Onboarding: Create App User with `externalAppUserId: taxflow:{newUserId}`
3. Employee creation: Same pattern `taxflow:{newUserId}`
4. Remove the auth fallback that searches Box users by externalAppUserId to extract passwords
5. Auth now reads ONLY from local DB `users.password_hash`
6. If user exists in Box but not in local DB → they must use "forgot password" flow (not auto-sync from Box credential field)

**Backward compatibility:**
- Existing Box users still have old-format externalAppUserId
- The `listEmployees()` function currently parses role from this field → migrate to DB query
- Add a one-time migration script: for each Box user, create/update local DB record with extracted email+role, set externalAppUserId to new format

**Tests required:**
- New onboarded client → externalAppUserId is `taxflow:{uuid}` format
- New employee → externalAppUserId is `taxflow:{uuid}` format
- Login no longer queries Box for credentials
- Login works from local DB only

---

### Task 1.4: Remove box_config.json from Version Control

**Changes:**
1. Add `box_config.json` to `.gitignore`
2. Add `*.pem` and `*.key` to `.gitignore`
3. Create `box_config.example.json` with placeholder values (no real credentials)
4. Update README with instructions for local setup
5. **Note to user:** After implementation, the private key in the committed file must be rotated in the Box Developer Console (since it has been in git history)

**Tests required:**
- Server starts successfully with config loaded from environment variables
- Server starts successfully with config loaded from file path
- Missing config file → clear error message

---

### Sprint 1 Completion Criteria
- [ ] All webhook signature tests pass
- [ ] All password hashing tests pass (both legacy and new)
- [ ] Auth no longer queries Box for credentials
- [ ] box_config.json not in tracked files
- [ ] Full test suite passes (existing 34 box-wrapper + taxflow-api tests)
- [ ] No regression in existing functionality

---

## Sprint 2: Core Functionality

**Goal:** Enable enterprise-tier Box features and ensure all state survives server restarts.

### Task 2.1: Remove Forced Free Tier

**Files modified:**
- `taxflow-api/src/services/boxService.js`

**Changes:**
1. Remove line: `this.tier = 'free'`
2. Remove line: `this.tierDetectionResult = { ...detectionResult, tier: 'free' }`
3. Let `detectTier()` result flow through naturally
4. Add config option `BOX_FORCE_TIER` env var as optional override for testing
5. Log detected tier clearly at startup

**Expected result:** With Enterprise account, tier detects as `'enterprise'`, enabling:
- Metadata template creation/sync (enterprise scope)
- Metadata cascade policies
- Metadata queries for dashboards
- Folder locks during onboarding

**Tests required:**
- Tier detection with 200 response → enterprise
- Tier detection with 404 response → enterprise (template doesn't exist yet but scope is accessible)
- Tier detection with 403 response → free
- `BOX_FORCE_TIER=free` override works
- `BOX_FORCE_TIER=enterprise` override works
- Schema sync runs successfully on enterprise tier
- createAutomatedVault applies metadata + cascade on enterprise tier

---

### Task 2.2: DB-Backed Notifications

**Files modified:**
- `taxflow-api/src/services/notificationService.js`
- `taxflow-api/src/db/repositories/NotificationRepository.js`

**Changes:**
1. Replace in-memory notification store with `NotificationRepository` calls
2. `dispatch()` → INSERT into notifications table
3. `getNotifications(recipientId)` → SELECT from notifications WHERE recipient_id = ? ORDER BY created_at DESC
4. Add `markAsRead(notificationId)` → UPDATE notifications SET read = true
5. Add pagination (limit/offset) to GET endpoint

**Tests required:**
- Dispatch notification → persists to DB
- Get notifications → returns from DB, ordered by created_at DESC
- Mark as read → updates DB
- Notifications survive simulated server restart (stop/start test harness)
- Unread count accurate

---

### Task 2.3: DB-Backed Status Transitions

**Files modified:**
- `taxflow-api/src/services/statusTransitionService.js`
- `taxflow-api/src/db/repositories/DocumentRequestRepository.js`

**Changes:**
1. Replace in-memory document state with DB operations on `document_requests` table
2. `transitionStatus()`:
   - SELECT current status and version WHERE id = ? AND version = ?
   - Validate transition is allowed (state machine rules)
   - UPDATE status, version = version + 1 WHERE id = ? AND version = ? (optimistic concurrency)
   - If UPDATE affects 0 rows → version conflict error
3. `undoApproval()`:
   - Same pattern with 10-minute window check against `updated_at`
4. `bulkTransition()`:
   - Individual transitions in a transaction, collect results
5. Log all transitions to `activity_log` table via AuditEngine

**State machine validation rules:**
```
Not_Requested → Uploaded (client upload)
Uploaded → Under_Review (employee starts review)
Under_Review → Approved (employee approves)
Under_Review → Revision_Requested (employee rejects)
Under_Review → Waived (employee waives)
Revision_Requested → Uploaded (client re-uploads)
Approved → Under_Review (undo within 10 min)
```

**Tests required:**
- Valid transition → status updated, version incremented
- Invalid transition (e.g., Not_Requested → Approved) → rejected with error
- Concurrent update (version conflict) → 409 error, no update
- Undo within 10 minutes → success
- Undo after 10 minutes → rejected
- Bulk transition → partial success/failure reported correctly
- All transitions logged to activity_log

---

### Task 2.4: Chunked Upload Implementation

**Files modified:**
- `taxflow-api/src/services/boxService.js`
- `taxflow-api/src/services/uploadService.js` (new or refactored)
- `taxflow-api/src/routes/documents.js`
- `taxflow-api/package.json` (adjust multer config)

**Changes:**

1. Change multer to use disk storage for files >20MB:
```javascript
const storage = multer.diskStorage({
  destination: '/tmp/taxflow-uploads/',
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
```

2. Increase file size limit to 5GB (Box Enterprise limit for chunked):
```javascript
limits: { fileSize: 5 * 1024 * 1024 * 1024 }
```

3. Implement upload routing in `boxService`:
```javascript
async uploadFile(folderId, fileName, filePathOrBuffer, fileSize) {
  if (fileSize >= 20 * 1024 * 1024) {
    return this.chunkedUpload(folderId, fileName, filePath, fileSize);
  }
  return this.directUpload(folderId, fileName, buffer);
}
```

4. Implement `chunkedUpload()` using Node SDK's built-in chunked upload support:
   - Create upload session
   - Upload parts (SDK handles chunking, parallelism, SHA-1 per part)
   - Commit with whole-file SHA-1 digest
   - Clean up temp file after success or failure

5. Clean up temp files in all exit paths (success, error, timeout)

**Tests required:**
- File <20MB → direct upload (existing behavior)
- File ≥20MB → chunked upload session created
- Upload session commits successfully with correct SHA-1
- Failed chunk retried (SDK handles this, but verify)
- Temp file cleaned up after successful upload
- Temp file cleaned up after failed upload
- Document request record updated with file ID after upload
- 409 conflict on filename → handled gracefully

**Traceable to:** [Box Chunked Uploads](https://developer.box.com/guides/uploads/chunked/index.md) — minimum 20MB, 7-day session lifetime

---

### Sprint 2 Completion Criteria
- [ ] Tier auto-detects as enterprise on startup (verify with live API call)
- [ ] Metadata template sync succeeds on startup
- [ ] Notifications persist across restart
- [ ] Status transitions use DB with optimistic concurrency
- [ ] Files ≥20MB upload via chunked session
- [ ] Files <20MB upload via direct (no regression)
- [ ] Full test suite passes

---

## Sprint 3: Robustness

**Goal:** Eliminate performance bottlenecks and unnecessary API calls.

### Task 3.1: Optimize Post-Upload Context Extraction

**Files modified:**
- `taxflow-api/src/services/postUploadPipeline.js`

**Changes:**
1. Use `source.path_collection` from the webhook event payload (already contains the full folder ancestry)
2. Parse client name and financial year from path entries instead of making 4 API calls
3. Path structure: `All Files / ClientName (externalId) / Year / Projects / SubFolder`
4. Fallback to API calls only if path_collection is missing or incomplete

**Savings:** 4 API calls eliminated per webhook event (reduce from 5+ to 1 at most)

**Tests required:**
- Webhook with full path_collection → context extracted without API calls
- Webhook with missing path_collection → falls back to API calls
- Client ID correctly parsed from folder name pattern `"Name (externalId)"`
- Financial year correctly extracted from year folder name

---

### Task 3.2: Skip Metadata Operations on Free Tier

**Files modified:**
- `taxflow-api/src/services/postUploadPipeline.js`
- `taxflow-api/src/services/reviewService.js`

**Changes:**
1. Check `boxService.getTier()` before any metadata create/update call
2. If free tier: skip metadata operations, log once, rely on DB for state
3. Remove noisy console.error on every failed metadata call

**Tests required:**
- Free tier: no metadata API calls attempted
- Enterprise tier: metadata operations proceed normally
- Log message on startup indicates which mode is active

---

### Task 3.3: Employee Listing from Local DB

**Files modified:**
- `taxflow-api/src/services/employeeService.js`

**Changes:**
1. `listEmployees()` → query `users` table WHERE role IN ('employee', 'superadmin')
2. Remove the `getUsers({ userType: 'all' })` + client-side filter approach
3. Employee creation already syncs to local DB (via onboarding route) — verify this is solid

**Tests required:**
- listEmployees returns from DB (no Box API call)
- Newly created employee appears in list
- Performance: O(1) query regardless of total Box users

---

### Task 3.4: Cache Invalidation on Write Operations

**Files modified:**
- `taxflow-api/src/services/cacheLayer.js`
- `taxflow-api/src/services/reviewService.js`
- `taxflow-api/src/services/postUploadPipeline.js`
- `taxflow-api/src/routes/documents.js`

**Changes:**
1. Add `invalidate(keyPattern)` method to cacheLayer:
```javascript
invalidate(prefix) {
  for (const key of this._cache.keys()) {
    if (key.startsWith(prefix)) this._cache.delete(key);
  }
}
```

2. After document upload: `cacheLayer.invalidate('portal:client:' + clientId)`
3. After status transition: invalidate both client and employee portal caches
4. After approval: invalidate affected caches

**Tests required:**
- Cache hit before invalidation → returns cached data
- Write operation → cache invalidated → next read fetches fresh data
- Pattern-based invalidation works (prefix matching)

---

### Task 3.5: Search API Pagination for Vault Lookup

**Files modified:**
- `box-wrapper-service/src/services/BoxWrapperService.ts`

**Changes:**
1. Add `limit: 100` to search call
2. Add exact match validation on returned results (current code does this — verify)
3. Add caching: once a vault is found, cache the mapping `externalId → folderId`

**Tests required:**
- Search returns paginated results
- Exact match filtering works (no false positives from partial matches)
- Cached result returned on second lookup (no API call)

---

### Sprint 3 Completion Criteria
- [ ] Post-upload pipeline uses path_collection (0 API calls for context)
- [ ] Free tier: zero metadata API calls attempted
- [ ] Employee list: DB query only
- [ ] Cache invalidated on writes → portal shows fresh data
- [ ] Vault lookup cached after first resolution
- [ ] Full test suite passes

---

## Sprint 4: Monitoring & Polish

**Goal:** Observability into Box API health and webhook reliability.

### Task 4.1: Box API Health Check

**Files modified:**
- `taxflow-api/src/server.js`
- `taxflow-api/src/services/boxService.js`

**Changes:**
1. Add `healthCheck()` method to boxService:
   - Call `GET /users/me` (lightweight, 1 API call)
   - Cache result for 60 seconds
   - Return `{ connected: true, tier, enterpriseId, serviceAccountName }`
2. Update `/health` endpoint:
```javascript
app.get('/health', async (req, res) => {
  const boxHealth = await boxService.healthCheck().catch(err => ({
    connected: false, error: err.message
  }));
  res.json({
    status: boxHealth.connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    box: boxHealth,
  });
});
```

**Tests required:**
- Healthy Box connection → `{ status: 'ok', box: { connected: true } }`
- Box API unreachable → `{ status: 'degraded', box: { connected: false } }`
- Health check cached (second call within 60s doesn't hit API)

---

### Task 4.2: Webhook Health Monitoring

**Files modified:**
- `taxflow-api/src/services/webhookService.js`

**Changes:**
1. Add `verifyWebhooksHealthy()` method:
   - `GET /webhooks` → list all registered webhooks
   - Compare against `webhook_keys` DB table
   - Identify missing webhooks (registered in DB but not in Box)
   - Re-register missing webhooks automatically
   - Log discrepancies
2. Call on server startup (after boxService initialization)
3. Optionally: periodic check (configurable interval, default disabled)

**Tests required:**
- All webhooks present → healthy, no re-registration
- Webhook missing from Box → automatically re-registered
- Box API error during check → logged, not fatal

---

### Sprint 4 Completion Criteria
- [ ] Health endpoint reports Box connectivity and tier
- [ ] Missing webhooks detected and re-registered on startup
- [ ] Full test suite passes
- [ ] All 4 sprints complete → system ready for end-to-end verification (Phase 6)

---

## Testing Strategy

### Unit Tests (per-function, mocked dependencies)
- **Framework:** Vitest (already configured)
- **Coverage targets:** All new/modified functions
- **Mocking:** Box SDK client mocked for all unit tests (no live API calls)
- **Property-based:** fast-check for input validation (password formats, externalId parsing)

### Integration Tests (service-level, real DB, mocked Box)
- **Scope:** Full service call chains (e.g., login → verify → migrate hash → update DB)
- **DB:** Real SQLite (test database, reset between tests)
- **Box API:** Mocked responses matching documented response shapes

### End-to-End Tests (Phase 6 — live Box sandbox)
- **Scope:** Full user flows against real Box API
- **Documented in:** FLOW_VERIFICATION.md (Phase 6 deliverable)

### Test Execution Rules
1. Run `npm run test` in both `box-wrapper-service` and `taxflow-api` after every task
2. All tests must pass before marking a task complete
3. New code requires new tests (no exceptions)
4. Test descriptions must state what is being verified, not how

---

## Security Architecture

### Secrets Management

| Secret | Storage Location | Access Pattern |
|--------|-----------------|----------------|
| Box private key | Environment variable `BOX_PRIVATE_KEY` | Loaded at startup by config.js |
| Box passphrase | Environment variable `BOX_PASSPHRASE` | Loaded at startup |
| Box client secret | Environment variable `BOX_CLIENT_SECRET` | Loaded at startup |
| Deep link secret | Environment variable `DEEP_LINK_SECRET` | Used in deepLinkTokenService |
| Webhook signature keys | DB table `webhook_keys` | Loaded into memory on startup |
| User passwords | DB column `users.password_hash` | Verified on login only |
| Session tokens | DB table `sessions` | Generated on login, validated on request |

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ Service Account Token (full scope)                               │
│ • Generated by JWT auth on startup                               │
│ • Cached 50 minutes (of 60-min TTL)                             │
│ • Used for: folder ops, metadata, webhooks, admin actions        │
├─────────────────────────────────────────────────────────────────┤
│ Downscoped Preview Token (item_preview + resource-restricted)    │
│ • Generated on demand for Box Content Preview                    │
│ • Cached per file+user for 50 minutes                           │
│ • Used for: client/employee file preview in browser              │
├─────────────────────────────────────────────────────────────────┤
│ Downscoped Upload Token (item_upload + folder-restricted)        │
│ • Generated on demand for upload widgets                         │
│ • Short-lived, not cached                                        │
│ • Used for: (future) client-side direct upload to Box            │
└─────────────────────────────────────────────────────────────────┘
```

### Webhook Security Flow

```
Box sends webhook →
  1. Extract BOX-DELIVERY-TIMESTAMP header
  2. Reject if timestamp > 10 minutes old (replay protection)
  3. Compute HMAC-SHA256(key, body + timestamp)
  4. Base64 encode
  5. Timing-safe compare against BOX-SIGNATURE-PRIMARY/SECONDARY
  6. Try all stored key pairs (for key rotation support)
  7. Accept or reject (403)
  8. Always respond 200 after acceptance (prevent Box retry storms)
```

---

## Data Flow Diagrams

### Upload Flow (Post-Fix)

```
Client → POST /api/documents/upload (multipart)
  │
  ├─ file.size < 20MB?
  │   ├─ YES → Direct upload to Box (single request)
  │   └─ NO  → Chunked upload:
  │              1. Save to disk temp
  │              2. Create upload session
  │              3. Upload parts (8MB, parallel)
  │              4. Commit with SHA-1
  │              5. Clean up temp file
  │
  ├─ Update document_requests (status=Uploaded, box_file_id)
  │
  ├─ Invalidate portal cache for clientId
  │
  └─ Response: { file: { id, name, size } }

Box webhook → FILE.UPLOADED → POST /api/webhooks/box
  │
  ├─ Verify HMAC(body + timestamp) — reject if invalid
  │
  ├─ Extract context from path_collection (0 API calls)
  │
  ├─ Apply taxflow_document metadata (enterprise tier only)
  │
  ├─ Trigger Box AI extraction (fire-and-forget)
  │
  ├─ Create review task + assign
  │
  └─ Dispatch in-app notification (DB-persisted)
```

### Authentication Flow (Post-Fix)

```
Client → POST /api/auth/login { email, password }
  │
  ├─ DB lookup: SELECT * FROM users WHERE email = ?
  │   └─ Not found → 401
  │
  ├─ Detect hash format:
  │   ├─ Starts with $2b$ → bcrypt.compare(password, hash)
  │   └─ Starts with pw: → SHA256(password) == extracted_hash?
  │       └─ If valid: re-hash with bcrypt, UPDATE users
  │
  ├─ Generate session token (48 random bytes, base64url)
  │
  ├─ INSERT INTO sessions (token, user_id, expires_at = now + 1hr)
  │
  ├─ Load client_vaults if role=client
  │
  └─ Response: { sessionToken, user, expiresAt, vault? }
```

---

## Dependency Changes

| Package | Action | Version | Purpose |
|---------|--------|---------|---------|
| `bcrypt` | ADD | ^6.0.0 | Password hashing (native C++ binding, well-maintained) |

No other new dependencies required. The Node SDK already supports chunked uploads natively.

---

## File Changes Summary (All Sprints)

| Sprint | Files Modified | Files Created | Tests Added |
|--------|---------------|---------------|-------------|
| 1 | webhookService.js, webhooks.js, authService.js, authUtils.js, onboardingService.js, employeeService.js, package.json, .gitignore | box_config.example.json | ~20 tests |
| 2 | boxService.js, notificationService.js, statusTransitionService.js, documents.js, uploadService.js | — | ~25 tests |
| 3 | postUploadPipeline.js, reviewService.js, employeeService.js, cacheLayer.js, BoxWrapperService.ts | — | ~15 tests |
| 4 | server.js, boxService.js, webhookService.js | — | ~8 tests |
| **Total** | **~18 files** | **1 file** | **~68 tests** |

---

## Sprint Execution Checklist (Applied to Each Sprint)

For every sprint:
1. ☐ Read relevant Box documentation for each task (research checkpoint)
2. ☐ Implement changes (no placeholders, no TODOs)
3. ☐ Write tests for all new/modified behavior
4. ☐ Run full test suite (`npm run test` in both services)
5. ☐ All tests pass (zero failures)
6. ☐ Self-review against Box docs and implementation plan
7. ☐ Update FEATURE_INVENTORY.md with new status
8. ☐ Flag any deviation from plan (justify and get approval)
9. ☐ Sprint marked complete only when all criteria met

---

*This plan is the contract for implementation. No deviation without explicit justification and approval. Every decision traces to BOX_RESEARCH.md or approved Phase 3 discussion outcomes.*
