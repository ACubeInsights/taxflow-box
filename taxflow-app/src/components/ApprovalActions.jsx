import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CheckCircle, RotateCcw } from 'lucide-react'
import RevisionCommentArea from './RevisionCommentArea'

export default function ApprovalActions({ onApprove, onRequestRevision }) {
  const [showRevision, setShowRevision] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-2 rounded-[14px] border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/15 px-6 py-3.5 text-[14px] font-bold text-[var(--color-secondary)] transition-all duration-200 hover:bg-[var(--color-secondary)]/25 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_color-mix(in_srgb,var(--color-secondary)_15%,transparent)]"
        >
          <CheckCircle size={18} strokeWidth={2.5} />
          Approve Document
        </button>
        <button
          onClick={() => setShowRevision((prev) => !prev)}
          className="flex-1 flex items-center justify-center gap-2 rounded-[14px] border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-6 py-3.5 text-[14px] font-bold text-[#ffb4ab] transition-all duration-200 hover:bg-[#ffb4ab]/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <RotateCcw size={18} strokeWidth={2.5} />
          Request Revision
        </button>
      </div>

      <AnimatePresence>
        {showRevision && (
          <RevisionCommentArea
            onSubmit={(comments) => {
              onRequestRevision(comments)
              setShowRevision(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
