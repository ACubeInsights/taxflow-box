# Requirements Document

## Introduction

TaxFlow Pro Phase 2 delivers the Core Document Workflow and Box AI Review Engine. This phase builds upon the authenticated dashboard structure from Phase 1 to provide the functional UI for document request creation by employees, the immersive client upload experience, and the AI-powered employee review process. The visual design continues the Apple-caliber glassmorphism aesthetic with liquid glass effects, Framer Motion animations, and premium micro-interactions established in Phase 1.

## Glossary

- **Document_Request**: A record representing a specific tax document an employee requests from a client, containing a name, description, due date, priority, and status
- **Document_Status**: One of four states a Document_Request can be in: Pending, Under_Review, Revision_Requested, or Approved
- **Request_Creator**: A slide-out drawer or modal used by employees to create new Document_Requests with form fields for name, description, due date, and priority
- **Engagement**: A grouping of Document_Requests associated with a specific client and tax year
- **Clone_Button**: A styled button that duplicates all Document_Requests from a prior tax year (2024) into the current engagement to automate repetitive setup
- **Request_List**: A list view displaying all Document_Requests for a selected client, each showing its current Document_Status as a color-coded badge
- **Client_Upload_View**: A detailed view for a single Document_Request where the client can upload the requested document via drag-and-drop
- **Upload_Dropzone**: A large drag-and-drop area within the Client_Upload_View where clients drop files to upload
- **Upload_Progress_Bar**: An animated horizontal bar that simulates file upload progress from 0% to 100%
- **Revision_Alert**: A red-tinted glassmorphism alert box displayed in the Client_Upload_View when a Document_Request has the status Revision_Requested, showing the employee rejection comments
- **Review_Mode**: A split-pane layout screen used by employees to review uploaded documents and Box AI extraction results
- **Document_Preview_Pane**: The left pane of Review_Mode displaying a placeholder for a PDF viewer with a skeleton loader or mock graphic
- **AI_Insights_Pane**: The right pane of Review_Mode displaying data extracted by Box AI, confidence scores, and approval or revision actions
- **AI_Extraction_Card**: A panel within the AI_Insights_Pane showing mock extracted data fields (wages, employer name) with confidence score progress bars
- **Confidence_Score**: A percentage value (0–100) representing Box AI certainty for an extracted data field, displayed as a mini progress bar
- **Revision_Comment_Area**: A text area that animates into view when an employee clicks "Request Revision", allowing the employee to type specific feedback for the client
- **Status_Badge**: A color-coded pill label indicating Document_Status: Pending (Gray), Under_Review (Yellow), Revision_Requested (Red), Approved (Green)
- **Workflow_State_Machine**: The mock state management logic that governs Document_Status transitions: Pending → Under_Review → Approved or Revision_Requested, and Revision_Requested → Under_Review (on re-upload)

## Requirements

### Requirement 1: Document Request Creator Drawer

**User Story:** As an Employee/Tax Preparer, I want to create new document requests for my clients through a sleek slide-out drawer, so that I can efficiently request specific tax documents.

#### Acceptance Criteria

1. WHEN the employee clicks "Request Documents" or "New Engagement" in the Employee_Dashboard, THE Request_Creator SHALL animate into view as a slide-out drawer from the right side using Framer Motion
2. THE Request_Creator SHALL display form fields for Document Name (text input), Description (text area), Due Date (date input), and Priority (selectable: Low, Medium, High, Urgent)
3. THE Request_Creator SHALL use Glassmorphism styling with backdrop-filter blur, translucent background, and soft drop shadow consistent with Phase 1 design
4. WHEN the employee submits the form with all required fields populated, THE Request_Creator SHALL create a new Document_Request with Document_Status set to Pending
5. WHEN the employee submits the form, THE Request_Creator SHALL close with a smooth slide-out animation and the new Document_Request SHALL appear in the Request_List
6. IF any required field is empty when the employee attempts to submit, THEN THE Request_Creator SHALL highlight the empty fields with a red border and display inline validation messages
7. WHEN the employee clicks outside the drawer or clicks a close button, THE Request_Creator SHALL close with a smooth slide-out animation without creating a Document_Request

### Requirement 2: Clone Prior Year Requests

**User Story:** As an Employee/Tax Preparer, I want to clone document requests from the prior tax year with a single click, so that I can quickly set up recurring engagements without manual re-entry.

#### Acceptance Criteria

1. THE Request_Creator SHALL display a "Clone 2024 Requests" button with a glowing or gradient border animation to visually distinguish the automation feature
2. WHEN the employee clicks the Clone_Button, THE Workflow_State_Machine SHALL duplicate a predefined set of mock 2024 Document_Requests into the current engagement, each with Document_Status set to Pending
3. WHEN the Clone_Button is clicked, THE Request_List SHALL animate the newly cloned items into view using staggered fade-in animations
4. WHEN the employee hovers over the Clone_Button, THE Clone_Button SHALL display a micro-interaction (glow pulse, scale, or shimmer effect)

