import { useState } from 'react'
import { motion } from 'framer-motion'

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
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <div className="mt-4 space-y-3">
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value)
            if (error) setError('')
          }}
          placeholder="Describe what needs to be revised…"
          rows={4}
          className={`w-full resize-none rounded-xl border bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 backdrop-blur-sm outline-none transition-colors duration-200 ${
            error ? 'border-red-500/60' : 'border-white/[0.07] focus:border-white/20'
          }`}
        />
        {error && (
          <p className="text-xs font-medium text-red-400">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          className="rounded-xl bg-red-500/20 px-5 py-2.5 text-sm font-semibold text-red-400 border border-red-500/25 transition-all duration-100 hover:bg-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          Submit Revision
        </button>
      </div>
    </motion.div>
  )
}
