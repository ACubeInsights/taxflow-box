/**
 * Role and engagement metadata — Folio Desk tokens only.
 */

export const ROLE_META = {
  superadmin: { label: 'Admin',    badgeLabel: 'Admin',    color: 'var(--color-signal)' },
  employee:   { label: 'Preparer', badgeLabel: 'Preparer', color: 'var(--color-trace)' },
  client:     { label: 'Client',   badgeLabel: 'Client',   color: 'var(--color-commit)' },
}

/** Engagement status → Folio Rail spine */
export const ENGAGEMENT_STATUS_COLORS = {
  Active:   'var(--color-trace)',
  On_Hold:  'var(--color-hold)',
  Complete: 'var(--color-commit)',
}

/** Entity types — Trace / Hold / Whisper only (no rainbow) */
export const ENTITY_COLORS = {
  Individual:  'var(--color-trace)',
  Business:    'var(--color-hold)',
  Trust:       'var(--color-whisper)',
  'S-Corp':    'var(--color-trace)',
  Partnership: 'var(--color-hold)',
  LLC:         'var(--color-trace)',
  'C-Corp':    'var(--color-hold)',
  'Non-Profit':'var(--color-whisper)',
}

export const PRIORITY_COLORS = {
  Urgent: 'var(--color-flag)',
  High:   'var(--color-hold)',
  Medium: 'var(--color-trace)',
  Low:    'var(--color-whisper)',
}
