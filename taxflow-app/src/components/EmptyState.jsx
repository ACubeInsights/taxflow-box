import { motion } from 'framer-motion'

/**
 * EmptyState — A considered empty state layout used whenever a list or
 * data panel has no content. Replaces bare icon + p text patterns.
 *
 * Props:
 *   icon      — Lucide icon component
 *   title     — Primary message
 *   subtitle  — Secondary detail (optional)
 *   action    — { label, onClick } — optional CTA button
 *   delay     — framer-motion entry delay in ms (default 0)
 */
export default function EmptyState({ icon: Icon, title, subtitle, action, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {Icon && (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)]">
          <Icon
            size={22}
            className="text-[var(--color-on-surface-variant)]"
            strokeWidth={1.5}
            style={{ opacity: 0.5 }}
          />
        </div>
      )}
      <p className="m-0 text-[14px] font-semibold text-[var(--color-on-surface)] mb-1">
        {title}
      </p>
      {subtitle && (
        <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] max-w-[260px] leading-relaxed">
          {subtitle}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold cursor-pointer bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-all active:scale-95"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
