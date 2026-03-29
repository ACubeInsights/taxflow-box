# Design Document: Frontend-Backend Integration

## Overview

This design connects the TaxFlow Pro React frontend (`taxflow-app`) to the Express.js backend (`taxflow-api`) by replacing all mock/hardcoded data paths with live API calls. The integration touches five layers:

1. **API Service Layer** — A centralized `api.js` module exporting typed API objects for every backend route group (onboarding, portal, reviews, tokens, sign, notifications, compliance).
2. **State Management** — Rewriting `DocumentWorkflowContext` to call real APIs for vault init, document fetching, and review actions.
3. **Dashboard Components** — Replacing hardcoded arrays (`CLIENTS`, `FIRMS`, `PREPARER_REQUESTS`, `TAX_STEPS`) with data fetched from portal endpoints.
4. **Mutation Components** — Wiring UploadDropzone, ReviewMode, and RequestCreatorDrawer to real backend mutations.
5. **Cross-Cutting Concerns** — Auth token injection, loading/error UX, notification polling, and preview token management.

The backend already has 8 route files (`onboarding`, `portal`, `reviews`, `tokens`, `sign`, `notifications`, `compliance`, `webhooks`) mounted on Express at port 3001. The frontend uses Vite with `VITE_API_URL` env var defaulting to `http://localhost:3001/api`.

## Architecture

```mermaid
graph TB
    subgraph "taxflow-app (React + Vite)"
        AuthCtx[AuthContext] -->|token| API[api.js Service Layer]
        DWCtx[DocumentWorkflowContext] -->|calls| API
        CD[ClientDashboard] -->|calls| API
        ED[EmployeeDashboard] -->|calls| API
        CXO[CXODashboard] -->|calls| API
        RM[ReviewMode] -->|calls| API
        UD[UploadDropzone] -->|calls| API
        RC[RequestCreatorDrawer] -->|calls| DWCtx
        TN[TopNav] -->|polls| API
    end

    subgraph "taxflow-api (Express, port 3001)"
        API -->|HTTP| Routes[Route Handlers]
        Routes --> Onboarding[/api/onboarding]
        Routes --> Portal[/api/portal/*]
        Routes --> Reviews[/api/reviews/*]
        Routes --> Tokens[/api/tokens/*]
        Routes --> Sign[/api/sign/*]
        Routes --> Notifications[/api/notifications/*]
        Routes --> Compliance[/api/compliance/*]
    end

    Routes -->|Box SDK| Box[Box Platform APIs]
```

### Request Flow

1. Component triggers an action (mount, click, form submit).
2. Component calls an API object method from `api.js` (or dispatches to `DocumentWorkflowContext` which calls the API internally).
3. `api.js` constructs the HTTP request, attaches the Bearer token from `AuthContext`, and sends it to the backend.
4. Backend route handler delegates to the appropriate service, which calls Box APIs.
5. Response flows back; component updates local state and UI.

### Token Flow

```mermaid
sequenceDiagram
    participant User
    participant AuthCtx as AuthContext
    participant API as api.js
    participant Backend as taxflow-api
    participant Box as Box Platform

    User->>AuthCtx: Select role & login
    AuthCtx->>Backend: POST /api/tokens/preview (or auth endpoint)
    Backend->>Box: Generate App User token
    Box-->>Backend: Token + expiry
    Backend-->>AuthCtx: { token, expiresAt }
    AuthCtx->>AuthCtx: Store token, schedule refresh
    Note over AuthCtx: Refresh 5 min before expiry
    AuthCtx->>API: Provide token via context
    API->>Backend: Authorization: Bearer <token>
```

## Components and Interfaces

### 1. API Service Layer (`taxflow-app/src/services/api.js`)

The existing `api.js` has `clientApi`, `documentApi`, and `vaultApi`. It will be extended with the following API objects:

