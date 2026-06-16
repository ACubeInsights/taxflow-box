# TaxFlow Pro — Stage 1 Delivery Report

**Prepared for:** Client Review  
**Date:** May 19, 2025  
**Version:** 1.0  
**Status:** Stage 1 Complete — Ready for Review

---

## Executive Summary

TaxFlow Pro Stage 1 delivers a fully functional, production-ready tax document management platform integrated with Box as the secure cloud storage and compliance backbone. The platform enables tax firms to onboard clients, manage document workflows, leverage AI-powered document intelligence, and maintain regulatory compliance — all through an intuitive, role-based interface.

**Key Outcomes Delivered:**
- End-to-end client onboarding with automated Box vault provisioning
- Complete document lifecycle management (request → upload → review → approval)
- Box AI integration for intelligent document extraction and validation
- E-signature workflows via Box Sign
- Regulatory compliance tooling (7-year retention, legal holds, security classification)
- Role-based dashboards for four distinct user personas
- Real-time webhook-driven automation
- Secure authentication with session management

---

## Platform Overview

### System Architecture

TaxFlow Pro is built as a modern three-tier application:

| Layer | Purpose |
|-------|---------|
| **TaxFlow App** (Frontend) | React-based web application with role-specific dashboards |
| **TaxFlow API** (Backend) | Express.js REST API handling business logic and orchestration |
| **Box Wrapper Service** | TypeScript integration layer for Box Platform API |

The platform communicates with Box Platform via JWT-authenticated server-to-server calls, ensuring all document operations are secure and auditable.

---

## Features Delivered in Stage 1

### 1. Client Onboarding

**What it does:** Enables tax preparers to onboard new clients with a single action, automatically provisioning their entire secure document infrastructure.

**How it works:**

| Step | Action | Handled By |
|------|--------|------------|
| 1 | Create secure Box App User for the client | Box Platform |
| 2 | Generate structured folder hierarchy (Tax, Uploads, Supporting Docs, Signed Documents, Internal Notes) | Box Platform |
| 3 | Apply folder-level security locks | Box Platform |
| 4 | Configure role-based access permissions | Box Platform |
| 5 | Register real-time event webhooks | Box Platform |
| 6 | Create file request link for client uploads | Box Platform |
| 7 | Register client in local database with project assignment | TaxFlow |
| 8 | Send welcome email to client | TaxFlow |

**Business Value:** What previously required manual folder setup, permission configuration, and client communication is now a one-click operation that completes in seconds.

---

### 2. Secure Document Vault (Per Client)

**What it does:** Every onboarded client receives a dedicated, structured vault in Box with enforced access controls.

**Folder Structure:**

```
Client Name (ID)
└── 2025
    └── Projects
        ├── Tax              → Client: View Only
        ├── Uploads          → Client: View + Upload
        ├── SupportingDocs   → Internal Only
        ├── SignedDocuments   → Client: View Only
        └── InternalNotes    → Employee Only (Hidden from Client)
```

**Access Control:**

| Folder | Client Access | Employee Access |
|--------|--------------|-----------------|
| Tax | View only | Full edit |
| Uploads | View + Upload | Full edit |
| Supporting Docs | No access | Full edit |
| Signed Documents | View only | Full edit |
| Internal Notes | No access (hidden) | Full edit |

**Handled By:** Box Platform manages all storage, encryption at rest, access enforcement, and audit logging.

---

### 3. Document Workflow Management

**What it does:** Provides a complete document lifecycle from request creation through final approval, with built-in quality controls.

**Document Lifecycle:**

```
Request Created → Client Uploads → Employee Reviews → Approved / Revision Requested / Waived
```

**Six-State Lifecycle:**

| Status | Description | Who Acts |
|--------|-------------|----------|
| Not Requested | Document request created by preparer | Employee |
| Uploaded | Client has uploaded the document | Client |
| Under Review | Employee is reviewing the document | Employee |
| Approved | Document accepted — stored permanently | Employee |
| Revision Requested | Changes needed — client notified | Employee |
| Waived | Requirement no longer needed | Employee |

**Quality Controls:**
- Optimistic concurrency prevents conflicting edits (version tracking)
- 10-minute undo window for accidental approvals
- Mandatory revision comments (10–1000 characters) when requesting changes
- Complete audit trail on every status transition
- Automatic system comments documenting all state changes

**Responsibility Split:**

