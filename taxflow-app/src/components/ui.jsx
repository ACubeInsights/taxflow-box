import { motion } from 'framer-motion'
import { STATUS_COLORS as WORKFLOW_STATUS_COLORS } from '../context/DocumentWorkflowContext'

// Shared stat card component
export function StatCard({ label, value, change, changeType, color = 'var(--color-primary)', icon: Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[20px] bg-[var(--color-surface-container)] p-6 cursor-default transition-all duration-300 group ring-1 ring-[var(--color-outline-variant)] hover:ring-[var(--color-outline)]"
      style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
    >
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-[150px] w-[150px] rounded-full blur-[40px] opacity-20 transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="mb-2 text-[12px] font-semibold tracking-wider text-[var(--color-on-surface-variant)] uppercase">
            {label}
          </p>
          <p className="text-[36px] font-bold leading-none tracking-tight text-[var(--color-on-surface)] font-display mb-1">
            {value}
          </p>
          {change && (
            <p className={`mt-2 text-[12px] font-medium ${changeType === 'up' ? 'text-emerald-400' : changeType === 'down' ? 'text-[#ffb4ab]' : 'text-[var(--color-on-surface-variant)]'}`}>
              {changeType === 'up' ? '↗' : changeType === 'down' ? '↘' : ''} {change}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[12px] transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `color-mix(in srgb, ${color} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}
          >
            <Icon size={20} color={color} strokeWidth={2.5} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function SectionHeader({ title, subtitle, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className="mb-6"
    >
      <h2 className="m-0 text-[32px] font-bold tracking-tight text-[var(--color-on-surface)] font-display leading-tight">{title}</h2>
      {subtitle && <p className="mt-2 text-[14px] font-medium text-[var(--color-on-surface-variant)] max-w-2xl">{subtitle}</p>}
    </motion.div>
  )
}

export function GlassPanel({ children, style = {}, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className={`rounded-[24px] bg-[var(--color-surface-container)]/40 backdrop-blur-2xl p-7 ring-1 ring-[var(--color-outline-variant)] shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden ${className}`}
      style={{
        ...style,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.4)'
      }}
    >
      {children}
    </motion.div>
  )
}

export function PanelTitle({ children }) {
  return (
    <h3 className="mb-5 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-on-surface-variant)]">
      {children}
    </h3>
  )
}

export function StatusDot({ color = 'var(--color-primary)', pulse = false }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${pulse ? 'animate-pulse' : ''}`}
      style={{
        background: color,
        boxShadow: `0 0 8px ${color}`,
      }}
    />
  )
}

export function ProgressBar({ value, color = 'var(--color-primary)', bg = 'var(--color-surface-highest)' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: bg }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: `${value}%`,
          background: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    </div>
  )
}

export function Badge({ children, color = 'var(--color-primary)' }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        color: color,
      }}
    >
      {children}
    </span>
  )
}

const LEGACY_STATUS_COLORS = {
  Pending: 'var(--color-on-surface-variant)',
}

const STATUS_LABELS = {
  Not_Requested: 'Not Requested',
  Uploaded: 'Uploaded',
  Under_Review: 'Under Review',
  Revision_Requested: 'Revision Requested',
  Approved: 'Approved',
  Waived: 'Waived',
  Pending: 'Pending',
}

export function StatusBadge({ status }) {
  const color = WORKFLOW_STATUS_COLORS[status] || LEGACY_STATUS_COLORS[status] || '#6b7280'
  const label = STATUS_LABELS[status] || status

  return (
    <motion.span
      className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-widest uppercase"
      animate={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        color: color,
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        border: '1px solid',
      }}
    >
      {label}
    </motion.span>
  )
}


