# Requirements Document

## Introduction

TaxFlow Pro requires a Box.com intelligent wrapper service that uses Box Content Cloud as the sole file system, metadata database, and security layer — eliminating the need for an external database. This backend service (TypeScript/Node.js) connects to Box via JWT Server-to-Server authentication using the Box Node SDK v10, manages a metadata template as a "virtual database," automates client vault folder creation with metadata cascade policies, and provides database-free retrieval of client vaults through the Box Metadata Query API. The architecture ensures HIPAA/IRS Pub 4557 compliance by keeping all client data and mappings within Box.

## Glossary

- **Box_Wrapper_Service**: The singleton TypeScript service that encapsulates all interactions with the Box Content Cloud API via the Box Node SDK v10.
- **Box_Client**: The authenticated SDK client instance obtained from the Box Node SDK, used to make API calls to Box Content Cloud.
- **JWT_Auth_Module**: The component responsible for loading Box JWT configuration and initializing the SDK using Server-to-Server (JWT) authentication.
- **Schema_Sync_Engine**: The component that ensures the required metadata template exists in the Box enterprise on service startup.
- **Metadata_Template**: A Box enterprise metadata template named `taxFlowClientProfile` that defines the structured fields applied to client vault folders.
- **Vault_Folder**: A Box folder representing a client's document vault, named in the format `[Client Name] ([External ID])`.
- **Metadata_Cascade_Policy**: A Box API policy that automatically propagates metadata from a parent folder to all child items (files and subfolders).
- **Metadata_Query_API**: The Box API endpoint that allows querying folders and files by their metadata field values, replacing traditional database lookups.
- **Service_Account**: The Box application identity used for JWT authentication, acting on behalf of the enterprise.
- **Client_External_ID**: A unique string identifier mapping a client from the external authentication provider to their Box vault.

## Requirements

### Requirement 1: SDK Initialization and JWT Authentication

**User Story:** As a backend service, I want to establish a singleton, authenticated connection to Box Content Cloud using JWT, so that all downstream operations have a reliable and performant API client.

#### Acceptance Criteria

1. WHEN the Box_Wrapper_Service is initialized, THE JWT_Auth_Module SHALL load the JWT configuration from a `box_config.json` file.
2. WHEN the JWT configuration is loaded, THE JWT_Auth_Module SHALL initialize the Box Node SDK v10 using `BoxNodeSDK.getPreconfiguredInstance(configJSON)`.
3. THE Box_Wrapper_Service SHALL expose a `getBoxClient()` method that returns an authenticated Box_Client instance.
4. THE Box_Wrapper_Service SHALL maintain a single Box_Client instance across all callers (singleton pattern).
5. WHEN the `getBoxClient()` method is called, THE Box_Wrapper_Service SHALL use the SDK's built-in token caching to avoid redundant authentication requests.
6. IF the JWT configuration file is missing or malformed, THEN THE JWT_Auth_Module SHALL throw a descriptive error indicating the configuration problem.
7. IF an API call fails due to a transient error, THEN THE Box_Client SHALL retry the request using the SDK v10 built-in automatic retry mechanism.

### Requirement 2: Metadata Schema Synchronization

**User Story:** As a system administrator, I want the metadata template to be automatically created or verified on service startup, so that the virtual database schema is always consistent without manual intervention.

#### Acceptance Criteria

1. WHEN the Box_Wrapper_Service starts, THE Schema_Sync_Engine SHALL check whether a Metadata_Template named `taxFlowClientProfile` exists in the `enterprise` scope.
2. IF the `taxFlowClientProfile` Metadata_Template does not exist, THEN THE Schema_Sync_Engine SHALL create the template with the following fields:
   - `client_external_id` (String, Indexed)
   - `client_email` (String, Indexed)
   - `tax_year_current` (String)
   - `vault_status` (Dropdown with options: Active, Pending, Archived)
   - `firm_id` (String)
