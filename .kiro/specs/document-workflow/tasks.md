# Implementation Plan: Core Document Workflow & Box AI Review Engine

## Overview

Implement Phase 2 of TaxFlow Pro: document request creation (employee), client upload experience, and AI-powered review. This builds on the Phase 1 authenticated dashboard structure, adding a DocumentWorkflowContext with useReducer state machine, 9 new components, and mock Box AI extraction. All components use the existing glassmorphism aesthetic, Framer Motion animations, and shared UI from Phase 1.

## Tasks

- [x] 1. Implement DocumentWorkflowContext and state machine
  - [x] 1.1 Create DocumentWorkflowContext with useReducer
    - Create `taxflow-app/src/context/DocumentWorkflowContext.jsx`
    - Define `DocumentRequest` shape, `DocumentStatus` values, and `VALID_TRANSITIONS` map
    - Implement `documentReducer` handling actions: `ADD_REQUEST`, `CLONE_PRIOR_YEAR`, `UPLOAD_DOCUMENT`, `APPROVE`, `REQUEST_REVISION`
    - Enforce valid transitions: Pending→Under_Review, Under_Review→Approved, Under_Review→Revision_Requested, Revision_Requested→Under_Review; reject all others by returning current state
    - Define `PRIOR_YEAR_REQUESTS` and `INITIAL_MOCK_REQUESTS` mock data
    - Export `DocumentWorkflowProvider`, `useDocumentWorkflow` hook (throws if used outside provider)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 1.4, 2.2, 5.5, 6.5, 9.2, 9.6_

  - [ ]* 1.2 Write property test: state machine enforces valid transitions only
    - **Property 1: State machine enforces valid transitions only**
    - Generate random (fromStatus, toStatus) pairs from all DocumentStatus values, apply transition via reducer, verify result matches VALID_TRANSITIONS map
    - **Validates: Requirements 10.1, 10.3**

  - [ ]* 1.3 Write property test: newly created requests always have Pending status
    - **Property 2: Newly created requests always have Pending status**
    - Generate random valid form data (non-empty name, description, dueDate, any priority), dispatch ADD_REQUEST, verify new request has status=Pending, revisionComments=null, uploadedFileName=null
    - **Validates: Requirements 1.4, 2.2**

  - [ ]* 1.4 Write property test: clone duplicates all prior-year templates as Pending
    - **Property 9: Clone duplicates all prior-year templates as Pending requests**
    - Generate random initial request list states, dispatch CLONE_PRIOR_YEAR, verify list length increases by exactly the number of prior-year templates and every new request has status=Pending
    - **Validates: Requirements 2.2**

  - [ ]* 1.5 Write property test: revision comments round-trip
    - **Property 8: Revision comments round-trip**
    - Generate random non-empty comment strings, dispatch REQUEST_REVISION on an Under_Review request, verify the stored revisionComments matches the input exactly
    - **Validates: Requirements 6.3, 9.6**

- [x] 2. Wire DocumentWorkflowProvider into App and add StatusBadge
  - [x] 2.1 Wrap App with DocumentWorkflowProvider
    - Update `taxflow-app/src/App.jsx` to wrap the existing AuthContext.Provider children with `DocumentWorkflowProvider`
    - Ensure the provider sits inside AuthContext.Provider so both contexts are available to all dashboards
    - _Requirements: 10.2_

  - [x] 2.2 Create StatusBadge component
    - Add `StatusBadge` to `taxflow-app/src/components/ui.jsx` (or co-located file)
    - Map DocumentStatus to colors: Pending→#6b7280 (gray), Under_Review→#eab308 (yellow), Revision_Requested→#ef4444 (red), Approved→#22c55e (green)
    - Animate color transitions using Framer Motion `animate` on backgroundColor
    - _Requirements: 3.2, 3.3_

  - [ ]* 2.3 Write property test: StatusBadge maps every status to the correct color
    - **Property 5: StatusBadge maps every status to the correct color**
    - Generate random DocumentStatus values, render StatusBadge, verify rendered color matches the defined mapping
    - **Validates: Requirements 3.2**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement RequestCreatorDrawer
  - [x] 4.1 Build RequestCreatorDrawer component
    - Create `taxflow-app/src/components/RequestCreatorDrawer.jsx`
    - Slide-out drawer from right using Framer Motion `animate` with x translation and opacity
    - Backdrop overlay with click-to-close
    - Form fields: Document Name (text, required), Description (textarea, required), Due Date (date, required), Priority (select: Low/Medium/High/Urgent, default Medium)
    - Glassmorphism styling: backdrop-blur, translucent bg, soft drop shadow consistent with Phase 1
    - Inline validation: red border + message on empty required fields on submit attempt; clear errors on typing
    - On valid submit: dispatch `ADD_REQUEST` with status Pending, close drawer with slide-out animation
    - Close button and click-outside-to-close behavior
    - Spring/ease-out physics for open/close animations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 11.1_

  - [x] 4.2 Add Clone 2024 Requests button to RequestCreatorDrawer
    - "Clone 2024 Requests" button with animated gradient border (glow pulse on hover)
    - On click: dispatch `CLONE_PRIOR_YEAR`, close drawer
    - Hover micro-interaction: glow pulse, scale, or shimmer effect
    - _Requirements: 2.1, 2.4_

  - [ ]* 4.3 Write property test: form validation rejects empty required fields
    - **Property 3: Form validation rejects submissions with empty required fields**
    - Generate random combinations of form field values where at least one required field is empty/whitespace, attempt submission, verify rejection and request list unchanged
    - **Validates: Requirements 1.6**

