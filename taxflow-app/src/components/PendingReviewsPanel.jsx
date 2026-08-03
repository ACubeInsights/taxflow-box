import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { portalApi } from '../services/api'
import { FolioPanel, PanelTitle, Badge, FolioRow } from './ui'
import EmptyState from './EmptyState'
import { SkeletonRow } from './Skeleton'

/**
 * Pending-review inbox for employees — wired to GET /api/portal/employee/:id/dashboard.
 */
export default function PendingReviewsPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPending = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await portalApi.getEmployeeDashboard(user.id)
      setPending(data.pendingReviews || [])
    } catch (err) {
      setError(err.message || 'Could not load pending reviews')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchPending()
    const id = setInterval(fetchPending, 60000)
    return () => clearInterval(id)
  }, [fetchPending])

  const openItem = (item) => {
    if (item.clientId) {
      navigate(`/clients/${item.clientId}`)
      return
    }
    if (item.projectId) {
      navigate(`/projects/${item.projectId}`)
    }
  }

  return (
    <FolioPanel className="mb-[var(--space-8)]">
      <div className="mb-[var(--space-4)] flex items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <PanelTitle>Needs review</PanelTitle>
          {pending.length > 0 && <Badge>{pending.length}</Badge>}
        </div>
        <button
          type="button"
          onClick={fetchPending}
          className="btn-ghost"
          aria-label="Refresh pending reviews"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh
        </button>
      </div>

      {loading && <SkeletonRow count={3} />}

      {!loading && error && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-4)] text-sm text-[var(--color-flag)]">
          {error}
        </div>
      )}

      {!loading && !error && pending.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Nothing waiting"
          subtitle="Client uploads that need review will show up here."
        />
      )}

      {!loading && !error && pending.length > 0 && (
        <ul className="m-0 list-none p-0">
          {pending.map((item) => (
            <li key={item.documentId || item.fileId || `${item.clientId}-${item.fileName}`}>
              <FolioRow onClick={() => openItem(item)}>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-[var(--color-ink)]">
                    {item.fileName || 'Document'}
                  </p>
                  <p className="m-0 truncate text-xs text-[var(--color-whisper)]">
                    {item.clientName || item.clientId || 'Client'}
                    {item.status ? ` · ${item.status.replace(/_/g, ' ')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-[var(--space-2)]">
                  {item.isOverdue && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-flag)]">
                      <AlertTriangle size={12} aria-hidden />
                      Overdue
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.04em] text-[var(--color-whisper)]">
                    <Clock size={12} aria-hidden />
                    {item.priority || 'normal'}
                  </span>
                </div>
              </FolioRow>
            </li>
          ))}
        </ul>
      )}
    </FolioPanel>
  )
}
