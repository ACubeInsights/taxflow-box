import { motion } from 'framer-motion'

// Shared stat card component
export function StatCard({ label, value, change, changeType, color = '#06b6d4', icon: Icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-6 py-[22px] cursor-default transition-[transform,box-shadow,border-color] duration-200"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 12px 40px ${color}15`
        e.currentTarget.style.borderColor = `${color}25`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
      }}
    >
      <div
        className="pointer-events-none absolute top-0 right-0 h-[100px] w-[100px]"
        style={{
          background: `radial-gradient(circle at 100% 0%, ${color}10, transparent 70%)`,
        }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-3 text-xs font-medium tracking-wide text-white/40">
            {label}
          </p>
          <p className="text-[30px] font-bold leading-none tracking-tight text-white">
            {value}
          </p>
          {change && (
            <p className={`mt-2 text-xs font-medium ${changeType === 'up' ? 'text-emerald-400' : changeType === 'down' ? 'text-red-400' : 'text-white/35'}`}>
              {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : ''} {change}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `${color}15`,
              border: `1px solid ${color}25`,
            }}
          >
            <Icon size={18} color={color} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function SectionHeader({ title, subtitle, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className="mb-5"
    >
      <h2 className="m-0 text-[22px] font-bold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[13px] font-normal text-white/35">{subtitle}</p>}
    </motion.div>
  )
}

export function GlassPanel({ children, style = {}, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className={`rounded-[18px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-6 ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export function PanelTitle({ children }) {
  return (
    <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-white/50">
      {children}
    </h3>
  )
}

export function StatusDot({ color = '#34d399', pulse = false }) {
  return (
    <span
      className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${pulse ? 'animate-pulse' : ''}`}
      style={{
        background: color,
        boxShadow: `0 0 6px ${color}80`,
      }}
    />
  )
}

export function ProgressBar({ value, color = '#06b6d4', bg = 'rgba(255,255,255,0.06)' }) {
  return (
    <div className="h-[5px] overflow-hidden rounded-full" style={{ background: bg }}>
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: `${value}%`,
          background: color,
          boxShadow: `0 0 8px ${color}60`,
        }}
      />
    </div>
  )
}

export function Badge({ children, color = '#06b6d4' }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide"
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

const STATUS_COLORS = {
  Pending: '#6b7280',
  Under_Review: '#eab308',
  Revision_Requested: '#ef4444',
  Approved: '#22c55e',
}

const STATUS_LABELS = {
  Pending: 'Pending',
  Under_Review: 'Under Review',
  Revision_Requested: 'Revision Requested',
  Approved: 'Approved',
}

export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  const label = STATUS_LABELS[status] || status

  return (
    <motion.span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide"
      animate={{
        backgroundColor: `${color}15`,
        borderColor: `${color}25`,
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

