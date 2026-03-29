# Implementation Plan: Frontend-Backend Integration

## Overview

Wire the TaxFlow Pro React frontend to the Express.js backend by replacing all mock/hardcoded data with live API calls. All changes are in `taxflow-app/src/`. Implementation proceeds bottom-up: API layer → auth context → workflow context → dashboards → mutation components → cross-cutting concerns.

## Tasks

- [x] 1. Expand API Service Layer (`taxflow-app/src/services/api.js`)
  - [x] 1.1 Add `setAuthToken` / `getAuthToken` module-level functions and inject `Authorization: Bearer <token>` header in `apiRequest`
    - Add a module-scoped `let _authToken = null`
    - Export `setAuthToken(token)` and use it in `apiRequest` to attach the header when token is non-null
    - Ensure `documentApi.upload` also attaches the auth header (but still omits Content-Type)
    - _Requirements: 1.5, 1.6_

  - [x] 1.2 Add `onboardingApi` object with `onboardClient` method
    - POST to `/onboarding` with `{ clientName, externalId, email, employeeEmail, financialYear }`
    - Return parsed `OnboardingResult` on 201
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Add `portalApi` object with all portal endpoint methods
    - `getClientProgress(clientId)` → GET `/portal/client/${clientId}/progress`
    - `getEmployeeDashboard(employeeId)` → GET `/portal/employee/${employeeId}/dashboard`
    - `getCXOPortfolio(cursor, limit)` → GET `/portal/cxo/portfolio` with optional query params
    - `getInactiveClients(thresholdDays)` → GET `/portal/inactive-clients` with optional query param
    - `getFileVersions(fileId)` → GET `/portal/files/${fileId}/versions`
    - `createZipDownload(fileIds)` → POST `/portal/zip-download` with `{ fileIds }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.4 Add `reviewApi` object with all review endpoint methods
    - `approve(fileId, employeeId)` → POST `/reviews/${fileId}/approve` with `{ employeeId }`
    - `reject(fileId, employeeId, reason)` → POST `/reviews/${fileId}/reject` with `{ employeeId, reason }`
    - `waive(fileId, employeeId, reason)` → POST `/reviews/${fileId}/waive` with `{ employeeId, reason }`
    - `bulkApprove(fileIds, employeeId)` → POST `/reviews/bulk-approve` with `{ fileIds, employeeId }`
    - `createNote(clientFolderId, author, subject, content)` → POST `/reviews/${clientFolderId}/notes`
    - `listNotes(clientFolderId)` → GET `/reviews/${clientFolderId}/notes`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 1.5 Add `tokenApi`, `signApi`, `notificationApi`, and `complianceApi` objects
    - `tokenApi.getPreviewToken(fileId, userId)` → POST `/tokens/preview` with `{ fileId, userId }`
    - `signApi.createSignRequest(fileId, signerEmail, signedDocsFolderId, isEmbedded)` → POST `/sign/request`
    - `notificationApi.getNotifications(recipientId)` → GET `/notifications/${recipientId}`
    - `complianceApi.classify(fileId, level)` → POST `/compliance/classify/${fileId}` with `{ level }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 1.6 Write property tests for API service layer
    - **Property 1: API method URL and body construction** — For any API method and valid params, verify the constructed fetch URL and body match the expected endpoint pattern
    - **Property 2: Error response parsing** — For any non-2xx status with JSON `{ error }` body, verify thrown Error message equals the error field
    - **Property 3: Auth token header injection** — For any non-empty token set via `setAuthToken`, verify all subsequent requests include `Authorization: Bearer <token>`
    - **Property 4: Content-Type header correctness** — For non-upload calls verify `Content-Type: application/json`; for upload calls verify no explicit Content-Type
    - **Validates: Requirements 1.2, 1.3, 1.5, 1.6, 3.1–3.6, 4.1–4.6, 5.1–5.4**

- [x] 2. Checkpoint — Verify API service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update AuthContext with token management (`taxflow-app/src/context/AuthContext.jsx`)
  - [x] 3.1 Add token state and login flow
    - Add `token`, `tokenExpiresAt`, and `tokenError` to state
    - Update `login(role)` to call `tokenApi.getPreviewToken` (or a dedicated auth endpoint) to obtain a Box App User token, store it in state, and call `setAuthToken(token)` from `api.js`
    - On login failure, set `tokenError` and allow retry
    - _Requirements: 13.1, 13.2, 13.5_

  - [x] 3.2 Add token refresh and logout cleanup
    - In a `useEffect`, schedule a refresh call 5 minutes before `tokenExpiresAt`
    - On `logout()`, clear `token`, `user`, `tokenExpiresAt`, cancel the refresh timer, and call `setAuthToken(null)`
    - _Requirements: 13.3, 13.4_

  - [ ]* 3.3 Write property tests for AuthContext token management
    - **Property 15: Auth login stores token and logout clears it** — For any role, `login(role)` results in non-null token; `logout()` results in null token and user
    - **Property 16: Token proactive refresh** — For any token expiring within 5 minutes, verify a refresh is scheduled before expiry
    - **Validates: Requirements 13.1, 13.3, 13.4**

