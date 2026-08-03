# TaxFlow Pro — System Architecture

## High-Level Overview

```mermaid
graph TB
    subgraph Frontend["taxflow-app (React + Vite, :5173)"]
        App[App.jsx]
        Auth[AuthContext]
        DWC[DocumentWorkflowContext]
        API[api.js Service Layer]
        
        subgraph Dashboards
            SA[SuperAdmin Dashboard]
            CXO[CXO Dashboard]
            EMP[Employee Dashboard]
            CLI[Client Dashboard]
        end
        
        subgraph Views
            CDV[ClientDetailView]
            PDV[ProjectDetailView]
            DDV[DocumentDetailView]
        end
        
        subgraph Components
            Review[ReviewMode + ApprovalActions]
            Upload[UploadDropzone + ClientUploadView]
            Comments[CommentsThread]
            DocReq[DocumentRequestCreator]
            AICard[AIExtractionCard]
        end
    end

    subgraph Backend["taxflow-api (Express, :3001)"]
        subgraph Routes
            AuthR["auth routes"]
            ProjR["project routes"]
            DocR["document routes"]
            RevR["review routes"]
            PortR["portal routes"]
            OnbR["onboarding route"]
            WebhR["webhook route"]
            EmpR["employee routes"]
            SignR["sign routes"]
            CompR["compliance routes"]
            NotifR["notification routes"]
            TokenR["token routes"]
        end
        
        subgraph Services
            AuthS[AuthService]
            ProjS[ProjectService]
            OnbS[OnboardingService]
            WebhS[WebhookService]
            RevS[ReviewService]
            STS[StatusTransitionService]
            UploadS[UploadService]
            EmailS[EmailService]
            NotifS[NotificationService]
            SignS[SignService]
            CompS[ComplianceService]
            AIExtS[AIExtractionService]
            BoxSvc[BoxService]
            CommentS[CommentService]
            PortalS[PortalService]
            TokenS[TokenService]
            DocTypeS[DocumentTypeService]
        end
        
        subgraph Infrastructure
            DB[("SQLite or PostgreSQL")]
            Cache[CacheLayer]
            CB[CircuitBreaker]
            RL[RateLimiter]
            Audit[AuditEngine]
            Logger[Logger]
        end
    end

    subgraph BoxWrapper["box-wrapper-service (TypeScript Library)"]
        JWT[JWTAuthModule]
        Schema[SchemaSyncEngine]
        BWS[BoxWrapperService]
    end

    subgraph External["External Services"]
        BoxAPI[Box Platform API]
        SMTP[SMTP Server]
    end

    %% Frontend → Backend
    API -->|"REST + Bearer Token"| Routes

    %% Backend internal wiring
    Routes --> Services
    Services --> DB
    BoxSvc --> BWS
    
    %% Box Wrapper → Box API
    JWT -->|JWT Auth| BoxAPI
    BWS --> JWT
    BWS --> Schema
    Schema -->|Metadata Templates| BoxAPI
    BWS -->|Folders, Files, Metadata| BoxAPI
    
    %% Backend → External
    EmailS -->|SMTP| SMTP
    WebhS -->|Register/Verify| BoxAPI
    BoxAPI -->|Webhook Events| WebhR
    OnbS --> BoxSvc
    UploadS --> BoxSvc
    SignS -->|Box Sign| BoxAPI
```

## Data Model (Entity Relationships)

