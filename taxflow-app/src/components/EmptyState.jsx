import { motion } from 'framer-motion'

/**
 * EmptyState — Folio Desk quiet empty layout.
 */
export default function EmptyState({ icon: Icon, title, subtitle, action, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay / 1000, duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center px-[var(--space-4)] py-[var(--space-12)] text-center"
    >
      {Icon && (
        <div
          className="mb-[var(--space-4)] flex h-12 w-12 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-ledger)]"
          aria-hidden
        >
          <Icon size={22} className="text-[var(--color-whisper)]" strokeWidth={1.5} />
        </div>
      )}
      <p className="m-0 mb-[var(--space-1)] text-sm font-medium text-[var(--color-ink)]">{title}</p>
      {subtitle && (
        <p className="m-0 max-w-[260px] text-sm leading-relaxed text-[var(--color-whisper)]">
          {subtitle}
        </p>
      )}
      {action && (
        <button type="button" onClick={action.onClick} className="btn-ghost mt-[var(--space-4)]">
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
