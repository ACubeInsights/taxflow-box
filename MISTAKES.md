# MISTAKES LEDGER

This is a living engineering ledger. Every mistake identified — by any source — is logged here with full context, root cause, correct behavior, and a permanent rule to prevent recurrence.

---

## MISTAKE #1 — Webhook signature verification missing timestamp in HMAC
**Date identified:** June 26, 2026
**What happened:** The `webhookService.js` `verifySignature()` method computes HMAC-SHA256 over only the request body. Box's official documentation specifies the HMAC must be computed over `body_bytes + timestamp_bytes` (the `BOX-DELIVERY-TIMESTAMP` header value appended to the body). Additionally, no timestamp age validation (10-minute window) is performed. This was not flagged during Phase 1 inventory.
**Root cause:** Original implementation followed an incomplete understanding of the Box webhook signature verification protocol. The Phase 1 review did not cross-reference the existing verification logic against Box documentation.
**Correct behavior:** HMAC must include both body and timestamp. Timestamp must be validated as not older than 10 minutes. Both checks are mandatory before trusting a payload.
**Permanent rule:** When reviewing any security-critical integration (signature verification, token handling, authentication), always verify the implementation against the official vendor documentation before marking it as "complete" in any inventory or review.

---


## MISTAKE #2 — Failed to verify Box Enterprise account connectivity in Phase 0
**Date identified:** June 26, 2026
**What happened:** During Phase 0 (Sandbox Confirmation), I confirmed the presence of `box_config.json` and its structure but did NOT make an actual API call to Box to verify connectivity, account tier, or sandbox operational status. The user explicitly has a Box Enterprise account with a working sandbox, and I should have verified this by calling the API.
**Root cause:** Assumed file presence equals connectivity. Skipped the actual validation step (making a Box API call to confirm the token exchange works and the enterprise ID resolves).
**Correct behavior:** Phase 0 should have executed a live API call (e.g., `GET /users/me`) to confirm JWT auth works, the enterprise is accessible, and the account tier is Enterprise.
**Permanent rule:** When confirming any external service connectivity, ALWAYS make a live API call. File presence and configuration structure are necessary but NOT sufficient. Verify end-to-end.

---

## MISTAKE #3 — Client dashboard empty due to permission model mismatch
**Date identified:** June 26, 2026
**What happened:** The client dashboard showed "Welcome, Test Client" and vault header but no files or folder sections. Two root causes: (1) the `resource_permissions` table had a permission for the wrong folder ID (`394225316458`) instead of the actual vault folders (`394205118513`), and (2) the `/:folderId/files` endpoint filtered files by per-file explicit permissions only — files without their own permission entry were excluded even when the parent folder was accessible.
**Root cause:** When test data was seeded, permission records were created with incorrect folder IDs (likely from a different test run). The file-listing logic required explicit per-file permissions instead of inheriting from the parent folder's access level — a design gap.
**Correct behavior:** (1) Permission records must reference the actual Box folder IDs from the client_vaults table. (2) Files inherit access level from their parent folder when no explicit file-level permission exists.
**Permanent rule:** When seeding test data, always verify foreign key references (resource_permissions.resource_id) match the actual resource IDs in related tables (client_vaults). When implementing permission-based filtering, always support inheritance: if a parent container is accessible, children inherit that access unless explicitly overridden.

---

## MISTAKE #4 — Employee uploaded to wrong "Uploads" folder due to ambiguous folder names
**Date identified:** June 26, 2026
**What happened:** The client vault root contained two folders named "Uploads" at different hierarchy levels: one at `Vault Root > Uploads` (394225316458) and another at `Vault Root > 2025 > Projects > Uploads` (394205118513). The client dashboard was configured to read from the nested one, but the employee navigated to the root-level one and uploaded there. The file never appeared in the client's view.
**Root cause:** The employee VaultTab had no indication of which folder is the "active" vault-mapped folder that the client sees. All folders look identical regardless of their significance in the vault mapping. Combined with duplicate folder names at different levels, this made it trivial to upload to the wrong place.
**Correct behavior:** The employee VaultTab must visually distinguish vault-mapped folders (the ones the client's dashboard reads from) with clear badges/labels. This removes ambiguity completely.
**Permanent rule:** Any folder browsing UI that serves as a management interface for a separate user's view MUST indicate which folders are mapped/active for that user. Never present a flat folder tree without context about what the target user sees.

---
