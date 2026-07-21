import { motion } from 'framer-motion'
import { STATUS_COLORS as WORKFLOW_STATUS_COLORS, STATUS_LABELS, LEGACY_STATUS_COLORS } from '../constants/statusColors'

/**
 * StatCard — Metric display card with ambient glow and icon.
 * Used in dashboards for KPI visualization.
 */
export function StatCard({ label, value, change, changeType, color = 'var(--color-primary)', icon: Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-xl p-5 cursor-default group border border-[var(--color-outline-variant)] hover:border-[var(--color-outline)] transition-colors duration-300"
      style={{
        background: 'var(--color-surface-container)',
      }}
    >
      {/* Ambient corner glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--color-on-surface-variant)] uppercase">
            {label}
          </p>
          <p className="text-[32px] font-bold leading-none tracking-tight text-[var(--color-on-surface)] font-display">
            {value}
          </p>
          {change && (
            <p className={`mt-2 text-[11px] font-semibold ${
              changeType === 'up' ? 'text-[var(--color-success)]' :
              changeType === 'down' ? 'text-[var(--color-error)]' :
              'text-[var(--color-on-surface-variant)]'
            }`}>
              {changeType === 'up' ? '+' : changeType === 'down' ? '' : ''}{change}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105"
            style={{
              background: `${color}12`,
              border: `1px solid ${color}20`,
            }}
          >
            <Icon size={18} color={color} strokeWidth={2} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * SectionHeader — Section title with optional subtitle.
 */
export function SectionHeader({ title, subtitle, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6"
    >
      <h2 className="m-0 text-[24px] font-bold tracking-tight text-[var(--color-on-surface)] font-display leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1.5 text-[13px] font-medium text-[var(--color-on-surface-variant)] max-w-xl">
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}

/**
 * GlassPanel — Container card with subtle glass effect.
 * The primary structural component for content grouping.
 */
export function GlassPanel({ children, style = {}, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-xl border border-[var(--color-outline-variant)] p-6 relative overflow-hidden ${className}`}
      style={{
        background: 'var(--color-surface-container)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.02) inset',
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * PanelTitle — Section label inside a GlassPanel.
 */
export function PanelTitle({ children }) {
  return (
    <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
      {children}
    </h3>
  )
}

/**
 * StatusDot — Small colored indicator circle.
 */
export function StatusDot({ color = 'var(--color-primary)', pulse = false }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${pulse ? 'animate-pulse-soft' : ''}`}
      style={{
        background: color,
        boxShadow: `0 0 6px ${color}60`,
      }}
    />
  )
}

/**
 * ProgressBar — Animated horizontal progress indicator.
 */
export function ProgressBar({ value, color = 'var(--color-primary)', bg = 'var(--color-surface-highest)' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: bg }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: color,
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
    </div>
  )
}

/**
 * Badge — Compact label chip with colored background.
 */
export function Badge({ children, color = 'var(--color-primary)' }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}25`,
        color: color,
      }}
    >
      {children}
    </span>
  )
}

/**
 * StatusBadge — Document workflow status indicator.
 * Automatically maps status to color and label.
 */
export function StatusBadge({ status }) {
  const color = WORKFLOW_STATUS_COLORS[status] || LEGACY_STATUS_COLORS[status] || '#6b7280'
  const label = STATUS_LABELS[status] || status

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
      style={{
        background: `${color}12`,
        border: `1px solid ${color}20`,
        color: color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 4px ${color}60` }}
      />
      {label}
    </span>
  )
}
