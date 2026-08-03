/**
 * Folio Desk shared UI primitives.
 * Spacing/type/color must use CSS tokens — no ad-hoc hex.
 */

import { STATUS_COLORS, STATUS_LABELS, LEGACY_STATUS_COLORS } from '../constants/statusColors'

/** Flat content panel — replaces GlassPanel */
export function FolioPanel({ children, className = '', style = {}, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`folio-panel p-[var(--space-6)] ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Page / section title */
export function SectionHeader({ title, subtitle, as: Heading = 'h1' }) {
  return (
    <header className="mb-[var(--space-8)]">
      <Heading className="m-0 text-xl font-display font-bold text-[var(--color-ink)]">
        {title}
      </Heading>
      {subtitle && (
        <p className="m-0 mt-[var(--space-2)] text-sm font-medium text-[var(--color-whisper)] max-w-xl">
          {subtitle}
        </p>
      )}
    </header>
  )
}

/** Uppercase panel label inside FolioPanel */
export function PanelTitle({ children }) {
  return (
    <h2 className="label-caps m-0 mb-[var(--space-4)]">
      {children}
    </h2>
  )
}

/** Compact status chip — Folio Rail color, no glow */
export function Badge({ children, color = 'var(--color-trace)' }) {
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-chip)] px-[var(--space-2)] py-[var(--space-1)] text-xs font-medium tracking-[0.04em] uppercase"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        color,
      }}
    >
      {children}
    </span>
  )
}

/** Document workflow status */
export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || LEGACY_STATUS_COLORS[status] || 'var(--color-whisper)'
  const label = STATUS_LABELS[status] || status

  return (
    <span
      className="inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-chip)] px-[var(--space-2)] py-[var(--space-1)] text-xs font-medium tracking-[0.04em] uppercase"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        color,
      }}
    >
      <span
        className="folio-spine inline-block h-[10px] w-[3px] shrink-0"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}

/** Quiet progress — no glow */
export function ProgressBar({ value, color = 'var(--color-trace)' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div
      className="h-[6px] overflow-hidden rounded-[var(--radius-chip)]"
      style={{ background: varSafe('--color-ledger') }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-[var(--radius-chip)]"
        style={{
          width: `${clamped}%`,
          background: color,
          transition: `width var(--duration-standard) var(--ease-standard)`,
        }}
      />
    </div>
  )
}

function varSafe(name) {
  return `var(${name})`
}

/**
 * Folio Rail — signature vertical spine.
 * Used on list rows and as page procedural rail.
 */
export function FolioSpine({ color = 'var(--color-trace)', className = '' }) {
  return (
    <span
      className={`folio-spine self-stretch min-h-[20px] ${className}`}
      style={{ background: color }}
      aria-hidden
    />
  )
}

/** Row with leading FolioSpine — for client/document lists */
export function FolioRow({
  spineColor = 'var(--color-trace)',
  children,
  onClick,
  className = '',
  as: Tag = onClick ? 'button' : 'div',
}) {
  const interactive = Boolean(onClick)
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={`
        flex w-full items-stretch gap-[var(--space-4)]
        min-h-[var(--layout-row)]
        rounded-[var(--radius-panel)]
        border border-[var(--color-rule)]
        bg-[var(--color-folio)]
        text-left
        ${interactive ? 'cursor-pointer hover:bg-[var(--color-ledger)]' : ''}
        ${className}
      `}
    >
      <FolioSpine color={spineColor} className="rounded-l-[var(--radius-panel)] rounded-r-none min-h-full" />
      <div className="flex flex-1 items-center gap-[var(--space-4)] py-[var(--space-3)] pr-[var(--space-4)] min-w-0">
        {children}
      </div>
    </Tag>
  )
}

/* ── Back-compat aliases ── */
export const GlassPanel = FolioPanel
