import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText, Loader2, AlertCircle, RefreshCw, CheckCircle,
  RotateCcw, ShieldOff, Calendar, Clock, Undo2, Send,
} from 'lucide-react'
import { projectApi, reviewApi, tokenApi } from '../../services/api'
import Breadcrumb from '../Breadcrumb'
import { GlassPanel, StatusBadge, Badge, ProgressBar } from '../ui'
import CommentsThread from '../CommentsThread'
import { useAuth } from '../../context/AuthContext'

const PRIORITY_COLORS = {
  Urgent: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#6b7280',
}

const leftPaneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: 0 } },
}
const rightPaneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: 0.15 } },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  try {
    return new Date(dateStr) < new Date()
  } catch {
    return false
  }
}

// Undo countdown hook
function useUndoCountdown(approvedAt) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!approvedAt) { setRemaining(0); return }
    const endMs = new Date(approvedAt).getTime() + 10 * 60 * 1000

    const tick = () => {
      const left = Math.max(0, endMs - Date.now())
      setRemaining(left)
      if (left <= 0) clearInterval(id)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [approvedAt])

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return { remaining, label: `${minutes}:${String(seconds).padStart(2, '0')}` }
}

// Skeleton for loading state
function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="h-3 w-64 rounded bg-white/[0.06] mb-4 animate-pulse" />
      <div className="h-8 w-48 rounded bg-white/[0.08] mb-6 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] gap-6">
        <div className="rounded-[24px] bg-white/[0.03] h-[500px] animate-pulse" />
        <div className="rounded-[24px] bg-white/[0.03] h-[500px] animate-pulse" />
      </div>
    </div>
  )
}