3. IF the `taxFlowClientProfile` Metadata_Template already exists (HTTP 409 conflict), THEN THE Schema_Sync_Engine SHALL treat the conflict as a successful state and continue startup.
4. IF the Schema_Sync_Engine encounters an unexpected error during template creation, THEN THE Schema_Sync_Engine SHALL throw a descriptive error and prevent the service from completing startup.
5. THE Schema_Sync_Engine SHALL complete schema synchronization before the Box_Wrapper_Service accepts any vault operations.

### Requirement 3: Automated Vault Folder Creation

**User Story:** As a tax professional, I want a client vault folder to be automatically created with proper metadata and cascade policies, so that every document added to the vault is traceable without manual tagging.

#### Acceptance Criteria

1. WHEN `createAutomatedVault(clientName, externalId, email)` is called, THE Box_Wrapper_Service SHALL create a Vault_Folder named in the format `[clientName] ([externalId])`.
2. WHEN the Vault_Folder is created, THE Box_Wrapper_Service SHALL apply the `taxFlowClientProfile` Metadata_Template to the folder with the provided `externalId` as `client_external_id` and `email` as `client_email`.
3. WHEN the Metadata_Template is applied to the Vault_Folder, THE Box_Wrapper_Service SHALL create a Metadata_Cascade_Policy on the Vault_Folder that propagates the `taxFlowClientProfile` metadata to all child items.
4. WHEN the Metadata_Cascade_Policy is active, THE Metadata_Cascade_Policy SHALL ensure every file or subfolder added to the Vault_Folder automatically inherits the `client_external_id` and `firm_id` metadata fields from the parent folder.
5. WHEN `createAutomatedVault` completes successfully, THE Box_Wrapper_Service SHALL return the created Vault_Folder object including its Box folder ID.
6. IF the Vault_Folder creation fails, THEN THE Box_Wrapper_Service SHALL return a descriptive error indicating the failure reason.
7. IF the Metadata_Cascade_Policy creation fails after the folder is created, THEN THE Box_Wrapper_Service SHALL return a descriptive error that includes the created folder ID for manual remediation.

### Requirement 4: Database-Free Vault Retrieval

**User Story:** As a backend service, I want to retrieve a client's vault folder using only Box metadata queries, so that no external database is needed for client-to-folder mapping.

#### Acceptance Criteria

1. WHEN `findVaultByExternalId(externalId)` is called, THE Box_Wrapper_Service SHALL query the Metadata_Query_API using the `taxFlowClientProfile` template with `client_external_id` equal to the provided `externalId`.
2. WHEN the Metadata_Query_API returns a matching folder, THE Box_Wrapper_Service SHALL return the Vault_Folder object.
3. WHEN the Metadata_Query_API returns no matching results, THE Box_Wrapper_Service SHALL return `null`.
4. IF the Metadata_Query_API call fails due to a network or API error, THEN THE Box_Wrapper_Service SHALL throw a descriptive error indicating the query failure.
5. THE Box_Wrapper_Service SHALL use the metadata query format: `SELECT * FROM folder WHERE templateKey = 'taxFlowClientProfile' AND client_external_id = :id` with the `enterprise` scope.

### Requirement 5: Service Export and Integration

**User Story:** As a developer, I want the Box wrapper service to be exported as a module, so that Express controllers and other backend components can consume it.

#### Acceptance Criteria

1. THE Box_Wrapper_Service SHALL be exported as a singleton module from `src/services/BoxWrapperService.ts`.
2. THE Box_Wrapper_Service SHALL expose the following public methods: `getBoxClient()`, `syncMetadataSchema()`, `createAutomatedVault(clientName, externalId, email)`, and `findVaultByExternalId(externalId)`.
3. WHEN imported by an Express controller, THE Box_Wrapper_Service SHALL provide typed TypeScript interfaces for all method parameters and return values.