```javascript
// Core HTTP helper (already exists, needs auth header injection)
function apiRequest(endpoint, options = {})

// Existing (keep as-is)
export const clientApi = { createVault, getVault }
export const documentApi = { upload }
export const vaultApi = { listFiles }

// New API objects
export const onboardingApi = {
  onboardClient(clientName, externalId, email, employeeEmail, financialYear)
}

export const portalApi = {
  getClientProgress(clientId),
  getEmployeeDashboard(employeeId),
  getCXOPortfolio(cursor, limit),
  getInactiveClients(thresholdDays),
  getFileVersions(fileId),
  createZipDownload(fileIds)
}

export const reviewApi = {
  approve(fileId, employeeId),
  reject(fileId, employeeId, reason),
  waive(fileId, employeeId, reason),
  bulkApprove(fileIds, employeeId),
  createNote(clientFolderId, author, subject, content),
  listNotes(clientFolderId)
}

export const tokenApi = {
  getPreviewToken(fileId, userId)
}

export const signApi = {
  createSignRequest(fileId, signerEmail, signedDocsFolderId, isEmbedded)
}

export const notificationApi = {
  getNotifications(recipientId)
}

export const complianceApi = {
  classify(fileId, level)
}
```

**Auth Header Injection**: The `apiRequest` helper will accept an optional `token` parameter. A `setAuthToken(token)` module-level function will be exposed so `AuthContext` can set the token once on login. All subsequent requests include `Authorization: Bearer <token>`.

**Content-Type Handling**: `apiRequest` sets `Content-Type: application/json` by default. The `documentApi.upload` method uses `FormData` and omits the Content-Type header so the browser sets the multipart boundary.

### 2. AuthContext Updates (`taxflow-app/src/context/AuthContext.jsx`)

Current state: stores `user` (role string) and `transitioning` flag. No token.

Updated interface:

```javascript
{
  user,           // role string: 'client' | 'employee' | 'cxo' | 'superadmin'
  token,          // Box App User token string (null when logged out)
  tokenError,     // Error message if token fetch failed
  transitioning,  // boolean
  login(role),    // fetches token from backend, stores both role + token
  logout(),       // clears user + token, stops refresh timer
}
```

Token refresh: A `useEffect` schedules a refresh call 5 minutes before `expiresAt`. On logout, the timer is cleared.

### 3. DocumentWorkflowContext Updates

Current state: uses `useReducer` with `INITIAL_MOCK_REQUESTS`, has `initializeVault` calling `clientApi`.

Updated behavior:
- `initializeVault` → calls `onboardingApi.onboardClient`, then `portalApi.getClientProgress` to populate `requests`.
- `APPROVE` dispatch → calls `reviewApi.approve` before local state update.
- `REQUEST_REVISION` dispatch → calls `reviewApi.reject` before local state update.
- `ADD_REQUEST` dispatch → sends to backend, uses server-generated ID.
- New `error` state field for API failures, preserving previous state on error.
- New `loading` state field for in-flight operations.

### 4. Dashboard Components

Each dashboard follows the same pattern:

```
Mount → fetch data → show skeleton while loading → render data or error
```

| Dashboard | API Call | Replaces |
|-----------|----------|----------|
| ClientDashboard | `portalApi.getClientProgress(clientId)` | `PREPARER_REQUESTS`, `TAX_STEPS`, hardcoded 40% |
| EmployeeDashboard | `portalApi.getEmployeeDashboard(employeeId)` | `CLIENTS`, hardcoded stat values |
| CXODashboard | `portalApi.getCXOPortfolio(cursor, limit)` | `FIRMS`, `ALERTS`, hardcoded stat values |
| SuperAdminDashboard | (remains mostly static — system health) | No API changes needed |

### 5. ReviewMode Updates

- Receives real Box `fileId` from the selected document.
- Calls `tokenApi.getPreviewToken(fileId, userId)` on mount to get a preview token.
- Renders Box Content Preview iframe with the token.
- Approve/Reject/Waive buttons call `reviewApi` methods.
- Buttons disabled with spinner while API call is in flight.
- Inline error display on failure.

### 6. Notification Polling

- `useEffect` in `TopNav` (or a dedicated `useNotifications` hook) polls `notificationApi.getNotifications(recipientId)` every 30 seconds.
- Badge count displayed on the Bell icon.
- Clicking the badge opens a dropdown with notification list.
- Polling stops on logout.