### Requirement 3: Document Request List with Status Badges

**User Story:** As an Employee/Tax Preparer, I want to see all document requests for a client with color-coded status badges, so that I can quickly assess the state of each request.

#### Acceptance Criteria

1. THE Request_List SHALL display all Document_Requests for the selected mock client in a vertical list layout
2. THE Request_List SHALL display a Status_Badge for each Document_Request using the following color mapping: Pending (Gray), Under_Review (Yellow), Revision_Requested (Red), Approved (Green)
3. WHEN a Document_Request transitions from one Document_Status to another, THE Status_Badge SHALL animate the color change using a smooth transition
4. THE Request_List SHALL display the document name, due date, and priority for each Document_Request
5. WHEN the Request_List loads, THE Request_List SHALL animate each list item into view using staggered fade-in-up animations consistent with Phase 1 dashboard patterns
6. WHEN the employee hovers over a Request_List item, THE item SHALL display a micro-interaction (subtle background highlight and horizontal shift)

### Requirement 4: Client Upload View for Document Requests

**User Story:** As a Client, I want to view a specific document request and understand what is needed, so that I can upload the correct document.

#### Acceptance Criteria

1. WHEN the client selects a Document_Request from the Client_Dashboard, THE Client_Upload_View SHALL display the document name, description, due date, priority, and current Document_Status
2. THE Client_Upload_View SHALL use Glassmorphism styling with backdrop-filter blur, translucent background, rounded corners, and soft shadows consistent with Phase 1 design
3. WHILE the Document_Status is Pending, THE Client_Upload_View SHALL display the Upload_Dropzone as the primary action area
4. WHILE the Document_Status is Revision_Requested, THE Client_Upload_View SHALL prominently display the Revision_Alert above the Upload_Dropzone
5. WHILE the Document_Status is Under_Review, THE Client_Upload_View SHALL display a status message indicating the document is being reviewed and disable the Upload_Dropzone
6. WHILE the Document_Status is Approved, THE Client_Upload_View SHALL display a success confirmation with a green checkmark animation

### Requirement 5: Immersive Drag-and-Drop Upload Dropzone

**User Story:** As a Client, I want a visually stunning drag-and-drop upload area, so that uploading documents feels intuitive and premium.

#### Acceptance Criteria

