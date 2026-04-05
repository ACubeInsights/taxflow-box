/**
 * Document workflow status enum and valid state machine transitions.
 *
 * NOTE: The backend `reviewService.js` is the authoritative source for status
 * transitions. This frontend copy must stay in sync with the backend definition.
 * Any discrepancy should be resolved in favor of the backend.
 *
 * @module statusTransitions
 * @see Requirements 5.5
 */

/** Document status values (6-status model) */
export const DocumentStatus = {
  Not_Requested: 'Not_Requested',
  Uploaded: 'Uploaded',
  Under_Review: 'Under_Review',
  Revision_Requested: 'Revision_Requested',
  Approved: 'Approved',
  Waived: 'Waived',
}

/** Valid state machine transitions between document statuses */
export const VALID_TRANSITIONS = {
  [DocumentStatus.Not_Requested]: [DocumentStatus.Uploaded],
  [DocumentStatus.Uploaded]: [DocumentStatus.Under_Review],
  [DocumentStatus.Under_Review]: [DocumentStatus.Approved, DocumentStatus.Revision_Requested, DocumentStatus.Waived],
  [DocumentStatus.Revision_Requested]: [DocumentStatus.Uploaded],
  [DocumentStatus.Approved]: [DocumentStatus.Under_Review], // undo within 10-min window
  [DocumentStatus.Waived]: [], // terminal
}
