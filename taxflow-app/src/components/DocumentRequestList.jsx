import { motion } from 'framer-motion'
import { FileText, Calendar, ChevronRight } from 'lucide-react'
import { StatusBadge, Badge, GlassPanel } from './ui'

const PRIORITY_COLORS = {
  Low: 'var(--color-on-surface-variant)',
  Medium: 'var(--color-tertiary)',
  High: '#ffb4ab',
  Urgent: '#ffb4ab',
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
}

export default function DocumentRequestList({ requests, onSelect }) {
  return (
    <GlassPanel className="p-0 overflow-hidden">
      <div className="p-6 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/30 backdrop-blur-md flex justify-between items-center">
        <h3 className="m-0 text-[14px] font-bold uppercase tracking-[0.1em] text-[var(--color-on-surface)] flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)]" />
           Document Requests
        </h3>
        <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container)] px-2.5 py-1 rounded-full border border-[var(--color-outline-variant)]">
          {requests.length} total
        </span>
      </div>

      <motion.div
        className="flex flex-col p-3 gap-2"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {requests.map((req) => {
          const isClickable = req.status === 'Under_Review'

          return (
            <motion.div
              key={req.id}
              variants={itemVariants}
              onClick={() => isClickable && onSelect(req.id)}
              className={`group relative flex items-center gap-4 rounded-[16px] border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)]/50 px-5 py-4 transition-all duration-300 ${
                isClickable
                  ? 'cursor-pointer hover:bg-[var(--color-surface-container)] hover:border-[var(--color-on-surface-variant)]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-0.5'
                  : 'cursor-default'
              }`}
            >
              {/* Subtle hover background sweep for clickable items */}
              {isClickable && (
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface-container)]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[16px] pointer-events-none" />
              )}

              {/* Icon */}
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] transition-colors duration-300 group-hover:text-[var(--color-on-surface)]">
                <FileText size={18} strokeWidth={2} />
              </div>

              {/* Name + Due date */}
              <div className="min-w-0 flex-1 relative z-10">
                <p className="m-0 truncate text-[15px] font-bold text-[var(--color-on-surface)] tracking-tight transition-colors duration-300 group-hover:text-[var(--color-primary)]">{req.name}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-on-surface-variant)]">
                  <Calendar size={12} className="opacity-70" />
                  <span className="opacity-90">{req.dueDate}</span>
                </div>
              </div>

              {/* Badges container */}
              <div className="flex items-center gap-3 relative z-10">
                <Badge color={PRIORITY_COLORS[req.priority] || 'var(--color-on-surface-variant)'}>
                  {req.priority}
                </Badge>
                <StatusBadge status={req.status} />
              </div>

              {/* Chevron for clickable rows */}
              {isClickable && (
                <div className="relative z-10 flex w-6 items-center justify-end">
                   <ChevronRight
                    size={16}
                    strokeWidth={2.5}
                    className="shrink-0 text-[var(--color-on-surface-variant)] opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--color-primary)]"
                  />
                </div>
              )}
            </motion.div>
          )
        })}

        {requests.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
             <div className="w-12 h-12 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center text-[var(--color-on-surface-variant)]/50 border border-[var(--color-outline-variant)]">
                 <FileText size={20} />
             </div>
            <p className="m-0 text-[14px] font-medium text-[var(--color-on-surface-variant)]">
              No document requests yet
            </p>
          </div>
        )}
      </motion.div>
    </GlassPanel>
  )
}