```mermaid
erDiagram
    USERS {
        text id PK
        text box_user_id UK
        text email UK
        text name
        text role "superadmin|cxo|employee|client"
        text password_hash
        datetime created_at
        datetime deleted_at
    }
    
    CLIENTS {
        text id PK
        text name
        text email UK
        text entity_type
        text engagement_status "Active|Inactive"
        text box_folder_id
        text box_user_id
        text external_id
        datetime created_at
    }
    
    PROJECTS {
        text id PK
        text client_id FK
        text name
        text description
        text status "Active|Completed|Archived"
        datetime created_at
    }
    
    DOCUMENT_REQUESTS {
        text id PK
        text project_id FK
        text client_id FK
        text name
        text document_type
        date due_date
        text priority "High|Medium|Low"
        text status "6-state lifecycle"
        text revision_comments
        text uploaded_file_name
        text box_file_id
        integer version "optimistic concurrency"
        boolean is_draft
        text created_by
    }
    
    EMPLOYEE_CLIENTS {
        text id PK
        text employee_id FK
        text client_id FK
        datetime assigned_at
    }
    
    SESSIONS {
        text token PK
        text user_id FK
        text email
        text role
        datetime expires_at
    }
    
    CLIENT_VAULTS {
        text client_id FK
        text financial_year
        text root_folder_id
        text year_folder_id
        text projects_folder_id
        text tax_folder_id
        text uploads_folder_id
        text supporting_docs_folder_id
        text signed_documents_folder_id
        text internal_notes_folder_id
    }
    
    COMMENTS {
        text id PK
        text document_id FK
        text type "review|internal|system"
        text author_id
        text author_name
        text text
        text mentions
        datetime created_at
    }
    
    NOTIFICATIONS {
        text id PK
        text recipient_id FK
        text event_type
        text message
        boolean read
        datetime created_at
    }

    USERS ||--o{ EMPLOYEE_CLIENTS : "assigned to"
    CLIENTS ||--o{ EMPLOYEE_CLIENTS : "managed by"
    CLIENTS ||--o{ PROJECTS : "owns"
    CLIENTS ||--|| CLIENT_VAULTS : "has vault"
    PROJECTS ||--o{ DOCUMENT_REQUESTS : "contains"
    DOCUMENT_REQUESTS ||--o{ COMMENTS : "has"
    USERS ||--o{ SESSIONS : "has"
    USERS ||--o{ NOTIFICATIONS : "receives"
```

## Document Workflow State Machine

```mermaid
stateDiagram-v2
    [*] --> Not_Requested : Document request created
    
    Not_Requested --> Uploaded : Client uploads file
    
    Uploaded --> Under_Review : Employee starts review
    
    Under_Review --> Approved : Employee approves
    Under_Review --> Revision_Requested : Employee requests revision\n(comment 10-1000 chars required)
    Under_Review --> Waived : Employee waives requirement
    
    Revision_Requested --> Uploaded : Client re-uploads
    
    Approved --> Under_Review : Undo (within 10-min window)
    
    Waived --> [*] : Terminal state
    Approved --> [*] : Terminal state\n(after 10-min undo window)

    note right of Approved
        10-minute undo window
        Optimistic concurrency (version field)
        Audit trail on every transition
    end note
    
    note right of Revision_Requested
        Triggers email notification
        to client with deep link
    end note
```

## Client Onboarding Flow

```mermaid
sequenceDiagram
    participant E as Employee (Frontend)
    participant API as taxflow-api
    participant Box as Box Platform API
    participant SMTP as Email Server

    E->>API: POST /api/onboarding
    
    Note over API: Phase 1: Create App User
    API->>Box: Create platform-access-only user
    Box-->>API: userId, login
    
    Note over API: Phase 2: Folder Hierarchy
    API->>Box: Create root folder: "ClientName (externalId)"
    API->>Box: Create year folder (e.g., "2025")
    API->>Box: Create "Projects" folder
    API->>Box: Create subfolders: Tax, Uploads, SupportingDocs, SignedDocuments, InternalNotes
    Box-->>API: folder IDs
    
    Note over API: Phase 3: Folder Locks (enterprise only)
    API->>Box: Lock root, SignedDocuments, InternalNotes
    
    Note over API: Phase 4: Collaborations
    API->>Box: Client gets Uploads (viewer_uploader)
    API->>Box: Client gets Tax (viewer)
    API->>Box: Client gets SignedDocuments (viewer)
    API->>Box: Employee gets root (editor)
    
    Note over API: Phase 5: Webhook
    API->>Box: Register webhook on root folder
    Box-->>API: webhookId + signature keys
    
    Note over API: Phase 6: File Request
    API->>Box: Copy file request template to Uploads folder
    Box-->>API: file request URL
    
    API-->>E: Complete onboarding result
    API->>SMTP: Welcome email to client
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as taxflow-app
    participant BE as taxflow-api
    participant DB as Database
    participant Box as Box API

    U->>FE: Enter email + password
    FE->>BE: POST /api/auth/login {email, password}
    
    alt DB user found
        BE->>DB: Find user by email
        DB-->>BE: user record
        BE->>BE: Verify password hash
    else Fallback to Box
        BE->>Box: Get all users (with external_app_user_id)
        Box-->>BE: user list
        BE->>BE: Match email in externalAppUserId field
        BE->>BE: Verify password from encoded field
        BE->>DB: Auto-sync user to local DB
    end
    
    BE->>DB: Create session (token, userId, expiresAt)
    BE-->>FE: {sessionToken, user, expiresAt, vault?}
    
    FE->>FE: Store in sessionStorage
    FE->>FE: Set Authorization header
    FE->>FE: Start inactivity timer (30 min)
    FE->>FE: Schedule token refresh (5 min before expiry)
    
    Note over FE: On 401 response
    FE->>FE: Dispatch 'auth-unauthorized' event
    FE->>FE: Auto-logout + clear session
```

