import { motion } from 'framer-motion'
import { FileText, Calendar, ChevronRight } from 'lucide-react'
import { StatusBadge, Badge } from './ui'

const PRIORITY_COLORS = {
  Low: '#6b7280',
  Medium: '#3b82f6',
  High: '#f97316',
  Urgent: '#ef4444',
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function DocumentRequestList({ requests, onSelect }) {
  return (
    <motion.div
      className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl p-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-white/50">
        Document Requests
      </h3>

      <div className="flex flex-col gap-2">
        {requests.map((req) => {
          const isClickable = req.status === 'Under_Review'

          return (
            <motion.div
              key={req.id}
              variants={itemVariants}
              onClick={() => isClickable && onSelect(req.id)}
              className={`group flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3 transition-all duration-150 ${
                isClickable
                  ? 'cursor-pointer hover:bg-white/[0.06] hover:translate-x-[2px]'
                  : 'cursor-default'
              }`}
            >
              {/* Icon */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/40">
                <FileText size={16} />
              </div>

              {/* Name + Due date */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{req.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-white/35">
                  <Calendar size={11} />
                  {req.dueDate}
                </p>
              </div>

              {/* Priority badge */}
              <Badge color={PRIORITY_COLORS[req.priority] || '#6b7280'}>
                {req.priority}
              </Badge>

              {/* Status badge */}
              <StatusBadge status={req.status} />

              {/* Chevron for clickable rows */}
              {isClickable && (
                <ChevronRight
                  size={14}
                  className="shrink-0 text-white/20 transition-colors duration-150 group-hover:text-white/50"
                />
              )}
            </motion.div>
          )
        })}

        {requests.length === 0 && (
          <p className="py-8 text-center text-sm text-white/30">
            No document requests yet
          </p>
        )}
      </div>
    </motion.div>
  )
}