- [x] 4. Rewrite DocumentWorkflowContext to use API calls (`taxflow-app/src/context/DocumentWorkflowContext.jsx`)
  - [x] 4.1 Replace `initializeVault` with onboarding + client progress API calls
    - Call `onboardingApi.onboardClient(clientName, externalId, email, employeeEmail, financialYear)` instead of `clientApi.createVault`
    - On success, call `portalApi.getClientProgress(clientId)` and set `requests` from the returned `documents` array
    - Add `loading` and `error` state fields
    - _Requirements: 6.1, 6.2_

  - [x] 4.2 Wire APPROVE and REQUEST_REVISION dispatches to review API
    - Before updating local state for `APPROVE`, call `reviewApi.approve(fileId, employeeId)`
    - Before updating local state for `REQUEST_REVISION`, call `reviewApi.reject(fileId, employeeId, comments)`
    - On API failure, set `error` state and preserve previous `requests`
    - _Requirements: 6.3, 6.4, 6.6_

  - [x] 4.3 Wire ADD_REQUEST dispatch to backend and use server-generated ID
    - Send request data to backend (e.g., via a portal or review endpoint)
    - Use the server-returned `id` in the new request object instead of the local `nextId` counter
    - On failure, set `error` and preserve state
    - _Requirements: 6.5, 6.6_

  - [ ]* 4.4 Write property tests for DocumentWorkflowContext
    - **Property 6: Vault initialization populates requests from API** — For any valid ClientProgress response, after `initializeVault`, `requests` equals the `documents` array
    - **Property 7: Review dispatch calls API before state update** — For any valid fileId/employeeId, APPROVE calls `reviewApi.approve` before local update
    - **Property 8: Server-generated ID used for new requests** — For any backend response with an `id`, the stored request uses that ID
    - **Property 9: API failure preserves previous state** — For any API failure, `requests` remains unchanged and `error` is non-null
    - **Validates: Requirements 6.1–6.6**

- [x] 5. Checkpoint — Verify context layers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update ClientDashboard with live data fetching (`taxflow-app/src/components/dashboards/ClientDashboard.jsx`)
  - [x] 6.1 Fetch client progress on mount and replace hardcoded data
    - Call `portalApi.getClientProgress(clientId)` on mount (get `clientId` from auth context)
    - Replace `PREPARER_REQUESTS` with documents from the API response
    - Replace `TAX_STEPS` with steps derived from `statusCounts`
    - Replace hardcoded `40%` completion with `completionPercentage` from response
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

  - [x] 6.2 Add loading skeleton and error states
    - Show skeleton loaders while `getClientProgress` is in flight
    - Show red-tinted glass error panel with "Retry" button on failure
    - _Requirements: 7.2, 7.3, 14.1, 14.2, 14.3_

  - [ ]* 6.3 Write property tests for ClientDashboard data derivation
    - **Property 10: Completion percentage computation** — For any valid statusCounts, completion = approved/total*100, 0 when total is 0
    - **Property 11: Tax steps derivation from status counts** — For any statusCounts, verify step completion flags match the expected logic
    - **Validates: Requirements 7.4, 7.6**

- [x] 7. Update EmployeeDashboard with live data fetching (`taxflow-app/src/components/dashboards/EmployeeDashboard.jsx`)
  - [x] 7.1 Fetch employee dashboard data on mount and replace hardcoded data
    - Call `portalApi.getEmployeeDashboard(employeeId)` on mount
    - Replace `CLIENTS` array with `clientChecklists` from API response
    - Replace hardcoded stat card values with `stats` from API response
    - Pass real Box `fileId` to ReviewMode when selecting a document for review
    - _Requirements: 8.1, 8.4, 8.5, 8.6_

  - [x] 7.2 Add loading skeleton and error states
    - Show skeleton loaders while API call is in flight
    - Show error panel with "Retry" button on failure
    - _Requirements: 8.2, 8.3, 14.1, 14.2, 14.3_