| Capability | Handled By |
|------------|------------|
| Document storage and versioning | Box |
| File metadata (status, reviewer, priority) | Box |
| Status transition logic and validation | TaxFlow |
| Audit trail and activity logging | TaxFlow |
| Notification dispatch on transitions | TaxFlow |

---

### 4. Document Review and Approval

**What it does:** Employees can review uploaded documents with an integrated preview, AI-powered insights, and one-click approval or rejection actions.

**Features:**
- In-app document preview powered by Box Content Preview
- Approve, reject (with mandatory comments), or waive documents
- Bulk approval for processing multiple documents efficiently (up to 5 concurrent operations)
- Internal notes system — private notes stored in Box, invisible to clients
- Threaded comments with @mention support and 5-minute edit window

**Handled By:**
- Document preview rendering → Box
- Metadata updates on approval/rejection → Box
- Task creation and completion → Box
- Review logic, validation, and notifications → TaxFlow

---

### 5. Box AI Document Intelligence

**What it does:** Leverages Box AI to automatically extract structured data from uploaded tax documents and validate their completeness.

**Capabilities:**

| Feature | Description |
|---------|-------------|
| Structured Data Extraction | Automatically identifies document type, financial year, taxpayer information, and key financial figures from uploaded documents |
| Document Validation | AI-powered completeness check — flags missing fields or suspicious values |
| Confidence Scoring | Each extracted field receives a confidence score; low-confidence items are flagged for manual review |
| Custom AI Agent | Dedicated TaxFlow Document Analyzer agent configured for US tax forms (W-2, 1099, 1040, K-1) |

**How it integrates:**
1. Client uploads a document
2. Box webhook notifies TaxFlow
3. TaxFlow triggers Box AI structured extraction
4. Extracted data is written back to Box metadata
5. Low-confidence extractions are flagged for employee review

**Handled By:** Box AI performs all document analysis. TaxFlow orchestrates the pipeline and presents results.

---

### 6. E-Signature Workflows (Box Sign)

**What it does:** Enables employees to send documents for electronic signature directly within the platform, with full lifecycle tracking.

**Capabilities:**
- Create signature requests with one click
- Embedded signing experience (client signs within TaxFlow)
- Automatic status tracking: Pending → Signed / Declined / Expired
- Signed copies automatically stored in the client's SignedDocuments folder
- Webhook-driven event handling for signature completion, decline, and expiry

**Event Handling:**

| Event | System Response |
|-------|----------------|
| Signature Completed | Status → Signed, copy to SignedDocuments folder |
| Signature Declined | Status → Revision Requested, notify employee |
| Signature Expired | Status → Pending Upload, notify client |

**Handled By:** Box Sign manages the entire signing ceremony. TaxFlow handles orchestration and status updates.

---

### 7. Regulatory Compliance

**What it does:** Provides built-in compliance tooling to meet tax industry regulatory requirements.

**Capabilities:**

| Feature | Description | Handled By |
|---------|-------------|------------|
| 7-Year Retention Policy | Automatically applied to approved documents — ensures documents cannot be deleted before the retention period expires | Box |
| Legal Holds | Place litigation holds on specific files or folders — prevents deletion or modification during legal proceedings | Box |
| Security Classification | Classify documents as Public, Internal, or Confidential — enforces access policies based on sensitivity | Box |
| Audit Trail | Every action (upload, review, approval, status change) is logged with actor, timestamp, and details | TaxFlow |

**Business Value:** Tax firms can demonstrate compliance with IRS record retention requirements and respond to legal discovery requests without manual intervention.

---

### 8. Real-Time Event Processing (Webhooks)

**What it does:** Box notifies TaxFlow in real-time when events occur (file uploads, deletions, moves), enabling automated post-upload processing.

**Post-Upload Automation Pipeline:**

| Step | Action |
|------|--------|
| 1 | Detect upload event via webhook |
| 2 | Extract client context from folder hierarchy |
| 3 | Apply document metadata template |
| 4 | Trigger Box AI extraction (async) |
| 5 | Create review task assigned to employee |
| 6 | Send in-app notification to assigned employee |

**Security:** All webhook payloads are verified using dual HMAC-SHA256 signatures with constant-time comparison to prevent timing attacks.

**Handled By:** Box sends events. TaxFlow verifies, processes, and orchestrates downstream actions.

---

### 9. Notifications and Communication

