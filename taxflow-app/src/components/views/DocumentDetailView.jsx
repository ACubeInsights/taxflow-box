import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText, Loader2, AlertCircle, RefreshCw, CheckCircle,
  RotateCcw, ShieldOff, Calendar, Undo2, Send, Edit3,
} from 'lucide-react'
import { projectApi, reviewApi, tokenApi } from '../../services/api'
import Breadcrumb from '../Breadcrumb'
import { FolioPanel, StatusBadge, Badge } from '../ui'
import CommentsThread from '../CommentsThread'
import DocumentEditor from '../DocumentEditor'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PRIORITY_COLORS } from '../../constants/roles'
import { STATUS_COLORS } from '../../constants/statusColors'

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

function useUndoCountdown(approvedAt) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!approvedAt) { setRemaining(0); return }
    const endMs = new Date(approvedAt).getTime() + 10 * 60 * 1000
    let id
    const tick = () => {
      const left = Math.max(0, endMs - Date.now())
      setRemaining(left)
      if (left <= 0 && id) clearInterval(id)
    }
    tick()
    id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [approvedAt])

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return { remaining, label: `${minutes}:${String(seconds).padStart(2, '0')}` }
}

export default function DocumentDetailView() {
  const { clientId, projectId, documentId } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const employeeId = user?.id
  const { error: toastError, success: toastSuccess } = useToast()

  const [doc, setDoc] = useState(null)
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [previewToken, setPreviewToken] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const refreshTimerRef = useRef(null)

  const [actionLoading, setActionLoading] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [conflictError, setConflictError] = useState(false)

  const [showRevision, setShowRevision] = useState(false)
  const [revisionComment, setRevisionComment] = useState('')
  const [revisionError, setRevisionError] = useState('')
  const [showWaiveConfirm, setShowWaiveConfirm] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  const [approvedAt, setApprovedAt] = useState(null)
  const { remaining: undoRemaining, label: undoLabel } = useUndoCountdown(approvedAt)

  const spineColor = STATUS_COLORS[doc?.status] || 'var(--color-whisper)'

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

      const clientList = clients?.clients || clients || []
      const client = clientList.find((c) => c.id === clientId)
      setClientName(client?.name || 'Client')

      const projectList = Array.isArray(projects) ? projects : projects?.projects || []
      const proj = projectList.find((p) => p.id === projectId)
      setProjectName(proj?.name || 'Project')

      if (found.status === 'Approved' && found.approvedAt) {
        setApprovedAt(found.approvedAt)
      }
    } catch (err) {
      toastError(err.message || 'Could not load document')
      setError(err.message || 'Could not load document')
    } finally {
      setLoading(false)
    }
  }, [projectId, clientId, documentId, toastError])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!doc || doc.status !== 'Uploaded' || !employeeId) return
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
          setDoc((prev) => prev
            ? { ...prev, status: 'Under_Review', version: result?.version ?? (prev.version + 1) }
            : prev)
        }
      } catch (err) {
        console.warn('Auto-transition failed:', err.message)
      } finally {
        if (!cancelled) setActionLoading(null)
      }
    }

    autoTransition()
    return () => { cancelled = true }
  }, [doc?.id, doc?.status, documentId, employeeId, doc?.version])

  useEffect(() => {
    if (!doc?.fileId || !employeeId) return

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
  }, [doc?.fileId, employeeId])

  const doTransition = async (toStatus, extra = {}) => {
    setActionError(null)
    setConflictError(false)
    const result = await reviewApi.transitionStatus(documentId, {
      toStatus,
      employeeId,
      version: doc.version,
      ...extra,
    })
    const newVersion = result?.version ?? (doc.version + 1)
    const newApprovedAt = toStatus === 'Approved' ? (result?.approvedAt || new Date().toISOString()) : null
    setDoc((prev) => prev ? { ...prev, status: toStatus, version: newVersion } : prev)
    if (toStatus === 'Approved') setApprovedAt(newApprovedAt)
  }

  const handleApprove = async () => {
    setActionLoading('approve')
    try {
      await doTransition('Approved')
      toastSuccess('Document approved')
      setShowApproveConfirm(false)
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('modified')) setConflictError(true)
      else {
        toastError(err.message || 'Approve failed')
        setActionError(err.message || 'Approve failed')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevision = async () => {
    const trimmed = revisionComment.trim()
    if (trimmed.length < 10) {
      setRevisionError('Revision note must be at least 10 characters.')
      return
    }
    if (trimmed.length > 1000) {
      setRevisionError('Revision note must be 1000 characters or fewer.')
      return
    }
    setActionLoading('revision')
    try {
      await doTransition('Revision_Requested', { comment: trimmed })
      toastSuccess('Revision requested')
      setShowRevision(false)
      setRevisionComment('')
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('modified')) setConflictError(true)
      else {
        toastError(err.message || 'Revision request failed')
        setActionError(err.message || 'Revision request failed')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleWaive = async () => {
    setActionLoading('waive')
    try {
      await doTransition('Waived', waiveReason ? { reason: waiveReason } : {})
      toastSuccess('Requirement waived')
      setShowWaiveConfirm(false)
      setWaiveReason('')
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('modified')) setConflictError(true)
      else setActionError(err.message || 'Waive failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUndo = async () => {
    setActionLoading('undo')
    setActionError(null)
    setConflictError(false)
    try {
      await reviewApi.undoApprove(documentId, employeeId, doc.version)
      setDoc((prev) => prev ? { ...prev, status: 'Under_Review', version: prev.version + 1 } : prev)
      setApprovedAt(null)
      toastSuccess('Approval undone')
    } catch (err) {
      if (err.message?.includes('409') || err.message?.includes('modified')) setConflictError(true)
      else setActionError(err.message || 'Undo failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[var(--layout-content-max)]">
        <div className="mb-[var(--space-4)] h-3 w-64 animate-pulse rounded bg-[var(--color-ledger)]" />
        <div className="grid gap-[var(--space-6)] lg:grid-cols-[1fr_360px]">
          <div className="h-[400px] animate-pulse rounded-[var(--radius-panel)] bg-[var(--color-folio)]" />
          <div className="h-[400px] animate-pulse rounded-[var(--radius-panel)] bg-[var(--color-folio)]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[var(--layout-content-max)]">
        <Breadcrumb
          segments={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: clientName || 'Client', path: `/clients/${clientId}` },
            { label: projectName || 'Project', path: `/clients/${clientId}/projects/${projectId}` },
          ]}
        />
        <FolioPanel className="py-[var(--space-12)] text-center">
          <AlertCircle size={36} className="mx-auto mb-[var(--space-4)] text-[var(--color-flag)]" aria-hidden />
          <p className="m-0 mb-[var(--space-2)] text-sm font-medium text-[var(--color-flag)]">{error}</p>
          <button
            type="button"
            onClick={error === 'Document not found'
              ? () => navigate(`/clients/${clientId}/projects/${projectId}`)
              : fetchData}
            className="btn-ghost mt-[var(--space-4)]"
          >
            {error === 'Document not found' ? 'Back to project' : <><RefreshCw size={14} aria-hidden /> Retry</>}
          </button>
        </FolioPanel>
      </div>
    )
  }

  const isUnderReview = doc.status === 'Under_Review'
  const isApproved = doc.status === 'Approved'
  const showUndoButton = isApproved && undoRemaining > 0

  return (
    <div className="-mx-[var(--space-4)] flex min-h-[calc(100vh-var(--layout-topbar)-3rem)] sm:-mx-[var(--space-6)] lg:-mx-[var(--space-8)]">
      {/* Folio Rail — genuine Client → Project → Document sequence */}
      <aside
        className="hidden w-[var(--layout-rail)] shrink-0 flex-col border-r border-[var(--color-rule)] md:flex"
        aria-label="Document workflow location"
      >
        <div
          className="folio-spine mx-auto mt-[var(--space-6)] w-[4px] flex-1 rounded-[2px]"
          style={{ background: spineColor }}
          aria-hidden
        />
        <ol className="m-0 flex list-none flex-col gap-[var(--space-8)] px-[var(--space-2)] py-[var(--space-6)]">
          {[
            { label: clientName, current: false },
            { label: projectName, current: false },
            { label: doc.name, current: true },
          ].map((step) => (
            <li
              key={step.label}
              className={`text-center text-xs font-medium ${step.current ? 'text-[var(--color-ink)]' : 'text-[var(--color-whisper)]'}`}
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {step.label}
            </li>
          ))}
        </ol>
      </aside>

      <div className="min-w-0 flex-1 px-[var(--space-4)] py-[var(--space-6)] sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
        <Breadcrumb
          segments={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: clientName, path: `/clients/${clientId}` },
            { label: projectName, path: `/clients/${clientId}/projects/${projectId}` },
            { label: doc.name, path: `/clients/${clientId}/projects/${projectId}/documents/${documentId}` },
          ]}
        />

        <h1 className="m-0 mb-[var(--space-6)] font-display text-lg font-semibold text-[var(--color-ink)] sm:text-xl">
          {doc.name}
        </h1>

        {conflictError && (
          <div className="mb-[var(--space-4)] flex flex-wrap items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-hold)] bg-[var(--color-hold-muted)] px-[var(--space-4)] py-[var(--space-3)]">
            <span className="text-sm font-medium text-[var(--color-hold)]">
              Someone else changed this document.
            </span>
            <button
              type="button"
              onClick={() => { setConflictError(false); fetchData() }}
              className="btn-ghost h-8 text-xs"
            >
              <RefreshCw size={12} aria-hidden /> Reload document
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-[1fr_var(--layout-procedure)]">
          {/* Paper well — preview */}
          <FolioPanel className="flex min-h-[400px] flex-col !bg-[var(--color-paper-well)]">
            <div className="mb-[var(--space-4)] flex items-center justify-between gap-[var(--space-3)]">
              <p className="label-caps m-0 flex items-center gap-[var(--space-2)]">
                <FileText size={14} aria-hidden /> Document preview
              </p>
              {doc.fileId && (
                <button type="button" onClick={() => setShowEditor(true)} className="btn-ghost h-8 text-xs">
                  <Edit3 size={13} aria-hidden /> Edit document
                </button>
              )}
            </div>
            <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-archive)] p-[var(--space-4)]">
              {doc.fileId && previewToken ? (
                <iframe
                  src={`https://app.box.com/embed/preview/${doc.fileId}?token=${previewToken.token}`}
                  style={{ width: '100%', height: 450, border: 'none', borderRadius: 'var(--radius-control)' }}
                  title={`Preview: ${doc.name}`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : doc.fileId && previewError ? (
                <>
                  <FileText size={28} className="mb-[var(--space-3)] text-[var(--color-flag)]" aria-hidden />
                  <p className="m-0 text-sm font-medium text-[var(--color-flag)]">Preview unavailable</p>
                  <p className="m-0 mt-[var(--space-1)] text-xs text-[var(--color-whisper)]">{previewError}</p>
                </>
              ) : !doc.fileId ? (
                <>
                  <FileText size={28} className="mb-[var(--space-3)] text-[var(--color-whisper)]" aria-hidden />
                  <p className="m-0 text-sm font-medium text-[var(--color-whisper)]">No file uploaded yet</p>
                  <p className="mono-sm m-0 mt-[var(--space-1)] text-[var(--color-whisper)]">
                    Status: {doc.status?.replace(/_/g, ' ')}
                  </p>
                </>
              ) : (
                <Loader2 size={24} className="animate-spin text-[var(--color-signal)]" aria-hidden />
              )}
            </div>
          </FolioPanel>

          {/* Procedure panel */}
          <div className="flex flex-col gap-[var(--space-4)]">
            <FolioPanel>
              <p className="label-caps m-0 mb-[var(--space-4)]">Document details</p>
              <dl className="m-0 space-y-[var(--space-4)]">
                <div>
                  <dt className="label-caps m-0">Status</dt>
                  <dd className="m-0 mt-[var(--space-1)]"><StatusBadge status={doc.status} /></dd>
                </div>
                {doc.documentType && (
                  <div>
                    <dt className="label-caps m-0">Type</dt>
                    <dd className="m-0 mt-[var(--space-1)] text-sm text-[var(--color-ink)]">{doc.documentType}</dd>
                  </div>
                )}
                {doc.priority && (
                  <div>
                    <dt className="label-caps m-0">Priority</dt>
                    <dd className="m-0 mt-[var(--space-1)]">
                      <Badge color={PRIORITY_COLORS[doc.priority] || 'var(--color-whisper)'}>{doc.priority}</Badge>
                    </dd>
                  </div>
                )}
                {doc.dueDate && (
                  <div>
                    <dt className="label-caps m-0">Due</dt>
                    <dd className={`m-0 mt-[var(--space-1)] flex items-center gap-[var(--space-2)] text-sm ${isOverdue(doc.dueDate) ? 'font-medium text-[var(--color-flag)]' : 'text-[var(--color-ink)]'}`}>
                      <Calendar size={12} aria-hidden />
                      <span className="mono-sm">{formatDate(doc.dueDate)}</span>
                      {isOverdue(doc.dueDate) && <span className="text-xs uppercase tracking-[0.04em]">Overdue</span>}
                    </dd>
                  </div>
                )}
                {doc.description && (
                  <div>
                    <dt className="label-caps m-0">Description</dt>
                    <dd className="m-0 mt-[var(--space-1)] text-sm text-[var(--color-whisper)]">{doc.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="label-caps m-0">Version</dt>
                  <dd className="mono-sm m-0 mt-[var(--space-1)] text-[var(--color-ink)]">{doc.version || 1}</dd>
                </div>
              </dl>
            </FolioPanel>

            {isUnderReview && (
              <FolioPanel>
                <p className="label-caps m-0 mb-[var(--space-4)]">Review</p>
                <div className="space-y-[var(--space-3)]">
                  {!showApproveConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowApproveConfirm(true)}
                      disabled={!!actionLoading}
                      className="btn-commit w-full"
                    >
                      <CheckCircle size={16} aria-hidden /> Approve document
                    </button>
                  ) : (
                    <div className="rounded-[var(--radius-control)] border border-[var(--color-commit)] bg-[var(--color-commit-muted)] p-[var(--space-4)]">
                      <p className="m-0 mb-[var(--space-3)] text-sm font-medium text-[var(--color-commit)]">
                        Approve this document?
                      </p>
                      <div className="flex gap-[var(--space-2)]">
                        <button type="button" onClick={handleApprove} disabled={!!actionLoading} className="btn-commit flex-1">
                          {actionLoading === 'approve' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : 'Approve'}
                        </button>
                        <button type="button" onClick={() => setShowApproveConfirm(false)} className="btn-ghost flex-1">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!showRevision ? (
                    <button
                      type="button"
                      onClick={() => setShowRevision(true)}
                      disabled={!!actionLoading}
                      className="btn-flag w-full"
                    >
                      <RotateCcw size={16} aria-hidden /> Request revision
                    </button>
                  ) : (
                    <div className="space-y-[var(--space-3)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-4)]">
                      <label className="label-caps m-0 block" htmlFor="revision-note">
                        Revision note <span className="text-[var(--color-flag)]">*</span>
                      </label>
                      <textarea
                        id="revision-note"
                        value={revisionComment}
                        onChange={(e) => { setRevisionComment(e.target.value); setRevisionError('') }}
                        placeholder="What needs to change (10–1000 characters)…"
                        rows={4}
                        className="folio-input min-h-[96px] resize-none"
                      />
                      <span className="mono-xs text-[var(--color-whisper)]">{revisionComment.trim().length}/1000</span>
                      {revisionError && <p className="m-0 text-sm text-[var(--color-flag)]" role="alert">{revisionError}</p>}
                      <div className="flex gap-[var(--space-2)]">
                        <button type="button" onClick={handleRevision} disabled={!!actionLoading} className="btn-flag flex-1">
                          {actionLoading === 'revision' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={12} aria-hidden />}
                          Request revision
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowRevision(false); setRevisionComment(''); setRevisionError('') }}
                          className="btn-ghost flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!showWaiveConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowWaiveConfirm(true)}
                      disabled={!!actionLoading}
                      className="btn-ghost w-full"
                    >
                      <ShieldOff size={16} aria-hidden /> Waive requirement
                    </button>
                  ) : (
                    <div className="space-y-[var(--space-3)] rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)] p-[var(--space-4)]">
                      <p className="m-0 text-sm font-medium text-[var(--color-ink)]">Waive this requirement?</p>
                      <textarea
                        value={waiveReason}
                        onChange={(e) => setWaiveReason(e.target.value)}
                        placeholder="Optional reason…"
                        rows={2}
                        className="folio-input min-h-[64px] resize-none"
                      />
                      <div className="flex gap-[var(--space-2)]">
                        <button type="button" onClick={handleWaive} disabled={!!actionLoading} className="btn-ghost flex-1">
                          {actionLoading === 'waive' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : 'Waive requirement'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowWaiveConfirm(false); setWaiveReason('') }}
                          className="btn-ghost flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {actionError && (
                  <div className="mt-[var(--space-3)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-flag)]" role="alert">
                    {actionError}
                  </div>
                )}
              </FolioPanel>
            )}

            {showUndoButton && (
              <FolioPanel>
                <div className="flex items-center justify-between gap-[var(--space-3)]">
                  <div>
                    <p className="m-0 text-sm font-medium text-[var(--color-ink)]">Undo approval</p>
                    <p className="mono-sm m-0 text-[var(--color-whisper)]">{undoLabel} remaining</p>
                  </div>
                  <button type="button" onClick={handleUndo} disabled={!!actionLoading} className="btn-ghost">
                    {actionLoading === 'undo' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Undo2 size={14} aria-hidden />}
                    Undo approval
                  </button>
                </div>
              </FolioPanel>
            )}

            <CommentsThread documentId={documentId} />
          </div>
        </div>
      </div>

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