## Data Models

### API Response Types

```typescript
// Onboarding
interface OnboardingResult {
  appUser: { id: string; name: string };
  folders: { root: string; uploads: string; internalNotes: string; signedDocs: string };
  locks: string[];
  collaborations: string[];
  webhookId: string;
}

// Client Progress
interface ClientProgress {
  clientId: string;
  documents: DocumentRequest[];
  statusCounts: { pending: number; underReview: number; approved: number; revisionRequested: number };
  completionPercentage: number;
}

interface DocumentRequest {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  priority: string;
  status: string;
  revisionComments: string | null;
  uploadedFileName: string | null;
  fileId: string | null;
  clientId: string;
}

// Employee Dashboard
interface EmployeeDashboard {
  employeeId: string;
  clientChecklists: ClientChecklist[];
  stats: { assignedClients: number; pendingReview: number; completed: number; aiExtractions: number };
}

interface ClientChecklist {
  name: string;
  type: string;
  docs: number;
  status: string;
  aiScore: number;
}

// CXO Portfolio
interface CXOPortfolio {
  clients: PortfolioClient[];
  firmTotals: { totalClients: number; docsPending: number; avgCompliance: number; overdueFilings: number };
  nextCursor: string | null;
}

interface PortfolioClient {
  name: string;
  docs: number;
  completionPercentage: number;
  status: string;
  trend: string;
}

// Review Actions
interface ReviewResult {
  fileId: string;
  status: string;
  updatedAt: string;
}

// Preview Token
interface TokenResult {
  token: string;
  expiresAt: string;
  fileId: string;
}

// Notification
interface Notification {
  id: string;
  recipientId: string;
  eventType: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// Error shape (all endpoints)
interface ApiError {
  error: string;
}
```

### State Shape Updates

**AuthContext state:**
```javascript
{
  user: string | null,        // role
  token: string | null,       // Box App User token
  tokenExpiresAt: Date | null,
  tokenError: string | null,
  transitioning: boolean,
}
```