1. THE Upload_Dropzone SHALL render as a large rectangular area with a dashed border, upload icon, and instructional text
2. WHEN a file is dragged over the Upload_Dropzone, THE Upload_Dropzone border SHALL glow with the Box AI cyan accent color (#06b6d4)
3. WHEN a file is dragged over the Upload_Dropzone, THE Upload_Dropzone background SHALL slightly blur and darken to create a visual focus effect
4. WHEN a file is dropped onto the Upload_Dropzone, THE Upload_Progress_Bar SHALL appear and animate from 0% to 100% simulating an upload over a duration between 1500ms and 3000ms
5. WHEN the Upload_Progress_Bar reaches 100%, THE Workflow_State_Machine SHALL transition the Document_Status from Pending to Under_Review
6. WHEN the Upload_Progress_Bar reaches 100%, THE Client_Upload_View SHALL display a success checkmark animation before transitioning to the Under_Review state display
7. WHEN a file is dragged away from the Upload_Dropzone without dropping, THE Upload_Dropzone SHALL revert to its default visual state

### Requirement 6: Revision Requested Alert Display

**User Story:** As a Client, I want to clearly see why my document was rejected and what changes are needed, so that I can upload a corrected version.

#### Acceptance Criteria

1. WHILE the Document_Status is Revision_Requested, THE Revision_Alert SHALL be prominently displayed above the Upload_Dropzone in the Client_Upload_View
2. THE Revision_Alert SHALL use a red-tinted Glassmorphism style (red-tinted translucent background, red border accent, backdrop-filter blur)
3. THE Revision_Alert SHALL display the employee rejection comments as readable text within the alert
4. WHEN the Revision_Alert appears, THE Revision_Alert SHALL animate into view using a Framer Motion fade-in and slide-down transition
5. WHILE the Document_Status is Revision_Requested and the client drops a new file, THE Workflow_State_Machine SHALL transition the Document_Status from Revision_Requested to Under_Review

### Requirement 7: Review Mode Split-Pane Layout

**User Story:** As an Employee/Tax Preparer, I want a dedicated review screen with a document preview and AI insights side by side, so that I can efficiently review uploaded documents.

#### Acceptance Criteria

1. WHEN the employee selects a Document_Request with Document_Status Under_Review, THE Review_Mode SHALL display a split-pane layout with the Document_Preview_Pane on the left and the AI_Insights_Pane on the right
2. THE Review_Mode SHALL use Glassmorphism styling with backdrop-filter blur, translucent backgrounds, and soft shadows for both panes
3. THE Document_Preview_Pane SHALL display a placeholder area for a PDF viewer using a skeleton loader or mock graphic representing a rendered tax document
4. WHEN the Review_Mode loads, THE Document_Preview_Pane and AI_Insights_Pane SHALL animate into view using staggered Framer Motion transitions (left pane first, right pane delayed)
5. THE Review_Mode split-pane layout SHALL adapt to viewport widths below 1024px by stacking the panes vertically (Document_Preview_Pane on top, AI_Insights_Pane below)

### Requirement 8: Box AI Extraction Card with Confidence Scores

**User Story:** As an Employee/Tax Preparer, I want to see data extracted by Box AI with confidence scores, so that I can quickly verify document accuracy without manual data entry.

#### Acceptance Criteria

1. THE AI_Extraction_Card SHALL display mock extracted data fields labeled "Extracted by Box AI" (W-2 Wages: $85,000, Employer: Acme Corp, EIN: 12-3456789, Federal Tax Withheld: $12,750)
2. THE AI_Extraction_Card SHALL display a Confidence_Score for each extracted field as a mini progress bar with a percentage label
3. THE AI_Extraction_Card SHALL use a distinct visual style with a subtle purple or cyan accent to indicate AI-generated content
4. WHEN the AI_Extraction_Card loads, THE extracted fields and Confidence_Score bars SHALL animate into view using staggered fade-in animations
5. THE AI_Extraction_Card SHALL display a Box AI branding element (icon or label) to attribute the extraction source

### Requirement 9: Document Approval and Revision Actions

**User Story:** As an Employee/Tax Preparer, I want prominent Approve and Request Revision buttons with clear visual feedback, so that I can take decisive action on reviewed documents.

#### Acceptance Criteria

1. THE AI_Insights_Pane SHALL display an "Approve" button styled with a green color scheme and a "Request Revision" button styled with a red color scheme
2. WHEN the employee clicks the "Approve" button, THE Workflow_State_Machine SHALL transition the Document_Status from Under_Review to Approved
3. WHEN the employee clicks the "Approve" button, THE Review_Mode SHALL display a success animation (green checkmark or confetti-style effect) before returning to the Request_List
4. WHEN the employee clicks the "Request Revision" button, THE Revision_Comment_Area SHALL animate into view below the action buttons using a Framer Motion expand transition
5. THE Revision_Comment_Area SHALL contain a text area for the employee to type specific revision comments
6. WHEN the employee submits revision comments, THE Workflow_State_Machine SHALL transition the Document_Status from Under_Review to Revision_Requested and store the comments for display in the Revision_Alert
7. IF the employee clicks "Request Revision" and submits with an empty comment field, THEN THE Revision_Comment_Area SHALL display a validation message requiring comments before submission

### Requirement 10: Document Status State Machine

**User Story:** As a developer, I want a predictable state machine governing document status transitions, so that the UI consistently reflects valid workflow states.

#### Acceptance Criteria

1. THE Workflow_State_Machine SHALL enforce the following valid transitions: Pending to Under_Review (on client upload), Under_Review to Approved (on employee approval), Under_Review to Revision_Requested (on employee revision request), Revision_Requested to Under_Review (on client re-upload)
2. THE Workflow_State_Machine SHALL use React state (useState or useReducer) to manage Document_Status for all Document_Requests
3. IF a transition is attempted that is not in the valid transition set, THEN THE Workflow_State_Machine SHALL reject the transition and maintain the current Document_Status
4. WHEN a Document_Status transition occurs, THE corresponding Status_Badge in the Request_List SHALL update within the same render cycle

### Requirement 11: Animation and Micro-Interaction Quality for Phase 2

**User Story:** As a user, I want smooth, physics-based animations on all Phase 2 interactions, so that the document workflow feels as premium as the Phase 1 experience.

#### Acceptance Criteria

1. THE Request_Creator drawer SHALL use Framer Motion slide and opacity animations with spring or ease-out physics for open and close transitions
2. WHEN the Upload_Dropzone drag-over state changes, THE visual transition (border glow, background blur) SHALL complete within 200ms
3. THE Upload_Progress_Bar SHALL use a smooth easing curve (ease-out or cubic-bezier) for the width animation from 0% to 100%
4. WHEN the Revision_Comment_Area expands into view, THE animation SHALL use a Framer Motion height and opacity transition with a duration between 200ms and 400ms
5. WHEN any clickable element in Phase 2 components is interacted with, THE element SHALL respond with a micro-interaction within 100ms of the user action
6. THE Review_Mode pane entry animations SHALL use staggered timing with the left pane appearing 100ms to 200ms before the right pane