- [x] 5. Implement DocumentRequestList
  - [x] 5.1 Build DocumentRequestList component
    - Create `taxflow-app/src/components/DocumentRequestList.jsx`
    - Vertical list displaying all DocumentRequests for the selected mock client
    - Each row shows: document name, due date, priority badge, StatusBadge
    - Staggered fade-in-up on mount using Framer Motion variants with staggerChildren: 0.06
    - Hover micro-interaction: subtle background highlight + translateX(2px)
    - Clicking a row with status Under_Review navigates to ReviewMode (calls onSelect callback)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 Write property test: request list row displays name, due date, priority, and status
    - **Property 6: Request list row displays name, due date, priority, and status for every request**
    - Generate random DocumentRequest arrays, render list, verify each row contains the document's name, due date, priority label, and status badge
    - **Validates: Requirements 3.1, 3.4**

- [x] 6. Wire EmployeeDashboard with document workflow views
  - [x] 6.1 Update EmployeeDashboard with viewMode switching and drawer integration
    - Update `taxflow-app/src/components/dashboards/EmployeeDashboard.jsx`
    - Add local state: `viewMode` ('list' | 'review'), `selectedRequest`, `drawerOpen`
    - In list mode: render existing stat cards + DocumentRequestList + "Request Documents" button that opens RequestCreatorDrawer
    - Consume `useDocumentWorkflow()` for requests and dispatch
    - Clicking an Under_Review request switches to review mode
    - Staggered clone items animation on CLONE_PRIOR_YEAR via Framer Motion
    - _Requirements: 1.1, 2.3, 3.1, 9.1_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement ClientUploadView and UploadDropzone
  - [x] 8.1 Build UploadDropzone component
    - Create `taxflow-app/src/components/UploadDropzone.jsx`
    - Large dashed-border rectangle with upload icon (Lucide) and instructional text
    - onDragOver: border glows cyan (#06b6d4), background darkens with blur; transition completes within 200ms
    - onDragLeave: reverts to default within 200ms
    - onDrop: triggers simulated upload progress bar (random 1500–3000ms duration)
    - Progress bar uses Framer Motion animate on width with easeOut curve
    - On 100%: brief success checkmark animation, then calls onUpload callback
    - Disabled prop: ignores drag events when true
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 11.2, 11.3_

  - [x] 8.2 Build RevisionAlert component
    - Create `taxflow-app/src/components/RevisionAlert.jsx`
    - Red-tinted glassmorphism: rgba(239,68,68,0.08) background, red border accent, backdrop-blur
    - Displays employee rejection comments as readable text
    - Framer Motion fade-in + slide-down on mount
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.3 Build ClientUploadView component
    - Create `taxflow-app/src/components/ClientUploadView.jsx`
    - Displays document name, description, due date, priority, current status
    - Glassmorphism styling consistent with Phase 1
    - Conditional rendering based on status:
      - Pending: UploadDropzone active
      - Revision_Requested: RevisionAlert + UploadDropzone active
      - Under_Review: disabled state with "Being reviewed" message, dropzone disabled
      - Approved: green checkmark animation (Framer Motion scale + opacity)
    - On upload: dispatch `UPLOAD_DOCUMENT` to transition Pending/Revision_Requested → Under_Review
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.5_

  - [ ]* 8.4 Write property test: ClientUploadView renders correct elements per status
    - **Property 7: ClientUploadView renders correct interactive elements per status**
    - Generate DocumentRequests with random statuses, render ClientUploadView, verify: UploadDropzone present when Pending or Revision_Requested; RevisionAlert present when Revision_Requested; disabled message when Under_Review; success confirmation when Approved
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 6.1**

  - [ ]* 8.5 Write property test: revision comment validation rejects empty comments
    - **Property 4: Revision comment validation rejects empty comments**
    - Generate whitespace-only strings (including empty), attempt revision submission, verify rejection and status remains Under_Review
    - **Validates: Requirements 9.7**

- [x] 9. Wire ClientDashboard with upload workflow
  - [x] 9.1 Update ClientDashboard with document request selection and ClientUploadView
    - Update `taxflow-app/src/components/dashboards/ClientDashboard.jsx`
    - Add local state: `selectedRequest`
    - When no request selected: show existing widgets + list of client's DocumentRequests with StatusBadges
    - When request selected: render ClientUploadView with back navigation
    - Consume `useDocumentWorkflow()` for requests and dispatch
    - _Requirements: 4.1, 10.1_

- [x] 10. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement ReviewMode, AIExtractionCard, and ApprovalActions
  - [x] 11.1 Build AIExtractionCard component
    - Create `taxflow-app/src/components/AIExtractionCard.jsx`
    - Header with Box AI branding (Bot icon from Lucide + "Extracted by Box AI" label)
    - Each field row: label, extracted value, confidence mini progress bar with percentage
    - Purple/cyan accent styling to distinguish AI content
    - Staggered fade-in on mount for each field row
    - Mock data: W-2 Wages $85,000 (98%), Employer Acme Corp (95%), EIN 12-3456789 (92%), Federal Tax Withheld $12,750 (97%)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 11.2 Write property test: AIExtractionCard renders confidence score for every field
    - **Property 10: AIExtractionCard renders confidence score for every field**
    - Generate random arrays of ExtractionField objects (label, value, confidence 0–100), render AIExtractionCard, verify a progress bar and percentage label for each field
    - **Validates: Requirements 8.2**

  - [x] 11.3 Build RevisionCommentArea component
    - Create `taxflow-app/src/components/RevisionCommentArea.jsx`
    - Framer Motion height + opacity expand transition (200–400ms)
    - Textarea for employee revision comments
    - Submit button; validation: empty/whitespace-only comment shows inline error
    - On valid submit: calls onSubmit callback with trimmed comment text
    - _Requirements: 9.4, 9.5, 9.7, 11.4_

  - [x] 11.4 Build ApprovalActions component
    - Create `taxflow-app/src/components/ApprovalActions.jsx`
    - "Approve" button: green color scheme; on click dispatches APPROVE, shows success animation (green checkmark)
    - "Request Revision" button: red color scheme; on click expands RevisionCommentArea
    - On revision submit: dispatches REQUEST_REVISION with comments, transitions Under_Review → Revision_Requested
    - Micro-interactions on button hover within 100ms
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 11.5_

  - [x] 11.5 Build ReviewMode split-pane layout
    - Create `taxflow-app/src/components/ReviewMode.jsx`
    - Left pane: DocumentPreviewPane with placeholder skeleton/mock PDF graphic
    - Right pane: AIInsightsPane containing AIExtractionCard + ApprovalActions
    - Glassmorphism styling on both panes with backdrop-blur, translucent bg, soft shadows
    - Staggered entry: left pane appears 150ms before right pane via Framer Motion
    - Responsive: below 1024px viewport, stack panes vertically (Tailwind `lg:` breakpoint)
    - On approve: show success animation, return to request list
    - On revision submit: return to request list with updated status
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.6_

- [x] 12. Wire ReviewMode into EmployeeDashboard
  - [x] 12.1 Connect ReviewMode to EmployeeDashboard viewMode switching
    - In review mode: render ReviewMode with selectedRequest
    - On approve/revision complete: switch viewMode back to 'list', clear selectedRequest
    - Ensure StatusBadge updates in RequestList within the same render cycle after status transitions
    - _Requirements: 7.1, 9.2, 9.3, 9.6, 10.4_

- [x] 13. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Animation and micro-interaction polish
  - [x] 14.1 Ensure all Phase 2 animations meet quality requirements
    - RequestCreatorDrawer: spring/ease-out slide + opacity for open/close
    - UploadDropzone drag-over transitions complete within 200ms
    - Upload progress bar: smooth easeOut or cubic-bezier curve 0%→100%
    - RevisionCommentArea expand: height + opacity transition 200–400ms
    - All clickable Phase 2 elements respond with micro-interaction within 100ms
    - ReviewMode staggered pane entry: left pane 100–200ms before right pane
    - Clone items staggered fade-in animation in RequestList
    - Approved status green checkmark animation in ClientUploadView
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 15. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific structural checks and edge cases
- All new components reuse existing shared UI (GlassPanel, Badge, ProgressBar) from ui.jsx
- Mock data only — no API layer; all Box AI extraction results are hardcoded
- Phase 1 components (AuthContext, AppShell, Sidebar, TopNav, dashboards) are updated in-place, not rewritten
