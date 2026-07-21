import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass, ArrowLeft } from 'lucide-react'

export default function NotFoundView() {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center max-w-[360px]"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)]">
          <Compass size={24} className="text-[var(--color-on-surface-variant)]" strokeWidth={1.5} style={{ opacity: 0.5 }} />
        </div>
        <h2 className="m-0 text-[20px] font-bold text-[var(--color-on-surface)] tracking-tight font-display mb-2">
          Page not found
        </h2>
        <p className="m-0 text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-all active:scale-95"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </button>
      </motion.div>
    </div>
  )
}
