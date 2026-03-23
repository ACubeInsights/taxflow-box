import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'

export default function RevisionCommentArea({ onSubmit }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    const trimmed = comment.trim()
    if (!trimmed) {
      setError('Please provide revision comments')
      return
    }
    setError('')
    onSubmit(trimmed)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div className="mt-5 space-y-4 rounded-[16px] bg-[var(--color-surface-container)]/50 p-5 border border-[var(--color-outline-variant)]">
        <div className="flex flex-col gap-2">
           <label className="text-[12px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
             Revision Notes <span className="text-[#ffb4ab]">*</span>
           </label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                if (error) setError('')
              }}
              placeholder="Detail exactly what needs to be changed or provided..."
              rows={4}
              className={`w-full resize-none rounded-[12px] border bg-[var(--color-surface-high)] px-4 py-3 text-[14px] text-[var(--color-on-surface)] placeholder-[var(--color-on-surface-variant)]/50 outline-none transition-all duration-200 focus:bg-[var(--color-surface-highest)] ${
                error ? 'border-[#ffb4ab]/60 focus:border-[#ffb4ab] focus:shadow-[0_0_0_2px_rgba(255,180,171,0.2)]' : 'border-[var(--color-outline-variant)] focus:border-[#ffb4ab]/80 focus:shadow-[0_0_0_2px_rgba(255,180,171,0.2)]'
              }`}
            />
        </div>
        
        {error && (
          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="m-0 text-[12px] font-bold text-[#ffb4ab]">{error}</motion.p>
        )}
        
        <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-[12px] bg-[#ffb4ab]/20 px-6 py-2.5 text-[14px] font-bold text-[#ffb4ab] border border-[#ffb4ab]/30 transition-all duration-200 hover:bg-[#ffb4ab]/30 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(255,180,171,0.15)]"
            >
              <Send size={16} strokeWidth={2.5} />
              Submit Revision
            </button>
        </div>
      </div>
    </motion.div>
  )
}
