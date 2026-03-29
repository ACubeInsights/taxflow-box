import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
import { StatusBadge, GlassPanel } from './ui'
import AIExtractionCard from './AIExtractionCard'
import ApprovalActions from './ApprovalActions'
import { tokenApi, reviewApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

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
  const { user } = useAuth()
  const [previewToken, setPreviewToken] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const refreshTimerRef = useRef(null)

  // Fetch preview token on mount
  useEffect(() => {
    if (!request.fileId) return

    const fetchToken = async () => {
      try {
        const result = await tokenApi.getPreviewToken(request.fileId, user || 'employee-1')
        setPreviewToken(result)
        setPreviewError(null)

        // Schedule refresh 5 min before expiry
        if (result.expiresAt) {
          const expiresMs = new Date(result.expiresAt).getTime()
          const refreshIn = expiresMs - Date.now() - 5 * 60 * 1000
          if (refreshIn > 0) {
            refreshTimerRef.current = setTimeout(fetchToken, refreshIn)
          }
        }
      } catch (err) {
        console.warn('Preview token fetch failed:', err.message)
        setPreviewError(err.message)
      }
    }

    fetchToken()
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [request.fileId, user])

  const handleApprove = async () => {
    setActionLoading(true)
    setActionError(null)
    try {
      if (request.fileId) {
        await reviewApi.approve(request.fileId, user || 'employee-1')
      }
      onApprove()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRequestRevision = async (comments) => {
    setActionLoading(true)
    setActionError(null)
    try {
      if (request.fileId) {
        await reviewApi.reject(request.fileId, user || 'employee-1', comments)
      }
      onRequestRevision(comments)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10">
              {previewToken && request.fileId ? (
                <iframe
                  src={`https://app.box.com/embed/preview/${request.fileId}?token=${previewToken.token}`}
                  style={{ width: '100%', height: 400, border: 'none', borderRadius: 12 }}
                  title="Document Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : previewError ? (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/[0.05] border border-red-500/[0.07]">
                    <FileText size={28} className="text-red-400/50" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-red-400/70">Preview unavailable</p>
                  <p className="text-xs text-white/30">{previewError}</p>
                </>
              ) : (
                <>
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
                </>
              )}
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
              onApprove={handleApprove}
              onRequestRevision={handleRequestRevision}
              disabled={actionLoading}
            />
            {actionLoading && (
              <div className="flex items-center gap-2 text-white/40 text-xs mt-2">
                <Loader2 size={14} className="animate-spin" /> Processing...
              </div>
            )}
            {actionError && (
              <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {actionError}
              </div>
            )}
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  )
}