- [x] 8. Update CXODashboard with live data fetching (`taxflow-app/src/components/dashboards/CXODashboard.jsx`)
  - [x] 8.1 Fetch CXO portfolio on mount and replace hardcoded data
    - Call `portalApi.getCXOPortfolio()` on mount
    - Replace `FIRMS` array with `clients` from API response, mapping `completionPercentage` to compliance progress bars
    - Replace hardcoded stat card values with `firmTotals` from API response
    - _Requirements: 9.1, 9.4, 9.5_

  - [x] 8.2 Add loading skeleton, error states, and pagination
    - Show skeleton loaders while API call is in flight
    - Show error panel with "Retry" button on failure
    - When `nextCursor` is present, show "Load More" button that calls `getCXOPortfolio(cursor, limit)` and appends results
    - _Requirements: 9.2, 9.3, 9.6, 14.1, 14.2, 14.3_

- [x] 9. Checkpoint — Verify dashboard components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire UploadDropzone to real upload API (`taxflow-app/src/components/UploadDropzone.jsx`)
  - [x] 10.1 Update upload flow to pass Box file object to callback
    - Ensure `documentApi.upload` is called with `file`, `folderId`, and `requestId`
    - On success, pass the returned Box file object (with `fileId`, `fileName`, `size`) to `onUpload` callback
    - Add guard: if no `folderId` prop, log error and prevent upload
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 10.2 Write property test for upload callback
    - **Property 12: Upload passes file object to callback** — For any successful upload response containing a file object, `onUpload` is invoked with the file name and returned file object
    - **Validates: Requirements 10.3**

- [x] 11. Wire ReviewMode to real review API and preview tokens (`taxflow-app/src/components/ReviewMode.jsx`)
  - [x] 11.1 Add preview token fetching and Box Content Preview iframe
    - On mount, call `tokenApi.getPreviewToken(fileId, userId)` to get a preview token
    - Render a Box Content Preview iframe using the token and file ID in the Document Preview Pane
    - On token fetch failure, show a fallback skeleton with error message
    - Schedule token refresh when within 5 minutes of expiry
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 11.2 Wire approve/reject/waive buttons to review API
    - "Approve" calls `reviewApi.approve(fileId, employeeId)`
    - "Request Revision" calls `reviewApi.reject(fileId, employeeId, reason)`
    - "Waive" calls `reviewApi.waive(fileId, employeeId, reason)`
    - Disable all action buttons and show spinner while API call is in flight
    - On failure, show inline error below buttons and re-enable for retry
    - On success, update local status and navigate back to document list
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 11.3 Write property tests for ReviewMode
    - **Property 13: Review actions call correct API endpoints** — For any fileId/employeeId/reason, verify approve/reject/waive call the correct `reviewApi` methods
    - **Property 20: Preview iframe uses token and file ID** — For any valid TokenResult, verify the iframe references both token and fileId
    - **Validates: Requirements 11.1, 11.2, 11.3, 16.1, 16.2**

- [x] 12. Wire RequestCreatorDrawer to backend (`taxflow-app/src/components/RequestCreatorDrawer.jsx`)
  - [x] 12.1 Send form data to backend and use server response
    - On submit, send `{ name, description, dueDate, priority, clientId }` to the backend
    - On success, dispatch `ADD_REQUEST` with the server response data (including server-generated ID)
    - On failure, show inline error above submit button, keep form data
    - Disable submit button and show spinner while API call is in flight
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 12.2 Write property test for RequestCreatorDrawer
    - **Property 14: Request creator sends form data and uses server response** — For any valid form data, verify the backend receives the data and the dispatched action contains the server response
    - **Validates: Requirements 12.1, 12.2**

- [x] 13. Checkpoint — Verify mutation components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add notification polling (`taxflow-app/src/components/TopNav.jsx`)
  - [x] 14.1 Implement notification polling and badge display
    - Create a `useNotifications` hook (or inline in TopNav) that polls `notificationApi.getNotifications(recipientId)` every 30 seconds when authenticated
    - Display unread notification count as a badge on the Bell icon
    - On click, show a dropdown with notification list (eventType, message, timestamp)
    - Stop polling on logout
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 14.2 Write property tests for notification polling
    - **Property 18: Notification badge count** — For any notification list, badge count equals the number where `read` is false
    - **Property 19: Notification list contains required fields** — For any notification, the display includes eventType, message, and timestamp
    - **Validates: Requirements 15.2, 15.3**

- [x] 15. Add consistent loading/error UX across all components
  - [x] 15.1 Ensure error-only-most-recent behavior and disabled-during-mutation pattern
    - Verify each component displays only the most recent error (no stacking)
    - Verify all mutating buttons (approve, reject, upload, create) are disabled during API calls
    - On successful retry, clear error state
    - _Requirements: 14.4, 14.5_

  - [ ]* 15.2 Write property test for error display behavior
    - **Property 17: Most recent error only** — For any sequence of N failures (N≥2), only the Nth error message is displayed
    - **Validates: Requirements 14.5**

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All changes are in `taxflow-app/src/` — no backend modifications needed
- The design uses JavaScript/React, so all implementation uses the same stack
