import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export default function RevisionAlert({ comments }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-xl border border-red-500/20 p-4 backdrop-blur-xl"
      style={{ background: 'rgba(239,68,68,0.08)' }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
        <div>
          <h4 className="m-0 text-sm font-semibold text-red-400">
            Revision Requested
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            {comments}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