**What it does:** Keeps all parties informed through email and in-app notifications with secure deep-link access.

**Notification Channels:**

| Event | Email | In-App | Deep Link |
|-------|-------|--------|-----------|
| Revision Requested | ✓ | ✓ | 7-day signed link |
| Document Approved | ✓ | ✓ | 72-hour signed link |
| New Request Published | ✓ | — | 72-hour signed link |
| Signature Requested | ✓ | ✓ | — |
| Document Uploaded | — | ✓ | — |
| @Mention in Comment | — | ✓ | — |

**Deep-Link Security:**
- Signed JWT tokens (HMAC-SHA256)
- Configurable expiry (default 72 hours, revision emails 7 days)
- Constant-time signature verification
- Automatic retry with exponential backoff for email delivery (3 attempts)

**Handled By:** TaxFlow manages all notification logic, email composition, and token generation.

---

### 10. Authentication and Session Management

**What it does:** Provides secure, session-based authentication for all user roles with automatic timeout and refresh.

**Features:**
- Email + password authentication for all roles
- Secure password hashing (SHA-256)
- Session tokens with 1-hour server-side TTL
- 30-minute client-side inactivity timeout with 25-minute warning
- Automatic session refresh 5 minutes before expiry
- Password reset flow with time-limited tokens (30 minutes)
- Change password functionality
- Auto-logout on 401 responses

**Handled By:** TaxFlow manages authentication. Box App Users are created during onboarding for storage-level identity.

---

### 11. Role-Based Dashboards

**What it does:** Each user role sees a purpose-built dashboard tailored to their responsibilities.

#### Super Admin Dashboard
- System health monitoring (API status, latency, uptime)
- User management (add employees, onboard clients)
- Resource usage metrics
- Box AI integration status

#### CXO / Executive Dashboard
- Firm-wide portfolio compliance rates
- Cross-client document aggregation with pagination
- Tax year filing progress
- Critical alerts and overdue filings
- Trend analysis

#### Employee / Tax Preparer Dashboard
- Assigned client list with search and filtering
- Box AI Insights panel (deduction opportunities, credit identification, missing documents)
- Recent activity feed
- Quick actions: New Document Request, Review Next Document, Onboard New Client
- Summary metrics (active clients, pending reviews, overdue documents)

#### Client Dashboard
- Preparer requests with priority and due dates
- Vault browser (browse files in their Box folders)
- Document upload interface with drag-and-drop
- Status-aware UI (upload enabled only when appropriate)
- Completion progress tracking

---

### 12. Document Upload System

**What it does:** Provides reliable file upload with integrity verification, supporting both standard and large file uploads.

**Capabilities:**

| Feature | Details |
|---------|---------|
| Standard Upload | Files under 50 MB — single-request upload |
| Chunked Upload | Files 50 MB+ — session-based upload with 8 MB chunks |
| Integrity Verification | SHA-1 hash per chunk + whole-file SHA-1 at commit |
| Retry Logic | Failed chunks retry up to 3 times with exponential backoff |
| Session Cleanup | Upload sessions automatically aborted on persistent failure |

**Handled By:** Box handles storage and integrity verification. TaxFlow manages the upload orchestration and chunking logic.

---

### 13. Document Type Catalog

**What it does:** Provides a curated catalog of 12 tax document types with descriptions, instructions, and entity-type filtering.

**Supported Document Types:**
- W-2 Form
- 1099-DIV, 1099-INT, 1099-MISC, 1099-NEC
- 1098 Mortgage Interest, 1098-T Tuition
- Schedule C, Schedule K-1
- Trust Agreement
- Bank Statements
- Charitable Donation Receipts

Each type includes:
- Category classification (Income, Deductions, Business, Financial, Trust)
- Client-facing description
- Collection instructions
- Applicable entity types (Individual, Business, Trust, S-Corp, Partnership)

---

### 14. Metadata-Driven Document Tracking

**What it does:** Every document in Box carries structured metadata enabling powerful querying, filtering, and reporting.

**Metadata Template Fields:**

| Field | Type | Purpose |
|-------|------|---------|
| Client ID | String | Links document to client |
| Engagement ID | String | Links to engagement/project |
| Request ID | String | Links to document request |
| Document Type | String | W-2, 1099, etc. |
| Financial Year | String | Tax year |
| Status | Enum | 7 states (pending_upload through signed) |
| Reviewer | String | Assigned reviewer |
| Review Comments | String | Revision feedback |
| Reviewed At | Date | Review timestamp |
| Priority | Enum | Low, Normal, High, Urgent |