## Box Folder Hierarchy (Per Client)

```mermaid
graph TD
    Root["📁 Root Folder (BOX_ROOT_FOLDER_ID)"]
    Client["📁 ClientName (externalId)"]
    Year["📁 2025"]
    Projects["📁 Projects"]
    Tax["📁 Tax"]
    Uploads["📁 Uploads"]
    Support["📁 SupportingDocs"]
    Signed["📁 SignedDocuments"]
    Internal["📁 InternalNotes"]
    
    Root --> Client
    Client --> Year
    Year --> Projects
    Projects --> Tax
    Projects --> Uploads
    Projects --> Support
    Projects --> Signed
    Projects --> Internal
    
    style Tax fill:#e8f5e9
    style Uploads fill:#e3f2fd
    style Support fill:#fff3e0
    style Signed fill:#f3e5f5
    style Internal fill:#fce4ec
```

**Access Control Matrix:**

| Folder | Client Access | Employee Access |
|--------|--------------|-----------------|
| Root | — | Editor |
| Tax | Viewer | Editor (inherited) |
| Uploads | Viewer + Uploader | Editor (inherited) |
| SupportingDocs | — | Editor (inherited) |
| SignedDocuments | Viewer | Editor (inherited) |
| InternalNotes | **No Access** | Editor (inherited) |

## Frontend Routing & Role Access

```mermaid
graph LR
    subgraph Public
        Login["login"]
        Reset["reset-password"]
    end
    
    subgraph Authenticated
        Dash["dashboard"]
        CL["clients/:id"]
        PJ["projects/:id"]
        DOC["documents/:id"]
    end
    
    Login -->|Auth Success| Dash
    
    Dash -->|superadmin| SA[SuperAdminDashboard]
    Dash -->|cxo| CXO[CXODashboard]
    Dash -->|employee| EMP[EmployeeDashboard]
    Dash -->|client| CLI[ClientDashboard]
    
    SA --> CL
    EMP --> CL
    CL --> PJ
    PJ --> DOC
```

| Role | Dashboard | Can Navigate to Detail Views? |
|------|-----------|------------------------------|
| superadmin | SuperAdminDashboard | ✅ Full routing |
| cxo | CXODashboard | ❌ Dashboard only |
| employee | EmployeeDashboard | ✅ Full routing |
| client | ClientDashboard | ❌ Dashboard only |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Framer Motion, React Router |
| Backend | Express.js (ES modules), Node.js 18+ |
| Database | SQLite (dev) / PostgreSQL (prod) via Knex |
| Box Integration | box-node-sdk (JWT auth), TypeScript wrapper |
| Email | Nodemailer (SMTP) with retry |
| Testing | Vitest, fast-check (property-based) |
| Resilience | Circuit breaker, rate limiter, cache layer, retry with backoff |
