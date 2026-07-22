import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle, RefreshCw, Users, ChevronDown } from 'lucide-react'
import { FolioPanel, PanelTitle, Badge, FolioRow } from './ui'
import { projectApi } from '../services/api'
import { saveFilters, loadFilters } from '../services/sessionFilters'
import { ENGAGEMENT_STATUS_COLORS, ENTITY_COLORS } from '../constants/roles'
import EmptyState from './EmptyState'
import { SkeletonRow } from './Skeleton'
import { useToast } from '../context/ToastContext'

const FILTER_KEY = '/dashboard:clientFilters'
const STATUS_OPTIONS = ['Active', 'On_Hold', 'Complete']
const ENTITY_OPTIONS = ['Individual', 'Business', 'Trust', 'S-Corp', 'Partnership', 'LLC', 'C-Corp', 'Non-Profit']

function FilterSelect({ value, onChange, children, 'aria-label': ariaLabel }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className="folio-select appearance-none pr-[var(--space-8)] text-sm font-medium"
      >
        {children}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-[var(--space-3)] top-1/2 -translate-y-1/2 text-[var(--color-whisper)]"
        aria-hidden
      />
    </div>
  )
}

export default function ClientListPanel() {
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const savedFilters = loadFilters(FILTER_KEY)
  const [search, setSearch] = useState(savedFilters?.search || '')
  const [statusFilter, setStatusFilter] = useState(savedFilters?.status || '')
  const [entityFilter, setEntityFilter] = useState(savedFilters?.entityType || '')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await projectApi.getAllClients()
      setClients(data.clients || data || [])
    } catch (err) {
      toastError(err.message || 'Could not load clients')
      setError(err.message || 'Could not load clients')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { fetchClients() }, [fetchClients])

  useEffect(() => {
    saveFilters(FILTER_KEY, { search, status: statusFilter, entityType: entityFilter })
  }, [search, statusFilter, entityFilter])

  const filtered = useMemo(() => {
    let result = clients
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
      )
    }
    if (statusFilter) result = result.filter(c => c.engagementStatus === statusFilter)
    if (entityFilter) result = result.filter(c => c.entityType === entityFilter)
    return result
  }, [clients, search, statusFilter, entityFilter])

  const dynamicEntityOptions = useMemo(() => {
    const types = new Set(ENTITY_OPTIONS)
    clients.forEach(c => { if (c.entityType) types.add(c.entityType) })
    return [...types].sort()
  }, [clients])

  if (loading) {
    return (
      <FolioPanel>
        <PanelTitle>Your clients</PanelTitle>
        <SkeletonRow count={5} />
      </FolioPanel>
    )
  }

  if (error) {
    return (
      <FolioPanel>
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-6)] text-center">
          <AlertTriangle size={28} className="mx-auto mb-[var(--space-3)] text-[var(--color-flag)]" aria-hidden />
          <p className="m-0 mb-[var(--space-1)] text-sm font-medium text-[var(--color-flag)]">Could not load clients</p>
          <p className="m-0 mb-[var(--space-4)] text-xs text-[var(--color-whisper)]">{error}</p>
          <button type="button" onClick={fetchClients} className="btn-ghost inline-flex">
            <RefreshCw size={14} aria-hidden /> Retry
          </button>
        </div>
      </FolioPanel>
    )
  }

  return (
    <FolioPanel>
      <PanelTitle>Your clients</PanelTitle>

      <div className="mb-[var(--space-6)] flex flex-wrap items-center gap-[var(--space-3)]">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            className="absolute left-[var(--space-3)] top-1/2 -translate-y-1/2 text-[var(--color-whisper)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search clients"
            className="folio-input pl-[var(--space-8)]"
          />
        </div>
        <FilterSelect
          aria-label="Filter by engagement"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All engagements</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          aria-label="Filter by entity type"
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
        >
          <option value="">All entity types</option>
          {dynamicEntityOptions.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </FilterSelect>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={clients.length === 0 ? 'No clients yet' : 'No clients match these filters'}
          subtitle={clients.length === 0
            ? 'Invite your first client to open their vault.'
            : 'Clear filters to see your full book.'}
          action={clients.length > 0 && (search || statusFilter || entityFilter)
            ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); setEntityFilter('') } }
            : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-[var(--space-2)]">
          {filtered.map(client => {
            const statusColor = ENGAGEMENT_STATUS_COLORS[client.engagementStatus] || 'var(--color-whisper)'
            const entityColor = ENTITY_COLORS[client.entityType] || 'var(--color-whisper)'
            const initials = (client.name || '')
              .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

            return (
              <FolioRow
                key={client.id}
                spineColor={statusColor}
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-panel)] text-xs font-bold"
                  style={{
                    background: `color-mix(in srgb, ${statusColor} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
                    color: statusColor,
                  }}
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-[var(--color-ink)]">
                    {client.name}
                  </p>
                  <div className="mt-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-2)]">
                    <Badge color={entityColor}>{client.entityType}</Badge>
                    <span className="mono-sm text-[var(--color-whisper)]">
                      {client.activeProjects ?? 0} projects · {client.pendingActions ?? 0} pending
                    </span>
                  </div>
                </div>
                <Badge color={statusColor}>{(client.engagementStatus || '').replace('_', ' ')}</Badge>
              </FolioRow>
            )
          })}
        </div>
      )}
    </FolioPanel>
  )
}
