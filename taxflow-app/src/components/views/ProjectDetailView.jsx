import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, AlertCircle, RefreshCw, FileText, Calendar, ArrowRight } from 'lucide-react'
import { projectApi, reviewApi } from '../../services/api'
import { saveFilters, loadFilters } from '../../services/sessionFilters'
import Breadcrumb from '../Breadcrumb'
import StatusFilterChips from '../StatusFilterChips'
import { GlassPanel, StatusBadge, Badge, ProgressBar } from '../ui'

const PRIORITY_COLORS = {
  Urgent: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#6b7280',
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="h-3 w-40 rounded bg-white/[0.06]" />
      <div className="h-3 w-24 rounded bg-white/[0.04] hidden sm:block" />
      <div className="flex-1" />
      <div className="h-5 w-16 rounded bg-white/[0.06]" />
    </div>
  )
}

function truncate(str, max = 80) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function ProjectDetailView() {
  const { clientId, projectId } = useParams()
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
        projectApi.getEmployeeClients('employee-1'),
      ])

      if (!projectData) {
        setError('Project not found')
        setLoading(false)
        return
      }

      setProject(projectData)
      setDocuments(projectData.documents || [])

      const client = (clients || []).find((c) => c.id === clientId)
      setClientName(client?.name || 'Client')
    } catch (err) {
      setError(err.message || 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [projectId, clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    if (uploadedDocIds.length === 0) return
    setBulkLoading(true)
    setBulkError(null)
    try {
      await reviewApi.bulkTransition(uploadedDocIds, {
        toStatus: 'Under_Review',
        employeeId: 'employee-1',
      })
      await fetchData()
    } catch (err) {
      setBulkError(err.message || 'Bulk transition failed')
    } finally {
      setBulkLoading(false)
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="h-3 w-48 rounded bg-white/[0.06] mb-4 animate-pulse" />
        <div className="h-8 w-64 rounded bg-white/[0.08] mb-2 animate-pulse" />
        <div className="h-2 w-full max-w-xs rounded bg-white/[0.04] mb-8 animate-pulse" />
        <GlassPanel>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </GlassPanel>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <Breadcrumb
          segments={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: clientName || 'Client', path: `/clients/${clientId}` },
          ]}
        />
        <GlassPanel className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={40} className="text-red-400/60 mb-4" />
          <p className="text-[15px] font-semibold text-red-400/80 mb-2">{error}</p>
          {error === 'Project not found' ? (
            <button
              onClick={() => navigate(`/clients/${clientId}`)}
              className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-4 py-2 text-[13px] font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-container)]"
            >
              Back to Client
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

  const progressPct = project?.progressPercentage ?? 0
  const docCount = documents.length

  return (
    <div className="max-w-[1200px] mx-auto">
      <Breadcrumb
        segments={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: clientName, path: `/clients/${clientId}` },
          { label: project?.name || 'Project', path: `/clients/${clientId}/projects/${projectId}` },
        ]}
      />

      {/* Project header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h1 className="m-0 text-[28px] font-bold tracking-tight text-[var(--color-on-surface)]">
            {project?.name}
          </h1>
          {project?.status && <StatusBadge status={project.status} />}
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)]">
            {docCount} document{docCount !== 1 ? 's' : ''}
          </span>
          <span className="text-[12px] font-medium text-[var(--color-on-surface-variant)]">
            {progressPct}% complete
          </span>
        </div>
        <div className="max-w-md">
          <ProgressBar value={progressPct} color="var(--color-primary)" />
        </div>
      </motion.div>

      {/* Filters + bulk action */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap items-center gap-4 mb-6"
      >
        <StatusFilterChips selected={selectedStatuses} onChange={setSelectedStatuses} />
        {uploadedDocIds.length > 0 && (
          <button
            onClick={handleBulkTransition}
            disabled={bulkLoading}
            className="ml-auto flex items-center gap-2 rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/15 px-4 py-2 text-[12px] font-bold text-[#3b82f6] transition-all hover:bg-[#3b82f6]/25 disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Mark All Uploaded as Under Review ({uploadedDocIds.length})
          </button>
        )}
      </motion.div>
      {bulkError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {bulkError}
        </div>
      )}

      {/* Document list */}
      <GlassPanel delay={200}>
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={32} className="text-white/20 mb-3" />
            <p className="text-[13px] text-[var(--color-on-surface-variant)]">
              {documents.length === 0 ? 'No documents in this project yet.' : 'No documents match the selected filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => navigate(`/clients/${clientId}/projects/${projectId}/documents/${doc.id}`)}
                className="w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] cursor-pointer bg-transparent border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate">
                    {doc.name}
                  </p>
                  {doc.description && (
                    <p className="m-0 mt-0.5 text-[11px] text-[var(--color-on-surface-variant)] truncate">
                      {truncate(doc.description)}
                    </p>
                  )}
                </div>
                {doc.priority && (
                  <Badge color={PRIORITY_COLORS[doc.priority] || '#6b7280'}>
                    {doc.priority}
                  </Badge>
                )}
                {doc.dueDate && (
                  <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--color-on-surface-variant)] whitespace-nowrap">
                    <Calendar size={12} />
                    {formatDate(doc.dueDate)}
                  </span>
                )}
                <StatusBadge status={doc.status} />
                {doc.updatedAt && (
                  <span className="hidden md:block text-[10px] text-[var(--color-on-surface-variant)]/60 whitespace-nowrap">
                    {formatDate(doc.updatedAt)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
