import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CheckCircle, RotateCcw } from 'lucide-react'
import RevisionCommentArea from './RevisionCommentArea'

export default function ApprovalActions({ onApprove, onRequestRevision }) {
  const [showRevision, setShowRevision] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-row gap-3">
        <button
          onClick={onApprove}
          className="flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/20 px-5 py-2.5 text-sm font-semibold text-green-400 transition-all duration-100 hover:bg-green-500/30 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
        >
          <CheckCircle className="h-4 w-4" />
          Approve
        </button>
        <button
          onClick={() => setShowRevision((prev) => !prev)}
          className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/20 px-5 py-2.5 text-sm font-semibold text-red-400 transition-all duration-100 hover:bg-red-500/30 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" />
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
