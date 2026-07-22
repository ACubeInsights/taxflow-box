/**
 * Status colors — Folio Rail spine + status labels only.
 * All values are token references from index.css.
 */

import { DocumentStatus } from './statusTransitions.js'

export const STATUS_COLORS = {
  [DocumentStatus.Not_Requested]: 'var(--color-whisper)',
  [DocumentStatus.Uploaded]: 'var(--color-trace)',
  [DocumentStatus.Under_Review]: 'var(--color-hold)',
  [DocumentStatus.Revision_Requested]: 'var(--color-flag)',
  [DocumentStatus.Approved]: 'var(--color-commit)',
  [DocumentStatus.Waived]: 'var(--color-whisper)',
}

export const STATUS_LABELS = {
  [DocumentStatus.Not_Requested]: 'Not requested',
  [DocumentStatus.Uploaded]: 'Uploaded',
  [DocumentStatus.Under_Review]: 'Under review',
  [DocumentStatus.Revision_Requested]: 'Revision requested',
  [DocumentStatus.Approved]: 'Approved',
  [DocumentStatus.Waived]: 'Waived',
  Pending: 'Pending',
}

export const LEGACY_STATUS_COLORS = {
  Pending: 'var(--color-whisper)',
}
