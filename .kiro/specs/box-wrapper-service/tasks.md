# Implementation Plan: Box Wrapper Service

## Overview

Incrementally build the Box.com Intelligent Wrapper Service as a standalone TypeScript/Node.js project (`box-wrapper-service/`). Each task builds on the previous, starting with project scaffolding and JWT auth, then metadata schema sync, vault operations, and finally wiring the module export. All Box SDK calls are mocked in tests using Vitest + fast-check.

## Tasks

- [x] 1. Scaffold project structure and configuration
  - [x] 1.1 Initialize `box-wrapper-service/` directory with `package.json`, `tsconfig.json`, and `vitest.config.ts`
    - Add dependencies: `box-node-sdk` (v10), `typescript`
    - Add dev dependencies: `vitest`, `fast-check`, `@types/node`
    - Configure TypeScript with strict mode, ES module output, `src/` as root
    - Configure Vitest with test paths for `tests/unit/` and `tests/property/`
    - _Requirements: 5.1_
  - [x] 1.2 Create core type definitions and interfaces
    - Define `VaultFolder`, `CreateVaultResult`, `ServiceConfig`, `BoxJWTConfig`, and `TemplateField` interfaces
    - Place shared types in `src/types.ts`
    - _Requirements: 5.3_

- [x] 2. Implement JWT authentication module
  - [x] 2.1 Implement `JWTAuthModule` class in `src/auth/JWTAuthModule.ts`
    - Load and validate `box_config.json` from configurable path
    - Validate required fields: `boxAppSettings`, `clientID`, `clientSecret`, `appAuth`, `enterpriseID`
    - Initialize SDK via `BoxNodeSDK.getPreconfiguredInstance(configJSON)`
    - Cache the service account client (singleton)
    - Throw descriptive errors for missing file, invalid JSON, or missing fields
    - _Requirements: 1.1, 1.2, 1.5, 1.6_
  - [x] 2.2 Write property test: Singleton client identity (Property 1)
    - **Property 1: Singleton client identity**
    - Generate random call counts (2–50), call `getBoxClient()` that many times, verify all results are `===` to the first
    - **Validates: Requirements 1.4**
  - [x] 2.3 Write property test: Malformed configuration produces descriptive errors (Property 2)
    - **Property 2: Malformed configuration produces descriptive errors**
    - Generate random objects missing required fields or with wrong types, verify `initialize()` throws with a message mentioning the problematic field
    - **Validates: Requirements 1.6**
  - [x] 2.4 Write unit tests for `JWTAuthModule`
    - Test: loads valid config and returns a client (Req 1.1, 1.2)
    - Test: throws when config file is missing (Req 1.6)
    - Test: throws when config JSON is malformed (Req 1.6)
    - Test: `getBoxClient()` returns a BoxClient (Req 1.3)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 3. Implement metadata schema synchronization
  - [x] 3.1 Implement `SchemaSyncEngine` class in `src/schema/SchemaSyncEngine.ts`
    - Check if `taxFlowClientProfile` template exists in `enterprise` scope
    - If missing, create template with 5 fields: `client_external_id` (string), `client_email` (string), `tax_year_current` (string), `vault_status` (enum: Active/Pending/Archived), `firm_id` (string)
    - Treat 409 Conflict as success (template already exists)
    - Throw descriptive error on unexpected failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Write property test: Non-409 schema sync errors propagate (Property 3)
    - **Property 3: Non-409 schema sync errors propagate**
    - Generate random HTTP status codes (400–599 excluding 409), mock API to return that status, verify `syncMetadataSchema()` throws. Also verify 409 does not throw.
    - **Validates: Requirements 2.3, 2.4**
  - [x] 3.3 Write unit tests for `SchemaSyncEngine`
    - Test: calls metadata templates API on sync (Req 2.1)
    - Test: creates template with exactly 5 fields when missing (Req 2.2)
    - Test: succeeds silently on 409 conflict (Req 2.3)
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement BoxWrapperService singleton with vault operations
  - [x] 5.1 Implement `BoxWrapperService` class in `src/services/BoxWrapperService.ts`
    - Integrate `JWTAuthModule` for `getBoxClient()` with singleton caching
    - Integrate `SchemaSyncEngine` for `syncMetadataSchema()` with `schemaReady` flag
    - Guard `createAutomatedVault()` and `findVaultByExternalId()` behind schema readiness check
    - _Requirements: 1.3, 1.4, 2.5, 5.2_
  - [x] 5.2 Implement `createAutomatedVault()` method
    - Create folder named `"{clientName} ({externalId})"` under configurable root folder
    - Apply `taxFlowClientProfile` metadata with `client_external_id` and `client_email`
    - Create metadata cascade policy on the folder
    - Return `CreateVaultResult` with folder object and cascade policy ID
    - On cascade policy failure, include folder ID in error message for remediation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [x] 5.3 Implement `findVaultByExternalId()` method
    - Query Metadata Query API with `enterprise` scope, `taxFlowClientProfile` template, `client_external_id = :id`
    - Return matching `VaultFolder` or `null` if no results
    - Throw descriptive error on API failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 5.4 Write property test: Vault operations require schema readiness (Property 4)
    - **Property 4: Vault operations require schema readiness**
    - Generate random vault operation calls before sync completes, verify all throw schema-not-ready error
    - **Validates: Requirements 2.5**
  - [x] 5.5 Write property test: Vault folder naming format (Property 5)
    - **Property 5: Vault folder naming format**
    - Generate random non-empty strings for clientName and externalId, verify folder creation uses name `"{clientName} ({externalId})"` and result contains a folder ID
    - **Validates: Requirements 3.1, 3.5**
  - [x] 5.6 Write property test: Vault metadata contains provided values (Property 6)
    - **Property 6: Vault metadata contains provided values**
    - Generate random externalId and email strings, verify metadata API call payload contains `client_external_id === externalId` and `client_email === email`
    - **Validates: Requirements 3.2**
  - [x] 5.7 Write property test: Metadata query construction and result mapping (Property 7)
    - **Property 7: Metadata query construction and result mapping**
    - Generate random externalId strings and mock API responses with random folder data, verify query uses enterprise scope with correct parameters and result maps to VaultFolder with matching id and name
    - **Validates: Requirements 4.1, 4.2, 4.5**
  - [x] 5.8 Write unit tests for `BoxWrapperService`
    - Test: `createAutomatedVault()` calls folders API, metadata API, and cascade policy API in order (Req 3.3)
    - Test: error includes folder ID when cascade policy fails (Req 3.7)
    - Test: `findVaultByExternalId()` returns null when no results (Req 4.3)
    - Test: `findVaultByExternalId()` throws descriptive error on API failure (Req 4.4)
    - _Requirements: 3.3, 3.7, 4.3, 4.4_

- [x] 6. Wire module export and integration surface
  - [x] 6.1 Create `src/index.ts` module export
    - Instantiate and export `BoxWrapperService` singleton as default export
    - Export named `BoxWrapperService` class and type interfaces (`VaultFolder`, `CreateVaultResult`)
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 6.2 Write unit tests for module exports
    - Test: module exports singleton instance (Req 5.1)
    - Test: exported instance has all four public methods: `getBoxClient`, `syncMetadataSchema`, `createAutomatedVault`, `findVaultByExternalId` (Req 5.2)
    - _Requirements: 5.1, 5.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 iterations per property
- All Box SDK interactions are mocked in tests — no real API calls
- Checkpoints ensure incremental validation