**Handled By:** Box stores and indexes metadata. TaxFlow reads and writes metadata through the Box API.

---

### 15. Platform Resilience

**What it does:** Ensures the platform remains stable and responsive even under adverse conditions.

| Mechanism | Purpose |
|-----------|---------|
| Circuit Breaker | Prevents cascading failures when Box API is degraded |
| Rate Limiter | Respects Box API rate limits, queues excess requests |
| Cache Layer | Reduces redundant API calls (configurable TTL per endpoint) |
| Retry with Backoff | Automatically retries failed operations with exponential delay |
| Structured Logging | Comprehensive logging for debugging and monitoring |
| Error Handling | Centralized error middleware with appropriate HTTP status codes |

---

## Responsibility Matrix: TaxFlow vs. Box

| Capability | TaxFlow | Box Platform |
|------------|---------|--------------|
| User authentication & sessions | ✓ | |
| Client onboarding orchestration | ✓ | |
| App User creation | | ✓ |
| Folder hierarchy creation | | ✓ |
| Access control enforcement | | ✓ |
| Document storage & encryption | | ✓ |
| File versioning | | ✓ |
| Metadata templates & queries | | ✓ |
| Webhook event delivery | | ✓ |
| AI document extraction | | ✓ |
| AI document validation | | ✓ |
| E-signature ceremony | | ✓ |
| Retention policies | | ✓ |
| Legal holds | | ✓ |
| Security classification | | ✓ |
| Document workflow state machine | ✓ | |
| Business rule validation | ✓ | |
| Notification dispatch (email + in-app) | ✓ | |
| Deep-link token generation | ✓ | |
| Role-based UI rendering | ✓ | |
| Activity logging & audit trail | ✓ | |
| Comment system | ✓ | |
| Document type catalog | ✓ | |
| Dashboard analytics | ✓ | |
| Post-upload automation pipeline | ✓ | |

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, Vite, Framer Motion, React Router |
| Backend | Express.js (ES Modules), Node.js 18+ |
| Database | SQLite (development) / PostgreSQL (production) via Knex |
| Box Integration | box-node-sdk, JWT authentication, TypeScript wrapper |
| Email | Nodemailer (SMTP) with retry logic |
| Testing | Vitest, fast-check (property-based testing) |

---

## Security Measures Implemented

| Area | Implementation |
|------|---------------|
| Authentication | SHA-256 password hashing, secure session tokens (48 random bytes) |
| Session Security | Server-side TTL, client-side inactivity timeout, auto-refresh |
| API Security | Bearer token authentication, role-based middleware |
| Webhook Security | Dual HMAC-SHA256 signature verification, constant-time comparison |
| Deep Links | Signed JWT tokens with configurable expiry |
| Upload Integrity | Per-chunk and whole-file SHA-1 verification |
| Access Control | Box-enforced folder permissions, role-based route guards |
| Data Protection | Box encryption at rest, TLS in transit |
| Anti-Enumeration | Password reset always returns success (prevents email discovery) |

---

## What's Ready for Stage 2

The Stage 1 foundation enables the following areas for Stage 2 expansion:

1. **Advanced Reporting & Analytics** — Leverage the metadata and activity data already being captured
2. **Multi-Year Support** — Folder hierarchy already supports year-based organization
3. **Client Self-Service Portal** — Authentication and vault infrastructure in place
4. **Workflow Automation Rules** — Webhook pipeline extensible for custom triggers
5. **Third-Party Integrations** — API layer designed for extensibility
6. **Mobile Experience** — API-first architecture supports mobile clients
7. **Advanced AI Features** — Box AI agent infrastructure ready for expansion
8. **Multi-Firm / White-Label** — Tier detection and enterprise features already abstracted

---

## Summary

Stage 1 of TaxFlow Pro delivers a comprehensive, production-grade tax document management platform that leverages Box Platform as the secure storage and compliance backbone while providing intelligent workflow automation, AI-powered document processing, and role-tailored user experiences. The platform is architected for scalability, resilience, and extensibility — providing a solid foundation for Stage 2 enhancements.

---

*Document prepared by the TaxFlow Pro development team. For questions or clarifications, please contact the project lead.*
