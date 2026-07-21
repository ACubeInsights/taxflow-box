/**
 * Single source of truth for role metadata.
 * Used by TopNav, Breadcrumb, and any role-aware component.
 */

export const ROLE_META = {
  superadmin: { label: 'Admin',    badgeLabel: 'Admin',    color: 'var(--color-primary)' },
  employee:   { label: 'Preparer', badgeLabel: 'Preparer', color: 'var(--color-secondary)' },
  client:     { label: 'Client',   badgeLabel: 'Client',   color: 'var(--color-tertiary)' },
}

/**
 * Status colors for client engagement status.
 * Separate from document workflow statuses in statusColors.js.
 */
export const ENGAGEMENT_STATUS_COLORS = {
  Active:    'var(--color-success)',
  On_Hold:   'var(--color-warning)',
  Complete:  'var(--color-on-surface-variant)',
}

/**
 * Entity type color palette for client badges.
 */
export const ENTITY_COLORS = {
  Individual:  '#06b6d4',
  Business:    '#a78bfa',
  Trust:       '#f59e0b',
  'S-Corp':    '#ec4899',
  Partnership: '#3b82f6',
  LLC:         '#10b981',
  'C-Corp':    '#f43f5e',
  'Non-Profit':'#8b5cf6',
}

/**
 * Priority colors used across document views.
 */
export const PRIORITY_COLORS = {
  Urgent: 'var(--color-error)',
  High:   '#f97316',
  Medium: 'var(--color-warning)',
  Low:    'var(--color-on-surface-variant)',
}