**DocumentWorkflowContext state:**
```javascript
{
  requests: DocumentRequest[],  // from API, not mock
  vault: object | null,
  vaultLoading: boolean,
  vaultError: string | null,
  loading: boolean,             // NEW: for any in-flight API call
  error: string | null,         // NEW: most recent API error
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API method URL and body construction

*For any* API object method and any set of valid parameters, calling the method shall construct an HTTP request where (a) the URL path contains all path-interpolated parameters, (b) the query string contains all optional query parameters when provided and omits them when undefined, and (c) the JSON body contains all body parameters with their exact values.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4**

### Property 2: Error response parsing

*For any* API endpoint and any non-2xx HTTP response with a JSON body containing an `error` field, the API service layer shall throw an Error whose message equals the `error` field value. *For any* network failure, the thrown Error message shall include the endpoint path.

**Validates: Requirements 1.2, 1.3**

### Property 3: Auth token header injection

*For any* non-empty token string set via `setAuthToken`, and *for any* subsequent API request made by any API object method, the request headers shall include `Authorization: Bearer <token>` with the exact token value.

**Validates: Requirements 1.5**

### Property 4: Content-Type header correctness

*For any* API method call that is not a file upload, the request headers shall include `Content-Type: application/json`. *For any* file upload call via `documentApi.upload`, the request shall not set an explicit `Content-Type` header (allowing the browser to set the multipart boundary).

**Validates: Requirements 1.6**

### Property 5: Onboarding response round-trip

*For any* valid `OnboardingResult` object returned by the backend, calling `onboardingApi.onboardClient` shall return an object structurally equivalent to the backend response (containing `appUser`, `folders`, `locks`, `collaborations`, `webhookId`).

**Validates: Requirements 2.2**

### Property 6: Vault initialization populates requests from API

*For any* valid `ClientProgress` response from the backend, after `initializeVault` succeeds, the `requests` state in DocumentWorkflowContext shall equal the `documents` array from the `ClientProgress` response.

**Validates: Requirements 6.1, 6.2**

### Property 7: Review dispatch calls API before state update

*For any* document with a valid `fileId` and `employeeId`, dispatching `APPROVE` shall call `reviewApi.approve(fileId, employeeId)` and dispatching `REQUEST_REVISION` shall call `reviewApi.reject(fileId, employeeId, comments)` before the local state is updated.

**Validates: Requirements 6.3, 6.4**

### Property 8: Server-generated ID used for new requests

*For any* request creation where the backend returns a response with a server-generated `id`, the `ADD_REQUEST` dispatch shall store the request with the server-provided `id` rather than a locally generated one.

**Validates: Requirements 6.5**

### Property 9: API failure preserves previous state

*For any* API call failure within DocumentWorkflowContext, the `requests` array shall remain unchanged from its value before the failed call, and the `error` field shall be set to a non-null string.

**Validates: Requirements 6.6**

### Property 10: Completion percentage computation

*For any* valid `statusCounts` object (with non-negative integer values for `pending`, `underReview`, `approved`, `revisionRequested`), the computed completion percentage shall equal `approved / total * 100` where total is the sum of all status counts, and shall be 0 when total is 0.

**Validates: Requirements 7.4**

### Property 11: Tax steps derivation from status counts

*For any* valid `statusCounts` object, the derived progress steps shall mark "Documents Submitted" as complete when `pending` is 0, "Preparer Review" as complete when `underReview` is 0 and `approved > 0`, and subsequent steps based on the progression of statuses.

**Validates: Requirements 7.6**

### Property 12: Upload passes file object to callback

*For any* successful upload API response containing a Box file object, the `onUpload` callback shall be invoked with the file name and the returned file object.

**Validates: Requirements 10.3**

### Property 13: Review actions call correct API endpoints

*For any* fileId, employeeId, and reason string, clicking "Approve" in ReviewMode shall call `reviewApi.approve(fileId, employeeId)`, submitting a revision shall call `reviewApi.reject(fileId, employeeId, reason)`, and clicking "Waive" shall call `reviewApi.waive(fileId, employeeId, reason)`.

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 14: Request creator sends form data and uses server response

*For any* valid form data (name, description, dueDate, priority, clientId), submitting the RequestCreator form shall send that data to the backend, and when the backend returns a response with a server-generated ID, the dispatched action payload shall contain the server response data.

**Validates: Requirements 12.1, 12.2**

### Property 15: Auth login stores token and logout clears it

*For any* role selection, calling `login(role)` shall result in a non-null `token` in the context state. *For any* logged-in state, calling `logout()` shall result in both `token` and `user` being null.

**Validates: Requirements 13.1, 13.4**

### Property 16: Token proactive refresh

*For any* stored token whose `expiresAt` is within 5 minutes of the current time, the system shall automatically request a new token before the current one expires. This applies to both the auth token (AuthContext) and the preview token (ReviewMode).

**Validates: Requirements 13.3, 16.4**

### Property 17: Most recent error only

*For any* sequence of N API failures (N ≥ 2) within the same component, the component shall display only the error message from the Nth (most recent) failure, not any previous error messages.

**Validates: Requirements 14.5**

### Property 18: Notification badge count

*For any* list of notifications returned by `notificationApi.getNotifications`, the badge count displayed in the top navigation shall equal the number of notifications where `read` is `false`.

**Validates: Requirements 15.2**

### Property 19: Notification list contains required fields

*For any* notification in the list, the rendered notification display shall include the `eventType`, `message`, and `timestamp` fields.

**Validates: Requirements 15.3**

### Property 20: Preview iframe uses token and file ID

*For any* valid `TokenResult` containing a `token` and `fileId`, the Box Content Preview iframe rendered in ReviewMode shall reference both the token and the file ID in its configuration.

**Validates: Requirements 16.1, 16.2**

## Error Handling

### API Service Layer Errors

- **Non-2xx responses**: Parse response body for `error` field, throw `Error(error)`. If body is not JSON, throw `Error('HTTP <status>')`.
- **Network failures**: Catch `TypeError` from `fetch`, throw `Error` including the endpoint path for debuggability.
- **Timeout**: Not implemented in v1 (browser default timeout applies). Can be added later with `AbortController`.

### Component-Level Error Handling

| Component | Error Behavior |
|-----------|---------------|
| DocumentWorkflowContext | Set `error` state, preserve previous `requests` array. Consuming components read `error` to display UI. |
| ClientDashboard | Show red-tinted glass panel with error message + "Retry" button. |
| EmployeeDashboard | Same pattern as ClientDashboard. |
| CXODashboard | Same pattern as ClientDashboard. |
| ReviewMode | Inline error below action buttons, re-enable buttons for retry. |
| RequestCreatorDrawer | Inline error above submit button, keep form data. |
| UploadDropzone | Reset progress, clear filename, show `alert()` with error message. |
| AuthContext | Set `tokenError` state, allow retry via `login()`. |

### Error State Management Rules

1. Only the most recent error is displayed per component (no stacking).
2. Mutating buttons (approve, reject, upload, create) are disabled during API calls to prevent duplicate submissions.
3. On successful retry, the error state is cleared.
4. Network errors include the endpoint path for debugging.

## Testing Strategy

### Testing Framework

- **Unit/Integration tests**: Vitest with jsdom environment (already configured in `taxflow-app/vitest.config.js`)
- **Property-based tests**: `fast-check` library for JavaScript property-based testing
- **React component tests**: `@testing-library/react` for rendering and interaction

### Unit Tests

Unit tests cover specific examples, edge cases, and integration points:

- API service layer: verify each method sends to the correct endpoint with correct HTTP method (mock `fetch`)
- Auth token injection: verify header is present when token is set, absent when not
- Upload content-type: verify multipart for uploads, JSON for everything else
- Error parsing: verify error message extraction from various response shapes
- DocumentWorkflowContext reducer: verify state transitions for each action type
- Completion percentage: verify computation for known statusCounts values
- Edge cases: empty statusCounts, zero total, missing fields, null token

### Property-Based Tests

Each property test uses `fast-check` with a minimum of 100 iterations and references the design property.

| Property | Test Description | Generator Strategy |
|----------|-----------------|-------------------|
| Property 1 | URL/body construction | Generate random strings for path params, random objects for body params |
| Property 2 | Error parsing | Generate random error messages and status codes (400-599) |
| Property 3 | Auth header | Generate random token strings, verify header on mocked fetch |
| Property 4 | Content-Type | Generate random API calls, check header presence/absence |
| Property 5 | Onboarding round-trip | Generate random OnboardingResult objects |
| Property 6 | Vault init populates requests | Generate random ClientProgress responses |
| Property 7 | Review dispatch calls API | Generate random fileId/employeeId pairs |
| Property 8 | Server-generated ID | Generate random server response IDs |
| Property 9 | Failure preserves state | Generate random initial states and error messages |
| Property 10 | Completion percentage | Generate random statusCounts with non-negative integers |
| Property 11 | Tax steps derivation | Generate random statusCounts |
| Property 12 | Upload callback | Generate random file objects |
| Property 13 | Review API calls | Generate random fileId/employeeId/reason triples |
| Property 14 | Request creator | Generate random form data objects |
| Property 15 | Login/logout token | Generate random role strings and token responses |
| Property 16 | Token refresh | Generate random expiry times near the 5-minute threshold |
| Property 17 | Most recent error | Generate random sequences of error messages |
| Property 18 | Notification badge | Generate random notification arrays with varying read states |
| Property 19 | Notification fields | Generate random notification objects |
| Property 20 | Preview iframe | Generate random token/fileId pairs |

### Test Tagging

Each property test must include a comment tag:
```javascript
// Feature: frontend-backend-integration, Property 1: API method URL and body construction
```

### Test Configuration

```javascript
// fast-check configuration
fc.assert(
  fc.property(/* arbitraries */, (/* values */) => {
    // property assertion
  }),
  { numRuns: 100 }
)
```

