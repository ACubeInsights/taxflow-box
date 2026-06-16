import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, AlertTriangle, RefreshCw, Users } from 'lucide-react'
import { GlassPanel, PanelTitle, Badge } from './ui'
import { projectApi } from '../services/api'
import { saveFilters, loadFilters } from '../services/sessionFilters'

const FILTER_KEY = '/dashboard:clientFilters'

const STATUS_OPTIONS = ['Active', 'On_Hold', 'Complete']
const ENTITY_OPTIONS = ['Individual', 'Business', 'Trust', 'S-Corp', 'Partnership']

const STATUS_COLORS = {
  Active: '#22c55e',
  On_Hold: '#fbbf24',
  Complete: '#64748b',
}

const ENTITY_COLORS = {
  Individual: '#06b6d4',
  Business: '#a78bfa',
  Trust: '#f59e0b',
  'S-Corp': '#ec4899',
  Partnership: '#3b82f6',
}

export default function ClientListPanel() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Restore filters from session
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
      setError(err.message || 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Persist filters on change
  useEffect(() => {
    saveFilters(FILTER_KEY, { search, status: statusFilter, entityType: entityFilter })
  }, [search, statusFilter, entityFilter])

  const filtered = useMemo(() => {
    let result = clients
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((c) => c.engagementStatus === statusFilter)
    }
    if (entityFilter) {
      result = result.filter((c) => c.entityType === entityFilter)
    }
    return result
  }, [clients, search, statusFilter, entityFilter])

  if (loading) {
    return (
      <GlassPanel>
        <PanelTitle>All Clients</PanelTitle>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[56px] rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }}
            />
          ))}
        </div>
      </GlassPanel>
    )
  }

  if (error) {
    return (
      <GlassPanel>
        <div className="p-6 text-center rounded-2xl" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <AlertTriangle size={28} color="#f87171" style={{ margin: '0 auto 10px' }} />
          <p className="text-[#f87171] text-sm font-semibold m-0 mb-2">Failed to load clients</p>
          <p className="text-[var(--color-on-surface-variant)] text-xs m-0 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 pl-9 pr-4 py-2.5 text-[13px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-all focus:border-[var(--color-primary)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-3 py-2.5 text-[12px] font-semibold text-[var(--color-on-surface)] outline-none appearance-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-3 py-2.5 text-[12px] font-semibold text-[var(--color-on-surface)] outline-none appearance-none cursor-pointer"
        >
          <option value="">All Entity Types</option>
          {ENTITY_OPTIONS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Client rows */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <Users size={32} className="mx-auto mb-3 text-[var(--color-on-surface-variant)] opacity-40" />
          <p className="text-[var(--color-on-surface-variant)] text-sm font-medium m-0">
            {clients.length === 0
              ? 'No clients in the system yet.'
              : 'No clients match your filters.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((client) => {
            const statusColor = STATUS_COLORS[client.engagementStatus] || '#6b7280'
            const entityColor = ENTITY_COLORS[client.entityType] || '#6b7280'
            const initials = (client.name || '')
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <motion.div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] cursor-pointer transition-all duration-300 hover:bg-[var(--color-surface-highest)] hover:-translate-y-[1px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] group"
                whileHover={{ scale: 1.005 }}
              >
                {/* Avatar initials */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-bold shrink-0 transition-transform duration-300 group-hover:scale-105"
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
                  <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{client.name}</p>
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