export default function DocumentDetailView() {
  const { clientId, projectId, documentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const employeeId = user?.id || 'employee-1'

  const [doc, setDoc] = useState(null)
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Preview token
  const [previewToken, setPreviewToken] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const refreshTimerRef = useRef(null)

  // Action state
  const [actionLoading, setActionLoading] = useState(null) // 'approve' | 'revision' | 'waive' | 'undo' | 'auto'
  const [actionError, setActionError] = useState(null)
  const [conflictError, setConflictError] = useState(false)

  // Revision comment
  const [showRevision, setShowRevision] = useState(false)
  const [revisionComment, setRevisionComment] = useState('')
  const [revisionError, setRevisionError] = useState('')

  // Waive confirmation
  const [showWaiveConfirm, setShowWaiveConfirm] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')

  // Approve confirmation
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)

  // Undo state
  const [approvedAt, setApprovedAt] = useState(null)
  const { remaining: undoRemaining, label: undoLabel } = useUndoCountdown(approvedAt)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docsResult, clients, projects] = await Promise.all([
        projectApi.getProjectDocuments(projectId),
        projectApi.getEmployeeClients(employeeId),
        projectApi.getClientProjects(clientId),
      ])

      const docs = Array.isArray(docsResult) ? docsResult : docsResult?.documents || []
      const found = docs.find((d) => d.id === documentId)

      if (!found) {
        setError('Document not found')
        setLoading(false)
        return
      }

      setDoc(found)

      const client = (clients || []).find((c) => c.id === clientId)
      setClientName(client?.name || 'Client')

      const proj = (projects || []).find((p) => p.id === projectId)
      setProjectName(proj?.name || 'Project')

      // Track approvedAt for undo
      if (found.status === 'Approved' && found.approvedAt) {
        setApprovedAt(found.approvedAt)
      }
    } catch (err) {
      setError(err.message || 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }, [projectId, clientId, documentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-transition: if status is Uploaded, transition to Under_Review
  useEffect(() => {
    if (!doc || doc.status !== 'Uploaded') return
    let cancelled = false

    const autoTransition = async () => {
      setActionLoading('auto')
      try {
        const result = await reviewApi.transitionStatus(documentId, {
          toStatus: 'Under_Review',
          employeeId,
          version: doc.version,
        })
        if (!cancelled) {
          setDoc((prev) => prev ? { ...prev, status: 'Under_Review', version: result?.version ?? (prev.version + 1) } : prev)
        }
      } catch (err) {
        console.warn('Auto-transition failed:', err.message)
      } finally {
        if (!cancelled) setActionLoading(null)
      }
    }

    autoTransition()
    return () => { cancelled = true }
  }, [doc?.id, doc?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch preview token
  useEffect(() => {
    if (!doc?.fileId) return

    const fetchToken = async () => {
      try {
        const result = await tokenApi.getPreviewToken(doc.fileId, employeeId)
        setPreviewToken(result)
        setPreviewError(null)

        if (result.expiresAt) {
          const expiresMs = new Date(result.expiresAt).getTime()
          const refreshIn = expiresMs - Date.now() - 5 * 60 * 1000
          if (refreshIn > 0) {
            refreshTimerRef.current = setTimeout(fetchToken, refreshIn)
          }
        }
      } catch (err) {
        setPreviewError(err.message)
      }
    }

    fetchToken()
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [doc?.fileId])

  // Mutation helper
  const doTransition = async (toStatus, extra = {}) => {
    setActionError(null)
    setConflictError(false)
    try {
      const result = await reviewApi.transitionStatus(documentId, {
        toStatus,
        employeeId,
        version: doc.version,
        ...extra,
      })
      const newVersion = result?.version ?? (doc.version + 1)
      const newApprovedAt = toStatus === 'Approved' ? (result?.approvedAt || new Date().toISOString()) : null

      setDoc((prev) => prev ? { ...prev, status: toStatus, version: newVersion } : prev)

      if (toStatus === 'Approved') {
        setApprovedAt(newApprovedAt)
      }
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('modified')) {
        setConflictError(true)
      } else {
        setActionError(err.message || 'Action failed')
      }
      throw err
    }
  }

  const handleApprove = async () => {
    setActionLoading('approve')
    try {
      await doTransition('Approved')
      setShowApproveConfirm(false)
    } catch { /* error already set */ }
    finally { setActionLoading(null) }
  }

  const handleRevision = async () => {
    const trimmed = revisionComment.trim()
    if (trimmed.length < 10) {
      setRevisionError('Revision comment must be at least 10 characters.')
      return
    }
    if (trimmed.length > 1000) {
      setRevisionError('Revision comment must be 1000 characters or fewer.')
      return
    }
    setActionLoading('revision')
    try {
      await doTransition('Revision_Requested', { comment: trimmed })
      setShowRevision(false)
      setRevisionComment('')
    } catch { /* error already set */ }
    finally { setActionLoading(null) }
  }

  const handleWaive = async () => {
    setActionLoading('waive')
    try {
      await doTransition('Waived', waiveReason ? { reason: waiveReason } : {})
      setShowWaiveConfirm(false)
      setWaiveReason('')
    } catch { /* error already set */ }
    finally { setActionLoading(null) }
  }

  const handleUndo = async () => {
    setActionLoading('undo')
    setActionError(null)
    setConflictError(false)
    try {
      await reviewApi.undoApprove(documentId, employeeId, doc.version)
      setDoc((prev) => prev ? { ...prev, status: 'Under_Review', version: prev.version + 1 } : prev)
      setApprovedAt(null)
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('modified')) {
        setConflictError(true)
      } else {
        setActionError(err.message || 'Undo failed')
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <Breadcrumb
          segments={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: clientName || 'Client', path: `/clients/${clientId}` },
            { label: projectName || 'Project', path: `/clients/${clientId}/projects/${projectId}` },
          ]}
        />
        <GlassPanel className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={40} className="text-red-400/60 mb-4" />
          <p className="text-[15px] font-semibold text-red-400/80 mb-2">{error}</p>
          {error === 'Document not found' ? (
            <button
              onClick={() => navigate(`/clients/${clientId}/projects/${projectId}`)}
              className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-4 py-2 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-container)]"
            >
              Back to Project
            </button>
          ) : (
            <button
              onClick={fetchData}
              className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-4 py-2 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-container)]"
            >
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </GlassPanel>
      </div>
    )
  }

  const isUnderReview = doc.status === 'Under_Review'
  const isApproved = doc.status === 'Approved'
  const showUndoButton = isApproved && undoRemaining > 0

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      <Breadcrumb
        segments={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: clientName, path: `/clients/${clientId}` },
          { label: projectName, path: `/clients/${clientId}/projects/${projectId}` },
          { label: doc.name, path: `/clients/${clientId}/projects/${projectId}/documents/${documentId}` },
        ]}
      />

      {/* Conflict toast */}
      {conflictError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3"
        >
          <span className="text-[13px] font-medium text-yellow-300">
            This document was modified by another user.
          </span>
          <button
            onClick={() => { setConflictError(false); fetchData() }}
            className="flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/15 px-3 py-1.5 text-[12px] font-bold text-yellow-300 transition-all hover:bg-yellow-500/25"
          >
            <RefreshCw size={12} /> Reload
          </button>
        </motion.div>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] gap-6">
        {/* Left panel — Document Viewer */}
        <motion.div variants={leftPaneVariants} initial="hidden" animate="visible" className="flex flex-col h-full">
          <GlassPanel className="h-full flex flex-col flex-1">
            <h3 className="mb-6 m-0 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70 flex items-center gap-2">
              <FileText size={14} /> Document Preview
            </h3>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 min-h-[400px]">
              {doc.fileId && previewToken ? (
                <iframe
                  src={`https://app.box.com/embed/preview/${doc.fileId}?token=${previewToken.token}`}
                  style={{ width: '100%', height: 450, border: 'none', borderRadius: 12 }}
                  title="Document Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : doc.fileId && previewError ? (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/[0.05] border border-red-500/[0.07]">
                    <FileText size={28} className="text-red-400/50" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-red-400/70">Preview unavailable</p>
                  <p className="text-xs text-white/30">{previewError}</p>
                </>
              ) : !doc.fileId ? (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.07]">
                    <FileText size={28} className="text-white/25" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-white/50">No file uploaded yet</p>
                  <p className="text-xs text-white/30">Status: {doc.status?.replace(/_/g, ' ')}</p>
                </>
              ) : (
                <Loader2 size={24} className="animate-spin text-white/30" />
              )}
            </div>
          </GlassPanel>
        </motion.div>

        {/* Right panel — Action Panel */}
        <motion.div variants={rightPaneVariants} initial="hidden" animate="visible" className="flex flex-col gap-6">
          {/* Document details */}
          <GlassPanel>
            <h3 className="m-0 mb-5 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70">
              Document Details
            </h3>
            <div className="space-y-4">
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Name</p>
                <p className="m-0 mt-1 text-[14px] font-semibold text-[var(--color-on-surface)]">{doc.name}</p>
              </div>
              {doc.documentType && (
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Document Type</p>
                  <p className="m-0 mt-1 text-[13px] text-[var(--color-on-surface)]">{doc.documentType}</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Status</p>
                  <div className="mt-1"><StatusBadge status={doc.status} /></div>
                </div>
                {doc.priority && (
                  <div>
                    <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Priority</p>
                    <div className="mt-1"><Badge color={PRIORITY_COLORS[doc.priority] || '#6b7280'}>{doc.priority}</Badge></div>
                  </div>
                )}
              </div>
              {doc.dueDate && (
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Due Date</p>
                  <p className={`m-0 mt-1 text-[13px] flex items-center gap-1.5 ${isOverdue(doc.dueDate) ? 'text-red-400 font-semibold' : 'text-[var(--color-on-surface)]'}`}>
                    <Calendar size={12} />
                    {formatDate(doc.dueDate)}
                    {isOverdue(doc.dueDate) && <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Overdue</span>}
                  </p>
                </div>
              )}
              {doc.uploadedBy && (
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Uploaded By</p>
                  <p className="m-0 mt-1 text-[13px] text-[var(--color-on-surface)]">{doc.uploadedBy}</p>
                </div>
              )}
              {doc.description && (
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Description</p>
                  <p className="m-0 mt-1 text-[13px] text-[var(--color-on-surface-variant)]">{doc.description}</p>
                </div>
              )}
              {doc.instructions && (
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-[var(--color-on-surface-variant)]">Instructions</p>
                  <p className="m-0 mt-1 text-[13px] text-[var(--color-on-surface-variant)]">{doc.instructions}</p>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* Version history placeholder */}
          <GlassPanel>
            <h3 className="m-0 mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70 flex items-center gap-2">
              <Clock size={14} /> Version History
            </h3>
            <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)]">Version {doc.version || 1}</p>
          </GlassPanel>

          {/* Review actions — only when Under_Review */}
          {isUnderReview && (
            <GlassPanel>
              <h3 className="m-0 mb-5 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70">
                Review Actions
              </h3>
              <div className="space-y-3">
                {/* Approve */}
                {!showApproveConfirm ? (
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] border border-[#22c55e]/30 bg-[#22c55e]/15 px-6 py-3 text-[13px] font-bold text-[#22c55e] transition-all hover:bg-[#22c55e]/25 disabled:opacity-50"
                  >
                    <CheckCircle size={16} /> Approve Document
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 p-4">
                    <p className="m-0 text-[12px] font-semibold text-[#22c55e] mb-3">Confirm approval?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleApprove}
                        disabled={!!actionLoading}
                        className="flex-1 rounded-lg bg-[#22c55e]/20 px-3 py-2 text-[12px] font-bold text-[#22c55e] border border-[#22c55e]/30 transition-all hover:bg-[#22c55e]/30 disabled:opacity-50"
                      >
                        {actionLoading === 'approve' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setShowApproveConfirm(false)}
                        className="flex-1 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface-variant)] border border-white/[0.1] transition-all hover:bg-white/[0.08]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Request Revision */}
                {!showRevision ? (
                  <button
                    onClick={() => setShowRevision(true)}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] border border-[#ef4444]/30 bg-[#ef4444]/15 px-6 py-3 text-[13px] font-bold text-[#ef4444] transition-all hover:bg-[#ef4444]/25 disabled:opacity-50"
                  >
                    <RotateCcw size={16} /> Request Revision
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                      Revision Comment <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      value={revisionComment}
                      onChange={(e) => { setRevisionComment(e.target.value); setRevisionError('') }}
                      placeholder="Detail what needs to be changed (10-1000 chars)..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] px-4 py-3 text-[13px] text-[var(--color-on-surface)] placeholder-[var(--color-on-surface-variant)]/50 outline-none focus:border-[#ef4444]/50"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                        {revisionComment.trim().length}/1000
                      </span>
                    </div>
                    {revisionError && (
                      <p className="m-0 text-[11px] font-bold text-[#ef4444]">{revisionError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleRevision}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#ef4444]/20 px-3 py-2 text-[12px] font-bold text-[#ef4444] border border-[#ef4444]/30 transition-all hover:bg-[#ef4444]/30 disabled:opacity-50"
                      >
                        {actionLoading === 'revision' ? <Loader2 size={14} className="animate-spin" /> : <Send size={12} />}
                        Submit
                      </button>
                      <button
                        onClick={() => { setShowRevision(false); setRevisionComment(''); setRevisionError('') }}
                        className="flex-1 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface-variant)] border border-white/[0.1] transition-all hover:bg-white/[0.08]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Waive */}
                {!showWaiveConfirm ? (
                  <button
                    onClick={() => setShowWaiveConfirm(true)}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] border border-[#64748b]/30 bg-[#64748b]/15 px-6 py-3 text-[13px] font-bold text-[#64748b] transition-all hover:bg-[#64748b]/25 disabled:opacity-50"
                  >
                    <ShieldOff size={16} /> Waive Requirement
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#64748b]/20 bg-[#64748b]/5 p-4 space-y-3">
                    <p className="m-0 text-[12px] font-semibold text-[#64748b]">Waive this requirement?</p>
                    <textarea
                      value={waiveReason}
                      onChange={(e) => setWaiveReason(e.target.value)}
                      placeholder="Optional reason..."
                      rows={2}
                      className="w-full resize-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] px-4 py-2 text-[13px] text-[var(--color-on-surface)] placeholder-[var(--color-on-surface-variant)]/50 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleWaive}
                        disabled={!!actionLoading}
                        className="flex-1 rounded-lg bg-[#64748b]/20 px-3 py-2 text-[12px] font-bold text-[#64748b] border border-[#64748b]/30 transition-all hover:bg-[#64748b]/30 disabled:opacity-50"
                      >
                        {actionLoading === 'waive' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm Waive'}
                      </button>
                      <button
                        onClick={() => { setShowWaiveConfirm(false); setWaiveReason('') }}
                        className="flex-1 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface-variant)] border border-white/[0.1] transition-all hover:bg-white/[0.08]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action error */}
              {actionError && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {actionError}
                </div>
              )}
            </GlassPanel>
          )}

          {/* Undo approval */}
          {showUndoButton && (
            <GlassPanel>
              <div className="flex items-center justify-between">
                <div>
                  <p className="m-0 text-[12px] font-bold text-[var(--color-on-surface-variant)]">Undo window</p>
                  <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]/60">{undoLabel} remaining</p>
                </div>
                <button
                  onClick={handleUndo}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-yellow-500/30 bg-yellow-500/15 px-4 py-2 text-[12px] font-bold text-yellow-400 transition-all hover:bg-yellow-500/25 disabled:opacity-50"
                >
                  {actionLoading === 'undo' ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                  Undo Approval
                </button>
              </div>
              {actionError && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {actionError}
                </div>
              )}
            </GlassPanel>
          )}

          {/* Comments thread */}
          <CommentsThread documentId={documentId} />
        </motion.div>
      </div>
    </div>
  )
}
