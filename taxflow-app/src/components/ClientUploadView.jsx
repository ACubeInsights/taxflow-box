import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, CheckCircle, Clock } from 'lucide-react'
import { useDocumentWorkflow } from '../context/DocumentWorkflowContext'
import { StatusBadge, Badge, GlassPanel } from './ui'
import UploadDropzone from './UploadDropzone'
import RevisionAlert from './RevisionAlert'

const PRIORITY_COLORS = {
  Low: 'var(--color-on-surface-variant)',
  Medium: 'var(--color-tertiary)',
  High: '#ffb4ab',
  Urgent: '#ffb4ab',
}

export default function ClientUploadView({ request, onBack }) {
  const { dispatch, vault } = useDocumentWorkflow()

  const handleUpload = (fileName) => {
    dispatch({
      type: 'UPLOAD_DOCUMENT',
      payload: { requestId: request.id, fileName },
    })
  }

  // Fallback folder ID for uploads when vault is not available (demo/dev mode)
  const uploadFolderId = vault?.root || vault?.uploads || vault?.id || '0'

  const isUploadable =
    request.status === 'Pending' || request.status === 'Revision_Requested'
  const isUnderReview = request.status === 'Under_Review'
  const isApproved = request.status === 'Approved'

  return (
    <div className="max-w-[1000px] mx-auto">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={onBack}
        className="inline-flex items-center gap-2 bg-transparent border-none text-[13px] font-bold text-[var(--color-on-surface-variant)] cursor-pointer py-2 mb-6 transition-colors duration-200 hover:text-[var(--color-on-surface)] group"
      >
        <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1" />
        Back to Documents
      </motion.button>

      {/* Document info panel */}
      <GlassPanel delay={50} className="mb-6">
        <h2 className="m-0 mb-3 text-[24px] font-bold text-[var(--color-on-surface)] tracking-tight leading-tight">
          {request.name}
        </h2>

        <p className="m-0 mb-6 text-[14px] text-[var(--color-on-surface-variant)] leading-relaxed max-w-[800px]">
          {request.description}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-on-surface-variant)] px-3 py-1.5 rounded-lg bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)]">
            <Calendar size={14} />
            <span>Due {request.dueDate}</span>
          </div>

          <Badge color={PRIORITY_COLORS[request.priority] || 'var(--color-on-surface-variant)'}>
            {request.priority}
          </Badge>

          <StatusBadge status={request.status} />
        </div>
      </GlassPanel>

      {/* Conditional content based on status */}
      <div className="mt-6">
        {/* Revision alert when status is Revision_Requested */}
        {request.status === 'Revision_Requested' && (
          <div className="mb-6">
            <RevisionAlert comments={request.revisionComments} />
          </div>
        )}

        {/* Upload dropzone for Pending and Revision_Requested */}
        {isUploadable && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
          >
            <UploadDropzone 
              onUpload={handleUpload} 
              disabled={false} 
              folderId={uploadFolderId}
              requestId={request.id}
            />
          </motion.div>
        )}

        {/* Under Review message */}
        {isUnderReview && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center gap-4 py-12 px-8 rounded-[24px] border bg-[var(--color-tertiary)]/5 text-center relative overflow-hidden"
            style={{ borderColor: 'color-mix(in srgb, var(--color-tertiary) 20%, transparent)' }}
          >
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[var(--color-tertiary)]/10 rounded-full blur-[60px] pointer-events-none" />
            
            <Clock size={48} className="text-[var(--color-tertiary)]" strokeWidth={1.5} />
            <p className="m-0 text-[18px] font-bold text-[var(--color-tertiary)] tracking-tight">
              Under Review
            </p>
            <p className="m-0 text-[14px] text-[var(--color-on-surface-variant)] max-w-[420px] leading-relaxed">
              Your document is being reviewed by your tax preparer. You'll be
              notified if any changes are needed.
            </p>

            <div className="w-full mt-6 opacity-60 grayscale-[50%] pointer-events-none max-w-[800px]">
              <UploadDropzone 
                onUpload={handleUpload} 
                disabled={true} 
                folderId={uploadFolderId}
                requestId={request.id}
              />
            </div>
          </motion.div>
        )}

        {/* Approved state with green checkmark animation */}
        {isApproved && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              delay: 0.1,
            }}
            className="flex flex-col items-center gap-4 py-12 px-8 rounded-[24px] border bg-[var(--color-secondary)]/5 text-center relative overflow-hidden"
            style={{ borderColor: 'color-mix(in srgb, var(--color-secondary) 25%, transparent)' }}
          >
            <div className="absolute top-0 left-0 w-[250px] h-[250px] bg-[var(--color-secondary)]/15 rounded-full blur-[80px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 15,
                delay: 0.2,
              }}
            >
              <CheckCircle size={64} className="text-[var(--color-secondary)] drop-shadow-[0_0_15px_color-mix(in_srgb,var(--color-secondary)_50%,transparent)]" strokeWidth={1.5} />
            </motion.div>
            <p className="m-0 text-[22px] font-bold text-[var(--color-secondary)] tracking-tight">
              Document Approved
            </p>
            <p className="m-0 text-[14px] text-[var(--color-on-surface-variant)] max-w-[420px] leading-relaxed">
              This document has been reviewed and approved by your tax preparer. It is securely stored in your Box Vault.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
