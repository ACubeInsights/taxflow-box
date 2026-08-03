/**
 * Document workflow status enum and valid state machine transitions.
 *
 * NOTE: Box metadata (taxflow_document.status) is the authoritative source when a
 * file exists on enterprise tier. This frontend copy must stay aligned with
 * boxDocumentStatusService API_TO_BOX_STATUS mappings.
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
