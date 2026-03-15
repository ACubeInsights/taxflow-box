import { motion } from 'framer-motion'
import { ArrowLeft, FileText } from 'lucide-react'
import { StatusBadge, GlassPanel } from './ui'
import AIExtractionCard from './AIExtractionCard'
import ApprovalActions from './ApprovalActions'

const leftPaneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: 0 } },
}

const rightPaneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: 0.15 } },
}

// Skeleton lines to simulate document text content
function SkeletonLines() {
  const widths = ['100%', '92%', '85%', '96%', '78%', '100%', '88%', '70%']
  return (
    <div className="mt-5 space-y-2.5">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-2 rounded-full bg-white/[0.06]"
          style={{ width: w }}
        />
      ))}
    </div>
  )
}

export default function ReviewMode({ request, onApprove, onRequestRevision, onBack }) {
  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/60 transition-all duration-100 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
      >
        <ArrowLeft size={16} />
        Back to Workspace
      </button>

      {/* Request info header */}
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight text-white">
          {request.name}
        </h2>
        <StatusBadge status={request.status} />
      </div>

      {/* Split pane grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left pane — Document Preview */}
        <motion.div
          variants={leftPaneVariants}
          initial="hidden"
          animate="visible"
        >
          <GlassPanel className="h-full">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-white/50">
              Document Preview
            </h3>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.07]">
                <FileText size={28} className="text-white/25" />
              </div>
              <p className="mb-1 text-sm font-semibold text-white/50">
                {request.name}
              </p>
              <p className="mb-6 text-xs text-white/30">
                {request.uploadedFileName || 'document.pdf'}
              </p>
              <SkeletonLines />
            </div>
          </GlassPanel>
        </motion.div>

        {/* Right pane — AI Insights + Actions */}
        <motion.div
          variants={rightPaneVariants}
          initial="hidden"
          animate="visible"
        >
          <GlassPanel className="h-full space-y-5">
            <h3 className="mb-0 text-[13px] font-semibold uppercase tracking-widest text-white/50">
              AI Insights
            </h3>
            <AIExtractionCard />
            <ApprovalActions
              onApprove={onApprove}
              onRequestRevision={onRequestRevision}
            />
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  )
}
