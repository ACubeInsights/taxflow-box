import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText, Loader2, AlertCircle, RefreshCw, CheckCircle,
  RotateCcw, ShieldOff, Calendar, Clock, Undo2, Send, Edit3,
} from 'lucide-react'
import { projectApi, reviewApi, tokenApi } from '../../services/api'
import Breadcrumb from '../Breadcrumb'
import { GlassPanel, StatusBadge, Badge } from '../ui'
import CommentsThread from '../CommentsThread'
import DocumentEditor from '../DocumentEditor'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PRIORITY_COLORS } from '../../constants/roles'

const leftPaneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0 } },
}
const rightPaneVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.12 } },
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

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="h-3 w-64 rounded bg-[var(--color-surface-high)] mb-4 animate-pulse" />
      <div className="h-8 w-48 rounded bg-[var(--color-surface-highest)] mb-6 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] gap-6">
        <div className="rounded-xl bg-[var(--color-surface-container)] h-[500px] animate-pulse" />
        <div className="rounded-xl bg-[var(--color-surface-container)] h-[500px] animate-pulse" />
      </div>
    </div>
  )
}

export default function DocumentDetailView() {
  const { clientId, projectId, documentId } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const employeeId = user?.id || 'employee-1'
  const { error: toastError, success: toastSuccess } = useToast()

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

  // Document editor state
  const [showEditor, setShowEditor] = useState(false)

  // Undo state
  const [approvedAt, setApprovedAt] = useState(null)
  const { remaining: undoRemaining, label: undoLabel } = useUndoCountdown(approvedAt)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docsResult, clients, projects] = await Promise.all([
        projectApi.getProjectDocuments(projectId),
        projectApi.getAllClients(),
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
      toastError(err.message || 'Failed to load document')
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
        toastError(err.message || 'Action failed')
        setActionError(err.message || 'Action failed')
      }
      throw err
    }
  }

  const handleApprove = async () => {
    setActionLoading('approve')
    try {
      await doTransition('Approved')
      toastSuccess('Document approved')
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
      toastSuccess('Revision requested')
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
          <AlertCircle size={40} className="text-[var(--color-error)]/60 mb-4" />
          <p className="text-[15px] font-semibold text-[var(--color-error)]/80 mb-2">{error}</p>
          {error === 'Document not found' ? (
            <button
              onClick={() => navigate(`/clients/${clientId}/projects/${projectId}`)}
              className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-2 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-high)]"
            >
              Back to Project
            </button>
          ) : (
            <button
              onClick={fetchData}
              className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-2 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-high)]"
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
          className="mb-4 flex items-center justify-between rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-muted)] px-4 py-3"
        >
          <span className="text-[13px] font-medium text-[var(--color-warning)]">
            This document was modified by another user.
          </span>
          <button
            onClick={() => { setConflictError(false); fetchData() }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/15 px-3 py-1.5 text-[12px] font-bold text-[var(--color-warning)] transition-all hover:bg-[var(--color-warning)]/25"
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70 flex items-center gap-2">
                <FileText size={14} /> Document Preview
              </h3>
              {doc.fileId && (
                <button
                  onClick={() => setShowEditor(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1.5 text-[12px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/20 active:scale-95"
                >
                  <Edit3 size={13} /> Edit Document
                </button>
              )}
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-highest)]/30 p-10 min-h-[400px]">
              {doc.fileId && previewToken ? (
                <iframe
                  src={`https://app.box.com/embed/preview/${doc.fileId}?token=${previewToken.token}`}
                  style={{ width: '100%', height: 450, border: 'none', borderRadius: 12 }}
                  title="Document Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : doc.fileId && previewError ? (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-error-muted)] border border-[var(--color-error)]/10">
                    <FileText size={28} className="text-[var(--color-error)]/50" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-[var(--color-error)]/70">Preview unavailable</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]/50">{previewError}</p>
                </>
              ) : !doc.fileId ? (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)]">
                    <FileText size={28} className="text-[var(--color-on-surface-variant)]/40" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-[var(--color-on-surface-variant)]/60">No file uploaded yet</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]/40">Status: {doc.status?.replace(/_/g, ' ')}</p>
                </>
              ) : (
                <Loader2 size={24} className="animate-spin text-[var(--color-primary)]/40" />
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
                  <p className={`m-0 mt-1 text-[13px] flex items-center gap-1.5 ${isOverdue(doc.dueDate) ? 'text-[var(--color-error)] font-semibold' : 'text-[var(--color-on-surface)]'}`}>
                    <Calendar size={12} />
                    {formatDate(doc.dueDate)}
                    {isOverdue(doc.dueDate) && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-error)]/80">Overdue</span>}
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-muted)] px-6 py-3 text-[13px] font-bold text-[var(--color-success)] transition-all hover:bg-[var(--color-success)]/20 disabled:opacity-50"
                  >
                    <CheckCircle size={16} /> Approve Document
                  </button>
                ) : (
                  <div className="rounded-xl border border-[var(--color-success)]/20 bg-[var(--color-success-muted)] p-4">
                    <p className="m-0 text-[12px] font-semibold text-[var(--color-success)] mb-3">Confirm approval?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleApprove}
                        disabled={!!actionLoading}
                        className="flex-1 rounded-lg bg-[var(--color-success)]/20 px-3 py-2 text-[12px] font-bold text-[var(--color-success)] border border-[var(--color-success)]/30 transition-all hover:bg-[var(--color-success)]/30 disabled:opacity-50"
                      >
                        {actionLoading === 'approve' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setShowApproveConfirm(false)}
                        className="flex-1 rounded-lg bg-[var(--color-surface-high)] px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface-variant)] border border-[var(--color-outline-variant)] transition-all hover:bg-[var(--color-surface-highest)]"
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error-muted)] px-6 py-3 text-[13px] font-bold text-[var(--color-error)] transition-all hover:bg-[var(--color-error)]/20 disabled:opacity-50"
                  >
                    <RotateCcw size={16} /> Request Revision
                  </button>
                ) : (
                  <div className="rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-muted)] p-4 space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                      Revision Comment <span className="text-[var(--color-error)]">*</span>
                    </label>
                    <textarea
                      value={revisionComment}
                      onChange={(e) => { setRevisionComment(e.target.value); setRevisionError('') }}
                      placeholder="Detail what needs to be changed (10-1000 chars)..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] px-4 py-3 text-[13px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-error)]/50 transition-colors"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-on-surface-variant)]">
                        {revisionComment.trim().length}/1000
                      </span>
                    </div>
                    {revisionError && (
                      <p className="m-0 text-[11px] font-bold text-[var(--color-error)]">{revisionError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleRevision}
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-error)]/20 px-3 py-2 text-[12px] font-bold text-[var(--color-error)] border border-[var(--color-error)]/30 transition-all hover:bg-[var(--color-error)]/30 disabled:opacity-50"
                      >
                        {actionLoading === 'revision' ? <Loader2 size={14} className="animate-spin" /> : <Send size={12} />}
                        Submit
                      </button>
                      <button
                        onClick={() => { setShowRevision(false); setRevisionComment(''); setRevisionError('') }}
                        className="flex-1 rounded-lg bg-[var(--color-surface-high)] px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface-variant)] border border-[var(--color-outline-variant)] transition-all hover:bg-[var(--color-surface-highest)]"
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-on-surface-variant)]/20 bg-[var(--color-surface-high)] px-6 py-3 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-highest)] hover:text-[var(--color-on-surface)] disabled:opacity-50"
                  >
                    <ShieldOff size={16} /> Waive Requirement
                  </button>
                ) : (
                  <div className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] p-4 space-y-3">
                    <p className="m-0 text-[12px] font-semibold text-[var(--color-on-surface-variant)]">Waive this requirement?</p>
                    <textarea
                      value={waiveReason}
                      onChange={(e) => setWaiveReason(e.target.value)}
                      placeholder="Optional reason..."
                      rows={2}
                      className="w-full resize-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-2 text-[13px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-colors focus:border-[var(--color-primary)]/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleWaive}
                        disabled={!!actionLoading}
                        className="flex-1 rounded-lg bg-[var(--color-surface-highest)] px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface)] border border-[var(--color-outline)] transition-all hover:brightness-110 disabled:opacity-50"
                      >
                        {actionLoading === 'waive' ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm Waive'}
                      </button>
                      <button
                        onClick={() => { setShowWaiveConfirm(false); setWaiveReason('') }}
                        className="flex-1 rounded-lg bg-transparent px-3 py-2 text-[12px] font-bold text-[var(--color-on-surface-variant)] border border-[var(--color-outline-variant)] transition-all hover:bg-[var(--color-surface-high)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action error */}
              {actionError && (
                <div className="mt-3 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error-muted)] px-3 py-2 text-[12px] text-[var(--color-error)]">
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
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-muted)] px-4 py-2 text-[12px] font-bold text-[var(--color-warning)] transition-all hover:bg-[var(--color-warning)]/20 disabled:opacity-50"
                >
                  {actionLoading === 'undo' ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                  Undo Approval
                </button>
              </div>
              {actionError && (
                <div className="mt-3 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error-muted)] px-3 py-2 text-[12px] text-[var(--color-error)]">
                  {actionError}
                </div>
              )}
            </GlassPanel>
          )}

          {/* Comments thread */}
          <CommentsThread documentId={documentId} />
        </motion.div>
      </div>

      {/* Document Editor Modal */}
      {showEditor && doc.fileId && (
        <DocumentEditor
          fileId={doc.fileId}
          fileName={doc.uploadedFileName || doc.name}
          fileSize={0}
          sessionToken={token}
          onClose={() => setShowEditor(false)}
          onVersionUploaded={() => {
            setShowEditor(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
