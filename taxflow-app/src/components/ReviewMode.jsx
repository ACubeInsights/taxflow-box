import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Bot } from 'lucide-react'
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
    <div className="mt-6 space-y-3 w-full max-w-[400px]">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-2 rounded-full bg-[var(--color-surface-container)]"
          style={{ width: w }}
        />
      ))}
    </div>
  )
}

export default function ReviewMode({ request, onApprove, onRequestRevision, onBack }) {
  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-4 py-2 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all duration-200 hover:bg-[var(--color-surface-container)] hover:text-[var(--color-on-surface)] active:scale-95 group"
      >
        <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1" />
        Back to Workspace
      </button>

      {/* Request info header */}
      <div className="mb-8 flex items-center gap-4">
        <h2 className="text-[28px] leading-none m-0 font-bold tracking-tight text-[var(--color-on-surface)]">
          {request.name}
        </h2>
        <StatusBadge status={request.status} />
      </div>

      {/* Split pane grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] gap-6">
        {/* Left pane — Document Preview */}
        <motion.div
          variants={leftPaneVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col h-full"
        >
          <GlassPanel className="h-full flex flex-col flex-1">
            <h3 className="mb-6 m-0 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70 flex items-center gap-2">
              <FileText size={14} /> Document Preview
            </h3>
            
            <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center rounded-[20px] border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)]/30 p-10 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[300px] bg-gradient-to-b from-[var(--color-surface-container)]/20 to-transparent pointer-events-none" />
              
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] shadow-sm relative z-10 rotating-border-container">
                <FileText size={32} className="text-[var(--color-on-surface-variant)]" />
              </div>
              
              <p className="m-0 mb-2 text-[16px] font-bold text-[var(--color-on-surface)] relative z-10 text-center">
                {request.name}
              </p>
              
              <p className="m-0 mb-8 text-[13px] text-[var(--color-on-surface-variant)] relative z-10 text-center">
                {request.uploadedFileName || 'document.pdf'}
              </p>
              
              <div className="relative z-10 w-full flex justify-center opacity-60 filter blur-[0.5px]">
                <SkeletonLines />
              </div>

              <div className="absolute bottom-6 inset-x-0 flex justify-center">
                   <div className="px-4 py-2 rounded-full bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] text-[12px] font-medium border border-[var(--color-outline-variant)] backdrop-blur-md flex items-center gap-2">
			<FileText size={14}/> Mock PDF Preview
		   </div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        {/* Right pane — AI Insights + Actions */}
        <motion.div
          variants={rightPaneVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-6"
        >
          <GlassPanel className="flex flex-col gap-6">
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-primary)]/80 flex items-center gap-2">
              <Bot size={14} /> Sentinel Insights
            </h3>
            <AIExtractionCard />
          </GlassPanel>

          <GlassPanel className="mt-auto">
             <h3 className="m-0 mb-5 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70">
              Review Actions
            </h3>
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
