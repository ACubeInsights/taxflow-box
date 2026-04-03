import { useState, useEffect, useCallback } from 'react'
import { Users, Clock, AlertTriangle, FileText, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { StatCard, GlassPanel } from './ui'
import { portalApi } from '../services/api'

const STAT_CONFIG = [
  { key: 'activeClients', label: 'Active Clients', icon: Users, color: '#06b6d4' },
  { key: 'pendingReviews', label: 'Pending Reviews', icon: Clock, color: '#fbbf24' },
  { key: 'overdueDocuments', label: 'Overdue Documents', icon: AlertTriangle, color: '#ef4444' },
  { key: 'awaitingClientAction', label: 'Awaiting Client Action', icon: FileText, color: '#a78bfa' },
]

export default function SummaryBar() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await portalApi.getEmployeeSummary('employee-1')
      setSummary(data)
    } catch (err) {
      setError(err.message || 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <GlassPanel key={i} delay={i * 50}>
            <div
              className="h-[80px] rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }}
            />
          </GlassPanel>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-6">
        <GlassPanel>
          <div className="p-6 text-center rounded-2xl" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <AlertTriangle size={32} color="#f87171" style={{ margin: '0 auto 12px' }} />
            <p className="text-[#f87171] text-sm font-semibold m-0 mb-2">Failed to load summary</p>
            <p className="text-[var(--color-on-surface-variant)] text-xs m-0 mb-4">{error}</p>
            <button
              onClick={fetchSummary}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer"
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {STAT_CONFIG.map((stat, i) => (
        <StatCard
          key={stat.key}
          label={stat.label}
          value={String(summary?.[stat.key] ?? 0)}
          icon={stat.icon}
          color={stat.color}
          delay={i * 50}
        />
      ))}
    </div>
  )
}
