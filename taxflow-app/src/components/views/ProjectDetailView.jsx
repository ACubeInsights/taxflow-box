import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, RefreshCw, FileText, Calendar, ArrowRight } from 'lucide-react'
import { projectApi, reviewApi } from '../../services/api'
import { saveFilters, loadFilters } from '../../services/sessionFilters'
import Breadcrumb from '../Breadcrumb'
import StatusFilterChips from '../StatusFilterChips'
import { FolioPanel, StatusBadge, Badge, ProgressBar, FolioRow } from '../ui'
import EmptyState from '../EmptyState'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PRIORITY_COLORS } from '../../constants/roles'
import { STATUS_COLORS as DOC_STATUS_COLORS } from '../../constants/statusColors'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function truncate(str, max = 80) {
  if (!str) return ''
  return str.length > max ? `${str.slice(0, max)}…` : str
}

export default function ProjectDetailView() {
  const { error: toastError } = useToast()
  const { clientId, projectId } = useParams()
  const { user } = useAuth()
  const employeeId = user?.id
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [documents, setDocuments] = useState([])
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  const filterKey = `/clients/${clientId}/projects/${projectId}:statusFilters`
  const [selectedStatuses, setSelectedStatuses] = useState(() => {
    const saved = loadFilters(filterKey)
    return Array.isArray(saved) ? saved : []
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectData, clients] = await Promise.all([
        projectApi.getProjectDetail(projectId),
        projectApi.getAllClients(),
      ])

      if (!projectData) {
        setError('Project not found')
        setLoading(false)
        return
      }

      setProject(projectData)
      setDocuments(projectData.documents || [])

      const list = clients?.clients || clients || []
      const client = list.find((c) => c.id === clientId)
      setClientName(client?.name || 'Client')
    } catch (err) {
      toastError(err.message || 'Could not load project')
      setError(err.message || 'Could not load project')
    } finally {
      setLoading(false)
    }
  }, [projectId, clientId, toastError])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    saveFilters(filterKey, selectedStatuses)
  }, [selectedStatuses, filterKey])

  const filteredDocs = selectedStatuses.length === 0
    ? documents
    : documents.filter((d) => selectedStatuses.includes(d.status))

  const uploadedDocIds = documents
    .filter((d) => d.status === 'Uploaded')
    .map((d) => d.id)

  const handleBulkTransition = async () => {
    if (uploadedDocIds.length === 0 || !employeeId) return
    setBulkLoading(true)
    setBulkError(null)
    try {
      await reviewApi.bulkTransition(uploadedDocIds, {
        toStatus: 'Under_Review',
        employeeId,
      })
      await fetchData()
    } catch (err) {
      setBulkError(err.message || 'Could not mark documents under review')
    } finally {
      setBulkLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[var(--layout-content-max)]">
        <div className="mb-[var(--space-4)] h-3 w-48 animate-pulse rounded bg-[var(--color-ledger)]" />
        <div className="mb-[var(--space-2)] h-8 w-64 animate-pulse rounded bg-[var(--color-ledger)]" />
        <FolioPanel>
          <div className="space-y-[var(--space-3)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-[var(--radius-panel)] bg-[var(--color-ledger)]" />
            ))}
          </div>
        </FolioPanel>
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
          ]}
        />
        <FolioPanel className="py-[var(--space-12)] text-center">
          <AlertCircle size={36} className="mx-auto mb-[var(--space-4)] text-[var(--color-flag)]" aria-hidden />
          <p className="m-0 mb-[var(--space-2)] text-sm font-medium text-[var(--color-flag)]">{error}</p>
          <button
            type="button"
            onClick={error === 'Project not found' ? () => navigate(`/clients/${clientId}`) : fetchData}
            className="btn-ghost mt-[var(--space-4)]"
          >
            {error === 'Project not found' ? 'Back to client' : <><RefreshCw size={14} aria-hidden /> Retry</>}
          </button>
        </FolioPanel>
      </div>
    )
  }

  const progressPct = project?.progressPercentage ?? 0
  const docCount = documents.length

  return (
    <div className="mx-auto max-w-[var(--layout-content-max)]">
      <Breadcrumb
        segments={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: clientName, path: `/clients/${clientId}` },
          { label: project?.name || 'Project', path: `/clients/${clientId}/projects/${projectId}` },
        ]}
      />

      <header className="mb-[var(--space-8)]">
        <div className="mb-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-3)]">
          <h1 className="m-0 font-display text-2xl font-bold text-[var(--color-ink)]">
            {project?.name}
          </h1>
          {project?.status && <StatusBadge status={project.status} />}
        </div>
        <div className="mb-[var(--space-4)] flex flex-wrap items-center gap-[var(--space-4)] text-sm text-[var(--color-whisper)]">
          <span>{docCount} document{docCount !== 1 ? 's' : ''}</span>
          <span className="mono-sm">{progressPct}% complete</span>
        </div>
        <div className="max-w-md">
          <ProgressBar value={progressPct} color="var(--color-trace)" />
        </div>
      </header>

      <div className="mb-[var(--space-6)] flex flex-wrap items-center gap-[var(--space-4)]">
        <StatusFilterChips selected={selectedStatuses} onChange={setSelectedStatuses} />
        {uploadedDocIds.length > 0 && (
          <button
            type="button"
            onClick={handleBulkTransition}
            disabled={bulkLoading || !employeeId}
            className="btn-ghost ml-auto text-xs"
          >
            {bulkLoading
              ? <Loader2 size={14} className="animate-spin" aria-hidden />
              : <ArrowRight size={14} aria-hidden />
            }
            Mark {uploadedDocIds.length} uploaded as under review
          </button>
        )}
      </div>

      {bulkError && (
        <div className="mb-[var(--space-4)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-flag)]" role="alert">
          {bulkError}
        </div>
      )}

      <FolioPanel className="!p-0 overflow-hidden">
        {filteredDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={documents.length === 0 ? 'No documents yet' : 'No documents match these filters'}
            subtitle={documents.length === 0
              ? 'Create a document request from the dashboard to start this project.'
              : 'Clear the status filter to see all documents.'}
          />
        ) : (
          <div className="flex flex-col gap-[var(--space-2)] p-[var(--space-3)]">
            {filteredDocs.map((doc) => (
              <FolioRow
                key={doc.id}
                spineColor={DOC_STATUS_COLORS[doc.status] || 'var(--color-whisper)'}
                onClick={() => navigate(`/clients/${clientId}/projects/${projectId}/documents/${doc.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-[var(--color-ink)]">{doc.name}</p>
                  {doc.description && (
                    <p className="m-0 mt-[var(--space-1)] truncate text-xs text-[var(--color-whisper)]">
                      {truncate(doc.description)}
                    </p>
                  )}
                </div>
                {doc.priority && (
                  <Badge color={PRIORITY_COLORS[doc.priority] || 'var(--color-whisper)'}>
                    {doc.priority}
                  </Badge>
                )}
                {doc.dueDate && (
                  <span className="hidden items-center gap-[var(--space-1)] text-xs text-[var(--color-whisper)] sm:flex">
                    <Calendar size={12} aria-hidden />
                    {formatDate(doc.dueDate)}
                  </span>
                )}
                <StatusBadge status={doc.status} />
              </FolioRow>
            ))}
          </div>
        )}
      </FolioPanel>
    </div>
  )
}
