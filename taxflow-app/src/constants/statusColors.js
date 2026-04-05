/**
 * Single source of truth for document workflow status color and label mappings.
 * Used by DocumentWorkflowContext, ui.jsx, StatusFilterChips, and other components
 * that need to display status-related UI.
 *
 * @module statusColors
 * @see Requirements 5.3
 */

import { DocumentStatus } from './statusTransitions.js'

/** Color hex codes for each document workflow status */
export const STATUS_COLORS = {
  [DocumentStatus.Not_Requested]: '#6b7280',       // Gray
  [DocumentStatus.Uploaded]: '#3b82f6',             // Blue
  [DocumentStatus.Under_Review]: '#eab308',         // Yellow
  [DocumentStatus.Revision_Requested]: '#ef4444',   // Red
  [DocumentStatus.Approved]: '#22c55e',             // Green
  [DocumentStatus.Waived]: '#64748b',               // Slate
}

/** Human-readable labels for each document workflow status */
export const STATUS_LABELS = {
  [DocumentStatus.Not_Requested]: 'Not Requested',
  [DocumentStatus.Uploaded]: 'Uploaded',
  [DocumentStatus.Under_Review]: 'Under Review',
  [DocumentStatus.Revision_Requested]: 'Revision Requested',
  [DocumentStatus.Approved]: 'Approved',
  [DocumentStatus.Waived]: 'Waived',
  Pending: 'Pending',
}

/** Legacy status colors for backward compatibility */
export const LEGACY_STATUS_COLORS = {
  Pending: 'var(--color-on-surface-variant)',
}
