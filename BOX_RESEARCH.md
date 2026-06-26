# Box Platform — Exhaustive Research Document

**Generated:** Phase 2, June 26, 2026
**Source:** Official Box Developer Documentation (developer.box.com)
**API Version:** v2026.0

Content was rephrased for compliance with licensing restrictions. All information sourced from official Box developer documentation.

---

## 1. Box Platform Architecture

### 1.1 What Box Platform Is

Box Platform is a set of APIs and tools that allows developers to integrate Box's content management capabilities into custom applications. It provides secure file storage, real-time collaboration, and enterprise-grade governance features through a RESTful API.

**Source:** [Box Platform 101](https://developer.box.com/platform/box-platform-101.md)

### 1.2 Object Model

Box's core object model consists of:

| Object | Description |
|--------|-------------|
| **Files** | Documents, images, and any binary content stored in Box |
| **Folders** | Hierarchical containers for files and other folders |
| **Users** | Identities — Managed Users, External Users, App Users, Service Accounts |
| **Collaborations** | Permission grants linking users/groups to files/folders |
| **Metadata** | Structured key-value data attached to files/folders via templates |
| **Comments** | Threaded discussions on files |
| **Tasks** | Actionable items assigned to users on files |
| **Events** | Audit trail of all actions in the enterprise |
| **Webhooks** | Real-time HTTP notifications on content events |
| **Groups** | Collections of users for bulk collaboration |
| **Collections** | User-curated lists of items (favorites) |
| **Web Links** | Bookmarks stored as items in the folder tree |

**Source:** [API Reference Resources](https://developer.box.com/reference/index.md)

### 1.3 User Types

| Type | Description | API Applicable |
|------|-------------|----------------|
| **Admin** | Full enterprise control | Yes |
| **Co-Admin** | Delegated admin privileges | Yes |
| **Managed User** | Standard enterprise user with Box login | Yes |
| **External User** | Collaborator from outside the enterprise | Yes |
| **Service Account** | Auto-generated admin-level identity for JWT/CCG apps | Yes |
| **App User** | Platform-only user (no Box login), managed by applications | Yes |

**Source:** [User Types](https://developer.box.com/platform/user-types.md)

### 1.4 Permissions Model — Collaboration Roles

| Role | View | Download | Upload | Edit | Delete | Share | Invite | Remove Collabs |
|------|------|----------|--------|------|--------|-------|--------|----------------|
| Co-owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Viewer Uploader | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Viewer | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Previewer Uploader | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Previewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Uploader | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

- All accounts: Editor and Viewer roles available by default.
- Business/Enterprise accounts: Co-owner, Previewer, Uploader, Viewer Uploader, Previewer Uploader roles must be enabled in Admin Console.
- Collaboration permissions cascade: a collaborator on a parent folder has the same access to all descendant content.

**Source:** [Understanding Collaborator Permission Levels](https://support.box.com/hc/en-us/articles/360044196413)

### 1.5 Compliance & Data Residency

- **FedRAMP:** Box holds FedRAMP Moderate authorization for US government workloads.
- **HIPAA/HITECH:** Box supports BAAs for healthcare data.
- **SOC 1/2/3, ISO 27001, ISO 27018:** Enterprise compliance certifications.
- **GDPR:** Box provides data processing agreements and EU data residency via Box Zones.
- **Box Zones:** Enterprise feature allowing data storage in specific geographic regions (US, Canada, EU, Japan, Australia, Singapore, Germany, France, UK).
- **Box Shield:** Advanced security with smart access policies, malware detection, anomaly detection.
- **Box Governance:** Retention policies, legal holds, and disposition workflows.

**Source:** [Security](https://developer.box.com/guides/security/index.md), [FedRAMP](https://developer.box.com/guides/security/fedramp.md)

---

## 2. Authentication

### 2.1 Authentication Methods Overview

| Method | Use Case | Requires User Interaction | App Type |
|--------|----------|---------------------------|----------|
| **JWT (Server Auth)** | Server-to-server, no end-user | No | Platform App |
| **Client Credentials Grant** | Server-to-server, simpler (no key pair) | No | Platform App |
| **OAuth 2.0 (3-legged)** | User-facing apps where users authenticate | Yes | Platform App or Integration |
| **Developer Token** | Testing only (60-min expiry) | Manual | Any |

**Source:** [Authentication](https://developer.box.com/guides/authentication/index.md)

### 2.2 JWT Authentication (Our Method)

JWT is the correct authentication method for TaxFlow because:
- Works with users that don't have a Box account (App Users)
- Uses our own identity system
- Users don't need to know they're using Box
- Data stored in the application's Box account

**Flow:**
1. Application constructs a JWT assertion with the app's private key
2. JWT assertion is exchanged for an Access Token via `POST /oauth2/token`
3. Token grants access as the Service Account (admin-level)
4. To act as a specific user: use `as-user` header OR generate a User Access Token

**Key details:**
- Service Account is auto-generated on JWT app authorization
- Requires Box Admin approval before use
- Private key must be stored securely (never in client-side code)
- Supports key pair rotation

**Source:** [JWT Auth](https://developer.box.com/guides/authentication/jwt/index.md)

### 2.3 Client Credentials Grant (Alternative)

Simpler server-to-server auth without a key pair:
- Uses only `client_id` and `client_secret`
- Set `grant_type` to `client_credentials`
- Set `box_subject_type` to `enterprise` and `box_subject_id` to enterprise ID for Service Account
- Set `box_subject_type` to `user` and `box_subject_id` to user ID for user-level access
- Requires 2FA enabled on Box admin account to view client secret
- Less secure than JWT (secret only vs. key pair)

**Source:** [Client Credentials Grant](https://developer.box.com/guides/authentication/client-credentials/index.md)

### 2.4 Token Downscoping

Exchange a fully-scoped token for a restricted one with fewer permissions and optional resource restriction.

**Parameters:**
- `subject_token`: The original token to downscope
- `subject_token_type`: Always `urn:ietf:params:oauth:token-type:access_token`
- `grant_type`: Always `urn:ietf:params:oauth:grant-type:token-exchange`
- `scope`: Space-delimited list of scopes
- `resource`: Optional full URL to restrict to (e.g., `https://api.box.com/2.0/files/12345`)

**Available downscope scopes:**

| Scope | Description |
|-------|-------------|
| `item_preview` | Preview the file |
| `item_download` | Download files/folders |
| `item_upload` | Upload to specified folder |
| `item_rename` | Rename items |
| `item_delete` | Delete items |
| `item_share` | Share items |
| `base_preview` | Basic preview only |
| `base_explorer` | Content explorer access |
| `base_picker` | Content picker access |
| `base_upload` | Upload to specified resource |
| `annotation_edit` | Edit/delete annotations |
| `annotation_view_all` | View all annotations |
| `annotation_view_self` | View own annotations only |

**Important:** Downscoped tokens do NOT include a refresh token. To get a new one, refresh the original token first.

**Source:** [Downscope a Token](https://developer.box.com/guides/authentication/tokens/downscope.md)

### 2.5 Authentication Best Practices

1. **Client secret security:** Never expose in email, forums, repos, client-side code, or native apps.
2. **Cache tokens:** Access Tokens valid for 60 minutes. Cache at ~50 minutes to allow buffer.
3. **Handle 401 errors:** Expired tokens return 401. Implement refresh logic.
4. **Downscope for client-side:** Always downscope tokens before exposing to browser/mobile.
5. **Revoke tokens:** Revoke when user logs out or on suspicious activity.
6. **Developer tokens are for testing only:** 60-minute expiry, never use in production.

**Source:** [Authentication Best Practices](https://developer.box.com/guides/authentication/best-practices.md)

---

## 3. Content API

### 3.1 Files

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Get file info | `GET /files/{id}` | Use `fields` param to select specific attributes |
| Download | `GET /files/{id}/content` | Returns 302 redirect to download URL |
| Upload (new) | `POST /files/content` | Multipart form, max ~50MB for direct upload |
| Upload (version) | `POST /files/{id}/content` | Creates new version |
| Copy | `POST /files/{id}/copy` | Copy to specified folder |
| Delete | `DELETE /files/{id}` | Moves to trash (30 days) |
| Permanently delete | `DELETE /files/{id}/trash` | Irreversible |
| Get thumbnail | `GET /files/{id}/thumbnail.{ext}` | PNG or JPG |
| Preflight check | `OPTIONS /files/content` | Verify upload will succeed before sending data |

**File limitations:** Maximum 150GB per file for Enterprise accounts.

**Source:** [Files](https://developer.box.com/guides/files/index.md), [Downloads](https://developer.box.com/guides/downloads/index.md)

### 3.2 Chunked Uploads

For files **20MB or larger** (minimum threshold, not 50MB as our code assumes).

**Flow:**
1. `POST /files/upload_sessions` — Create upload session (specifies file name, size, parent folder)
2. `PUT /files/upload_sessions/{id}` — Upload individual parts (chunks)
3. `POST /files/upload_sessions/{id}/commit` — Commit session with part list and SHA-1 digest

**Key details:**
- Minimum file size: **20MB** (API rejects smaller files)
- Session lifetime: **7 days**
- Parts are immutable — cannot re-upload a part
- Parts can be uploaded in parallel (performance benefit)
- SDKs handle chunking automatically
- SHA-1 digest required at commit for integrity verification

**Source:** [Chunked Uploads](https://developer.box.com/guides/uploads/chunked/index.md)

### 3.3 Folders

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Create | `POST /folders` | Name + parent ID |
| Get info | `GET /folders/{id}` | |
| List items | `GET /folders/{id}/items` | Paginated (marker-based or offset) |
| Copy | `POST /folders/{id}/copy` | |
| Delete | `DELETE /folders/{id}` | Recursive option |
| Update/move/rename | `PUT /folders/{id}` | |
| Create lock | `POST /folder_locks` | Prevent move/delete |
| Delete lock | `DELETE /folder_locks/{id}` | |
| Get locks | `GET /folder_locks?folder_id={id}` | |

**Folder locks:** Prevent move and/or delete operations. Requires Business Plus or Enterprise.

**Source:** [Folders](https://developer.box.com/guides/folders/index.md)

### 3.4 Shared Links

- Created/updated via `PUT /files/{id}` or `PUT /folders/{id}` with `shared_link` field
- Access levels: `open` (public), `company` (enterprise-only), `collaborators` (existing collaborators only)
- Options: password protection, expiration date, download permission control
- Vanity URLs available on Enterprise plans

**Source:** [Shared Links](https://developer.box.com/guides/shared-links/index.md)

### 3.5 Representations

- PDF, text, thumbnail, and markdown representations of stored files
- Available via `GET /files/{id}?fields=representations`
- Representations are generated asynchronously
- Useful for document preview without downloading original

**Source:** [Representations](https://developer.box.com/guides/representations/index.md)

---

## 4. Metadata API

### 4.1 Templates

- **Scope:** `enterprise` (private to enterprise) or `global` (built-in by Box)
- **Field types:** string, float, date, enum, multiSelect
- **Operations:** Create, get, update (add/remove/reorder fields), delete
- **Limit:** Template key is immutable after creation
- Templates are enterprise-wide — one template can be applied to any file/folder

**Source:** [Metadata Templates](https://developer.box.com/guides/metadata/templates/index.md)

### 4.2 Instances

- An instance is a specific application of a template to a file or folder
- Create: `POST /files/{id}/metadata/{scope}/{template}`
- Update: `PUT /files/{id}/metadata/{scope}/{template}` using JSON Patch operations
- Delete: `DELETE /files/{id}/metadata/{scope}/{template}`
- List all on item: `GET /files/{id}/metadata`

**JSON Patch operations:** `add`, `replace`, `remove`, `test`, `move`, `copy`

**Source:** [Metadata Instances](https://developer.box.com/guides/metadata/instances/index.md)

### 4.3 Cascade Policies

- Apply a metadata template from a folder to all items within it
- `POST /metadata_cascade_policies` — Create cascade
- `POST /metadata_cascade_policies/{id}/apply` — Force-apply to existing items
- When new items are added to the folder, metadata is automatically applied
- **Requires Enterprise plan**

**Source:** [Metadata Cascade Policies](https://developer.box.com/guides/metadata/cascades/index.md)

### 4.4 Metadata Queries

- `POST /metadata_queries/execute_read` — Query files/folders by metadata values
- More precise than search API for structured metadata lookups
- Supports: equality, comparison, logical operators, sorting
- Requires specifying `from` (template), `query`, `query_params`, `ancestor_folder_id`
- Supports marker-based pagination
- **Requires Enterprise plan** for enterprise-scoped templates

**Source:** [Metadata Queries](https://developer.box.com/guides/metadata/queries/index.md)

### 4.5 Classifications

- Built-in metadata template: `securityClassification-6VMVochwUWo`
- Standard levels: Public, Internal, Confidential (enterprise-configurable)
- Applied/updated via metadata instance API
- **Requires Box Shield or Enterprise**

**Source:** [Classifications](https://developer.box.com/guides/metadata/classifications.md)

---

## 5. Events & Webhooks

### 5.1 Enterprise Events

- `GET /events?stream_type=admin_logs` — Historical enterprise audit trail
- `GET /events?stream_type=admin_logs_streaming` — Real-time enterprise events
- Filterable by event type (UPLOAD, DOWNLOAD, PREVIEW, DELETE, COLLABORATION, etc.)
- Stream position-based pagination
- Retention: Box retains enterprise events for 1 year

**Source:** [Enterprise Events](https://developer.box.com/guides/events/enterprise-events/index.md)

### 5.2 User Events

- `GET /events` — Events for the authenticated user
- Supports long-polling via `OPTIONS /events` for real-time notifications
- Stream types: `all` (all events), `changes` (content changes only), `sync` (sync-relevant events)

**Source:** [User Events](https://developer.box.com/guides/events/user-events/index.md)

### 5.3 V2 Webhooks

**Creation:** `POST /webhooks`
```json
{
  "target": { "id": "folder_id", "type": "folder" },
  "triggers": ["FILE.UPLOADED", "FILE.DELETED"],
  "address": "https://your-server.com/webhook"
}
```

**Webhook payload headers:**
- `BOX-DELIVERY-ID` — Unique delivery ID (changes on retry)
- `BOX-DELIVERY-TIMESTAMP` — RFC-3339 timestamp
- `BOX-SIGNATURE-PRIMARY` — HMAC-SHA256 signature (primary key)
- `BOX-SIGNATURE-SECONDARY` — HMAC-SHA256 signature (secondary key)
- `BOX-SIGNATURE-VERSION` — Always `1`
- `BOX-SIGNATURE-ALGORITHM` — Always `HmacSHA256`

**Signature verification (CRITICAL — our implementation is incomplete):**
1. Validate `BOX-DELIVERY-TIMESTAMP` is not older than 10 minutes
2. Compute HMAC-SHA256 of: `body_bytes + timestamp_bytes` (concatenated)
3. Base64 encode the result
4. Compare with timing-safe comparison to header value

**⚠️ FINDING: Our current implementation does NOT include the timestamp in the HMAC calculation. This is a security gap.**

**Retries:** Box retries up to **12 times over 2 hours** if no 2xx response within 30 seconds.

**Source:** [V2 Webhooks](https://developer.box.com/guides/webhooks/v2/index.md), [Signature Verification](https://developer.box.com/guides/webhooks/v2/signatures-v2.md)

### 5.4 Webhook Limitations

| Limitation | Detail |
|------------|--------|
| One webhook per item per app per user | Cannot have two webhooks on same folder for same app |
| Max 1000 webhooks per app per user | Use higher-level folders to reduce count |
| HTTPS only, port 443 | No HTTP, no custom ports |
| TLS 1.2 or 1.3 required | With FIPS-compliant cipher suites |
| No self-signed certificates | Must use reputable CA |
| **No webhooks on root folder (ID 0)** | Must use v1 webhooks for root |
| `NO_ACTIVE_SESSION` | If auth session expires, webhooks send empty payloads |
| Auto-deletion after 30 days | If no successful delivery for 30 days + 14 days since last trigger |

**Source:** [Webhook Limitations](https://developer.box.com/guides/webhooks/v2/limitations-v2.md)

---

## 6. Collaborations, Users & Groups

### 6.1 Collaborations

- `POST /collaborations` — Invite user (by ID, login email, or group) to file/folder
- Roles: owner, co-owner, editor, viewer_uploader, previewer_uploader, viewer, previewer, uploader
- 409 conflict if collaboration already exists
- Pending collaborations require acceptance (for external users)
- Inherited: collaboration on parent applies to all descendants

**Source:** [Collaborations](https://developer.box.com/guides/collaborations/index.md)

### 6.2 Users

- `POST /users` — Create managed user or app user
- `GET /users` — List enterprise users (paginated)
- `GET /users/me` — Current user
- App Users: `isPlatformAccessOnly: true` — no Box login, managed entirely via API
- `externalAppUserId` field: link to external identity system (max 255 chars)
- `as-user` header: Act on behalf of another user (requires admin privileges)

**Source:** [Users](https://developer.box.com/guides/users/index.md)

### 6.3 Groups

- `POST /groups` — Create group
- `POST /group_memberships` — Add user to group
- Groups can be used as collaboration targets (one collaboration grants access to all members)
- Enterprise-level feature

**Source:** [Collaborations with Groups](https://developer.box.com/guides/collaborations/groups.md)

---

## 7. Sign, Tasks, Comments, Retention & Legal Holds

### 7.1 Box Sign

- `POST /sign_requests` — Create sign request
- `POST /sign_requests/{id}/cancel` — Cancel
- `POST /sign_requests/{id}/resend` — Resend
- Sign templates available for reusable field configurations
- Embedded signing: `is_document_preparation_needed: false` + retrieve `embed_url` from signer object
- Redirect URLs configurable per request
- Rate limit: 100 create/resend per minute per user
- Signed copies automatically stored in designated parent folder

**Source:** [Box Sign](https://developer.box.com/guides/box-sign/index.md)

### 7.2 Tasks

- `POST /tasks` — Create task on a file (action: `review` or `complete`)
- `POST /task_assignments` — Assign task to user
- `PUT /task_assignments/{id}` — Update assignment status (incomplete, complete, approved, rejected)
- `GET /files/{id}/tasks` — List tasks on a file
- Completion rules: `all_assignees` or `any_assignee`
- Due dates supported

**Source:** [Tasks](https://developer.box.com/guides/tasks/index.md)

### 7.3 Comments

- `POST /comments` — Create comment on file
- Supports `tagged_message` for @mentions (format: `@[user_id:user_name]`)
- `GET /files/{id}/comments` — List comments on file
- Comments can be replies (via `item` pointing to parent comment)

**Source:** [Comments](https://developer.box.com/guides/comments/index.md)

### 7.4 Retention Policies

- `POST /retention_policies` — Create policy (finite or indefinite)
- `POST /retention_policy_assignments` — Assign to folder, enterprise, or metadata template
- Types: `finite` (days) or `indefinite`
- Disposition actions: `permanently_delete` or `remove_retention`
- Cannot be deleted while assigned (must remove assignments first)
- **Requires Box Governance add-on**

**Source:** [Retention Policies](https://developer.box.com/guides/retention-policies/index.md)

### 7.5 Legal Holds

- `POST /legal_hold_policies` — Create policy
- `POST /legal_hold_policy_assignments` — Assign to file, folder, or user
- `DELETE /legal_hold_policy_assignments/{id}` — Release hold
- Files under legal hold cannot be deleted or permanently purged
- **Requires Box Governance add-on**

**Source:** [Legal Holds](https://developer.box.com/guides/legal-holds/index.md)

---

## 8. Box AI API

### 8.1 Available AI Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /ai/ask` | Ask questions about file content (single or multi-item) |
| `POST /ai/extract` | Freeform metadata extraction from files |
| `POST /ai/extract_structured` | Structured extraction against a metadata template |
| `POST /ai/text_gen` | Generate text based on file content |
| `POST /ai/agents` | Create custom AI agent |
| `GET /ai/agents` | List AI agents |
| `PUT /ai/agents/{id}` | Update AI agent |
| `DELETE /ai/agents/{id}` | Delete AI agent |

### 8.2 Structured Extraction

Used for extracting typed data from documents into metadata template fields:
```json
{
  "items": [{ "type": "file", "id": "12345" }],
  "metadata_template": {
    "template_key": "taxflow_document",
    "scope": "enterprise"
  },
  "fields": [
    { "key": "document_type", "type": "string", "description": "..." }
  ]
}
```

### 8.3 AI Models Available

Box AI supports multiple model providers (configurable per request via agent overrides):
- **AWS Claude** (4.5-4.8 Haiku, Sonnet, Opus variants)
- **Google Gemini** (2.0 Flash, 2.5 Flash/Pro, 3.x series)
- **OpenAI GPT** (5.x series, o3)
- **IBM** (Llama 4 Maverick, Mistral variants)
- Azure text-embedding-ada-002 (embeddings)

### 8.4 AI Scope

Requires `ai.readwrite` scope on the application.

**Source:** [Box AI](https://developer.box.com/guides/box-ai/index.md), [AI Models](https://developer.box.com/guides/box-ai/ai-models/index.md)

---

## 9. SDKs, CLI & Rate Limits

### 9.1 Node.js SDK

**Current recommendation:** Install via `npm install box` (unified package with SDK + CLI).
**Legacy:** `npm install box-node-sdk` (standalone, still supported).

- The `box` package requires Node.js 22+
- `box-node-sdk` works with older Node versions
- TypeScript types included
- Supports JWT, OAuth 2.0, and Client Credentials Grant
- Built-in token caching
- Automatic retry on 429/5xx (configurable)

**Source:** [Install Node SDK](https://developer.box.com/guides/tooling/sdks/node.md)

### 9.2 Box CLI

- Installed alongside SDK via `npx box <command>`
- Supports JWT authentication
- Useful for admin scripts, migrations, bulk operations
- PowerShell script templates available

**Source:** [CLI](https://developer.box.com/guides/cli/index.md)

### 9.3 Rate Limits

| Category | Limit |
|----------|-------|
| General API calls | **1000 requests/minute/user** |
| File uploads | **240 uploads/minute/user** |
| Search | **6 searches/second/user**, 60/minute/user, 12/second/enterprise |
| Box Sign (create/resend) | **100 requests/minute/user** |
| Box Sign (get) | **1000 requests/minute/user** |

**On rate limit hit:**
- HTTP 429 response
- `retry-after` header indicates seconds to wait
- Recommended strategy: exponential backoff

**Licensing-based limits:** Enterprise plans have monthly API call allocations. Exceeding triggers additional throttling.

**Quality of service limits:** Box may impose temporary limits during infrastructure contention.

**Source:** [Rate Limits](https://developer.box.com/guides/api-calls/permissions-and-errors/rate-limits.md)

### 9.4 Error Taxonomy

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 400 | Bad Request | Malformed JSON, missing required fields, invalid field values |
| 401 | Unauthorized | Expired/invalid token |
| 403 | Forbidden | Insufficient permissions, scope missing, feature not available on plan |
| 404 | Not Found | Item doesn't exist or user has no access |
| 405 | Method Not Allowed | Wrong HTTP method for endpoint |
| 409 | Conflict | Item with same name exists, collaboration already exists |
| 429 | Rate Limited | Too many requests (see `retry-after` header) |
| 500 | Internal Error | Box server error (retry with backoff) |
| 503 | Service Unavailable | Temporary outage (retry with backoff) |

**409 Conflict pattern:** Many creation endpoints return 409 if the item already exists. The `context_info.conflicts` field in the response often contains the existing item's ID.

**Source:** [Status Codes](https://developer.box.com/guides/api-calls/status-codes.md)

### 9.5 Pagination

Two pagination styles:
1. **Marker-based** (preferred): Uses `marker` parameter, returned via `next_marker` in response
2. **Offset-based** (legacy): Uses `offset` and `limit` parameters

Metadata queries use marker-based pagination exclusively.

**Source:** [Pagination](https://developer.box.com/guides/api-calls/pagination/index.md)

---

## 10. Application Scopes

Scopes determine what API endpoints an application can call. Configured in Developer Console.

### Self-Service Scopes

| Scope | OAuth Name | Grants |
|-------|------------|--------|
| Read all files/folders | `root_readonly` | Read access to authenticated user's content |
| Read/write all files/folders | `root_readwrite` | Full CRUD on content |
| Manage users | `manage_managed_users` + `manage_app_users` | Create/update/delete users |
| Manage groups | `manage_groups` | Group CRUD + membership |
| Manage webhooks | `manage_webhook` | Create/manage webhooks (max 1000/app/user) |
| Manage enterprise properties | `manage_enterprise_properties` | Events stream, enterprise attributes |
| Manage retention policies | `manage_data_retention` | Requires Box Governance + `enterprise_content` scope |
| Manage signature requests | `sign_requests.readwrite` | Box Sign operations |
| Manage AI | `ai.readwrite` | Box AI API access |
| Manage Box Relay | `manage_triggers` | Workflow triggers |

### Request-Only Scopes

| Scope | Grants | Requirements |
|-------|--------|--------------|
| `manage_legal_holds` | Legal hold policies | Box Governance + `enterprise_content` |
| `enterprise_content` (GCM) | Admin access to all enterprise content | Dangerous — changes API behavior |
| Suppress notifications | Hide email notifications from API actions | |

**Source:** [Scopes](https://developer.box.com/guides/api-calls/permissions-and-errors/scopes.md)

---

## 11. Security Best Practices (Box-Specific)

### 11.1 Token Security
- Cache tokens at 50-minute TTL (tokens expire at 60 minutes)
- Always downscope before exposing to client-side
- Revoke tokens on logout/suspicious activity
- No refresh tokens in downscoped tokens

### 11.2 Webhook Security
- **Always verify signatures** using HMAC-SHA256 with timing-safe comparison
- Include `BOX-DELIVERY-TIMESTAMP` in HMAC calculation (body + timestamp)
- Reject payloads older than 10 minutes (replay protection)
- Rotate signature keys periodically (two keys for smooth transition)

### 11.3 Service Account Security
- Service Account has admin-level access — treat its token as highly privileged
- Use `as-user` header or User Access Tokens for principle of least privilege
- Never expose Service Account tokens to client-side code
- Use downscoped tokens for UI Elements

### 11.4 Private Key Security
- Store JWT private keys in secure secret management (not in repos, not in env vars as plaintext)
- Rotate keys periodically (Box supports adding new key before removing old)
- Passphrase-protect private keys

### 11.5 Application Design
- Use App Users for client isolation (each client gets their own identity)
- Folder collaborations enforce access at the Box level (defense in depth)
- Metadata cascade policies reduce per-file metadata management overhead
- Use folder locks to prevent accidental deletion of critical structures

---

## 12. Relevant Architecture Patterns for TaxFlow

### 12.1 Recommended Pattern: Per-Client App Users with Folder Isolation

Based on Box's official architecture patterns, the correct design for a multi-client document platform:

1. **Service Account** owns all content (root folder)
2. **App Users** created for each client (platform-access-only)
3. **Collaborations** grant App Users access only to their specific folders
4. **Folder structure** provides logical separation
5. **Metadata** on files enables cross-client querying by the Service Account

This is exactly what TaxFlow implements.

### 12.2 Token Strategy for Our Use Case

| Context | Token Type |
|---------|------------|
| Server-side operations (create folders, metadata, webhooks) | Service Account token (full scope) |
| Client-facing file preview | Downscoped token (`item_preview`, resource-restricted) |
| Client upload operations | Downscoped token (`item_upload`, folder-restricted) |
| Admin dashboards (metadata queries) | Service Account token |
| Box AI extraction | Service Account token with `ai.readwrite` scope |

### 12.3 Event-Driven Architecture

Correct pattern for Box event processing:
- **Webhooks** for real-time file-level events (per-folder, immediate notification)
- **Enterprise Events API** for audit/compliance (historical, enterprise-wide)
- **User Events + Long Polling** for real-time user activity monitoring

TaxFlow correctly uses webhooks for post-upload automation and Events API for inactive client detection.

---

## 13. Critical Findings — Impacts on TaxFlow

### 13.1 Webhook Signature Verification is INCOMPLETE

**Issue:** Box's official documentation specifies that HMAC must be calculated over `body_bytes + timestamp_bytes`. Our current implementation in `webhookService.js` only uses `body` (without appending the `BOX-DELIVERY-TIMESTAMP`).

**Risk:** Potential replay attacks. Missing timestamp validation (10-minute window check).

**Correct implementation:**
```javascript
const crypto = require('crypto');
const payload = rawBody; // Buffer
const timestamp = headers['box-delivery-timestamp'];

const hmac = crypto.createHmac('sha256', primaryKey);
hmac.update(payload);
hmac.update(timestamp);
const digest = hmac.digest('base64');
// Compare with timing-safe equal to BOX-SIGNATURE-PRIMARY
```

### 13.2 Chunked Upload Threshold is Wrong

**Issue:** Our architecture docs claim 50MB threshold. Box documentation states minimum **20MB** for chunked uploads.

**Impact:** Files between 20-50MB could benefit from chunked uploads (resumability, parallel parts) but are currently forced through single-request upload.

### 13.3 No Webhooks on Root Folder

**Issue:** Box v2 webhooks cannot be created on folder ID `0`. Our `BOX_ROOT_FOLDER_ID` defaults to `0`.

**Impact:** If root folder is `0`, webhook registration will fail. We must use a dedicated subfolder as the root (which we do — the per-client folders get their own webhooks).

### 13.4 Forced Free Tier Disables Enterprise Features

**Issue:** `boxService.js` hardcodes `this.tier = 'free'` regardless of detection.

**Impact:** Disables metadata templates, cascade policies, metadata queries, folder locks — all features that require Enterprise plan.

### 13.5 Token Caching Strategy Alignment

**Issue:** Box recommends caching at 50 minutes (of 60-minute TTL). Our `tokenService.js` caches at 90% TTL which is 54 minutes. This is acceptable but slightly aggressive.

---

## 14. Box Platform Plan Requirements

| Feature | Minimum Plan |
|---------|-------------|
| Files/Folders CRUD | All plans (including Free Developer) |
| Collaborations | All plans |
| Webhooks | All plans |
| Metadata templates (enterprise scope) | Business Plus / Enterprise |
| Metadata queries | Enterprise |
| Metadata cascade policies | Enterprise |
| Folder locks | Business Plus / Enterprise |
| Box Sign | Business Plus / Enterprise |
| Retention policies | Box Governance add-on |
| Legal holds | Box Governance add-on |
| Security classification (Shield) | Box Shield add-on |
| Box AI | Box AI add-on |
| Enterprise Events (admin_logs) | Business / Enterprise |
| App Users | Enterprise (with Platform) |

---

*This research document drives all architecture decisions for TaxFlow. No code change should be made without tracing the decision back to a section in this document or official Box documentation.*

*All content was rephrased for compliance with licensing restrictions. Direct citations link to official Box developer documentation pages.*
