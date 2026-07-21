import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, AlertTriangle, RefreshCw, Users, ChevronDown } from 'lucide-react'
import { GlassPanel, PanelTitle, Badge } from './ui'
import { projectApi } from '../services/api'
import { saveFilters, loadFilters } from '../services/sessionFilters'
import { ENGAGEMENT_STATUS_COLORS, ENTITY_COLORS } from '../constants/roles'
import EmptyState from './EmptyState'
import { SkeletonRow } from './Skeleton'
import { useToast } from '../context/ToastContext'

const FILTER_KEY = '/dashboard:clientFilters'
const STATUS_OPTIONS = ['Active', 'On_Hold', 'Complete']
const ENTITY_OPTIONS = ['Individual', 'Business', 'Trust', 'S-Corp', 'Partnership', 'LLC', 'C-Corp', 'Non-Profit']

/** Custom select that matches the app's dark design system. */
function FilterSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="appearance-none rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] pl-3 pr-8 py-2.5 text-[12px] font-semibold text-[var(--color-on-surface)] outline-none cursor-pointer transition-colors hover:border-[var(--color-outline)] focus:border-[var(--color-primary)]/60 [color-scheme:dark]"
      >
        {children}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] pointer-events-none"
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
      toastError(err.message || 'Failed to load clients')
      setError(err.message || 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  useEffect(() => {
    saveFilters(FILTER_KEY, { search, status: statusFilter, entityType: entityFilter })
  }, [search, statusFilter, entityFilter])

  const filtered = useMemo(() => {
    let result = clients
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      let matcher
      try {
        if (/[.*+?^${}()|[\]\\]/.test(q)) {
          const re = new RegExp(q, 'i')
          matcher = (str) => re.test(str || '')
        } else {
          matcher = (str) => (str || '').toLowerCase().includes(q)
        }
      } catch {
        matcher = (str) => (str || '').toLowerCase().includes(q)
      }
      result = result.filter(c => matcher(c.name) || matcher(c.email))
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
      <GlassPanel>
        <PanelTitle>All Clients</PanelTitle>
        <SkeletonRow count={5} />
      </GlassPanel>
    )
  }

  if (error) {
    return (
      <GlassPanel>
        <div className="p-6 text-center rounded-xl bg-[var(--color-error-muted)] border border-[var(--color-error)]/20">
          <AlertTriangle size={28} className="text-[var(--color-error)] mx-auto mb-3" />
          <p className="text-[var(--color-error)] text-sm font-semibold m-0 mb-1">Failed to load clients</p>
          <p className="text-[var(--color-on-surface-variant)] text-xs m-0 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer bg-[var(--color-error-muted)] border border-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel>
      <PanelTitle>All Clients</PanelTitle>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] pl-9 pr-4 py-2.5 text-[13px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-colors focus:border-[var(--color-primary)]/60"
          />
        </div>
        <FilterSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </FilterSelect>
        <FilterSelect value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          <option value="">All Entity Types</option>
          {dynamicEntityOptions.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </FilterSelect>
      </div>

      {/* Client rows */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={clients.length === 0 ? 'No clients yet' : 'No clients match your filters'}
          subtitle={clients.length === 0
            ? 'Onboard your first client to get started.'
            : 'Try adjusting or clearing your filters.'}
          action={clients.length > 0 && (search || statusFilter || entityFilter)
            ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); setEntityFilter('') } }
            : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(client => {
            const statusColor = ENGAGEMENT_STATUS_COLORS[client.engagementStatus] || 'var(--color-on-surface-variant)'
            const entityColor = ENTITY_COLORS[client.entityType] || 'var(--color-on-surface-variant)'
            const initials = (client.name || '')
              .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

            return (
              <motion.div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-highest)] hover:border-[var(--color-outline)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.25)] group"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
                    color: statusColor,
                  }}
                >
                  {initials}
                </div>

                {/* Name + entity */}
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">
                    {client.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge color={entityColor}>{client.entityType}</Badge>
                    <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                      {client.activeProjects ?? 0} projects · {client.pendingActions ?? 0} pending
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                <Badge color={statusColor}>{(client.engagementStatus || '').replace('_', ' ')}</Badge>
              </motion.div>
            )
          })}
        </div>
      )}
    </GlassPanel>
  )
}
