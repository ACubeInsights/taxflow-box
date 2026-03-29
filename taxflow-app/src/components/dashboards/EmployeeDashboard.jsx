import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Users, Clock, CheckCircle, Sparkles, Plus, AlertTriangle, RefreshCw } from 'lucide-react'
import { StatCard, SectionHeader, GlassPanel, PanelTitle, Badge } from '../ui'
import { useDocumentWorkflow } from '../../context/DocumentWorkflowContext'
import { portalApi } from '../../services/api'
import DocumentRequestList from '../DocumentRequestList'
import RequestCreatorDrawer from '../RequestCreatorDrawer'
import ReviewMode from '../ReviewMode'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const CLIENTS_FALLBACK = [
  { name: 'Acme Industries LLC', type: 'Business', docs: 14, status: 'review', aiScore: 92 },
  { name: 'Jennifer & Mark Torres', type: 'Individual', docs: 8, status: 'pending', aiScore: 78 },
  { name: 'Blue Horizon Trust', type: 'Trust', docs: 22, status: 'complete', aiScore: 97 },
  { name: 'Ray Kowalski', type: 'Individual', docs: 5, status: 'missing', aiScore: 45 },
  { name: 'Stellare Software Inc.', type: 'S-Corp', docs: 31, status: 'review', aiScore: 88 },
]

const STATUS_META = {
  review: { label: 'In Review', color: 'var(--color-tertiary)' },
  pending: { label: 'Pending Docs', color: 'var(--color-on-surface-variant)' },
  complete: { label: 'Complete', color: 'var(--color-secondary)' },
  missing: { label: 'Missing Docs', color: '#ffb4ab' },
}

const AI_INSIGHTS = [
  {
    client: 'Acme Industries LLC',
    insight: 'Detected 3 potential deductions in Schedule C not flagged in prior year — estimated savings $4,200.',
    confidence: 92,
    tag: 'Deduction Opportunity',
    tagColor: 'var(--color-secondary)',
  },
  {
    client: 'Stellare Software Inc.',
    insight: 'R&D Tax Credit eligibility detected. Box AI extracted qualifying research expenses from uploaded receipts.',
    confidence: 88,
    tag: 'Credit Identified',
    tagColor: 'var(--color-tertiary)',
  },
  {
    client: 'Jennifer & Mark Torres',
    insight: 'Missing 1099-DIV from Fidelity. Document gap detected compared to prior year filings.',
    confidence: 97,
    tag: 'Missing Document',
    tagColor: 'var(--color-on-surface-variant)',
  },
]

export default function EmployeeDashboard() {
  const { requests, dispatch } = useDocumentWorkflow()
  const [viewMode, setViewMode] = useState('list')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // API data state
  const [apiData, setApiData] = useState(null)
  const [apiLoading, setApiLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  const fetchDashboard = async () => {
    setApiLoading(true)
    setApiError(null)
    try {
      const data = await portalApi.getEmployeeDashboard('employee-1')
      setApiData(data)
    } catch (err) {
      console.warn('Employee dashboard API failed, using fallback:', err.message)
      setApiError(err.message)
    } finally {
      setApiLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  // Derive display data from API or fallback
  const CLIENTS = apiData?.clientChecklists || CLIENTS_FALLBACK
  const stats = apiData?.stats || { assignedClients: 18, pendingReview: 7, completed: 11, aiExtractions: 284 }

  // Filter requests for client-1 (demo)
  const clientRequests = requests.filter((r) => r.clientId === 'client-1')

  function handleSelectRequest(id) {
    setSelectedRequest(id)
    setViewMode('review')
  }

  function handleBackToList() {
    setViewMode('list')
    setSelectedRequest(null)
  }

  // Review mode — render ReviewMode with the selected request
  if (viewMode === 'review' && selectedRequest) {
    const request = clientRequests.find(r => r.id === selectedRequest)
    if (!request) {
      handleBackToList()
      return null
    }
    return (
      <ReviewMode
        request={request}
        onApprove={() => {
          dispatch({ type: 'APPROVE', payload: { requestId: request.id } })
          handleBackToList()
        }}
        onRequestRevision={(comments) => {
          dispatch({ type: 'REQUEST_REVISION', payload: { requestId: request.id, comments } })
          handleBackToList()
        }}
        onBack={handleBackToList}
      />
    )
  }

  // List mode (default)
  // Loading skeleton
  if (apiLoading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <motion.div variants={itemVariants}>
          <SectionHeader title="My Workspace" subtitle="Loading your dashboard..." delay={0} />
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => (
            <motion.div key={i} variants={itemVariants}>
              <GlassPanel><div style={{ height: 80, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} /></GlassPanel>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <GlassPanel><div style={{ height: 200, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} /></GlassPanel>
          <GlassPanel><div style={{ height: 200, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} /></GlassPanel>
        </div>
      </motion.div>
    )
  }

  // Error panel with retry
  if (apiError && !apiData) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <motion.div variants={itemVariants}>
          <SectionHeader title="My Workspace" subtitle="" delay={0} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <GlassPanel>
            <div style={{ padding: 24, textAlign: 'center', background: 'rgba(248,113,113,0.05)', borderRadius: 16, border: '1px solid rgba(248,113,113,0.15)' }}>
              <AlertTriangle size={32} color="#f87171" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#f87171', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Failed to load dashboard data</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 16px' }}>{apiError}</p>
              <button
                onClick={fetchDashboard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', borderRadius: 10,
                  background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)',
                  color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1400px] mx-auto"
    >
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="My Workspace"
          subtitle="Your assigned clients, review queue, and Box AI-powered document insights"
          delay={0}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assigned Clients" value={String(stats.assignedClients)} change="3 new this week" changeType="up" color="#06b6d4" icon={Users} delay={50} />
        <StatCard label="Pending Review" value={String(stats.pendingReview)} change="2 urgent" changeType="down" color="#fbbf24" icon={Clock} delay={100} />
        <StatCard label="Completed" value={String(stats.completed)} change={`${stats.assignedClients ? Math.round((stats.completed / stats.assignedClients) * 100) : 0}% of total`} changeType="up" color="#34d399" icon={CheckCircle} delay={150} />
        <StatCard label="AI Extractions" value={String(stats.aiExtractions)} change="Today" changeType="neutral" color="#a78bfa" icon={Bot} delay={200} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {/* Client list */}
        <GlassPanel delay={250}>
          <PanelTitle>Assigned Clients — Pending Review</PanelTitle>
          <div className="flex flex-col gap-3">
            {CLIENTS.map((c) => {
              const meta = STATUS_META[c.status]
              return (
                <div
                  key={c.name}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)] cursor-pointer transition-all duration-300 hover:bg-[var(--color-surface-highest)] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] group"
                >
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[12px] font-bold shrink-0 transition-transform duration-300 group-hover:scale-105"
                    style={{
                      background: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
                      color: meta.color,
                    }}
                  >
                    {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)] truncate">{c.name}</p>
                    <p className="m-0 text-[12px] font-medium text-[var(--color-on-surface-variant)]">{c.type} · {c.docs} docs</p>
                  </div>
                  <Badge color={meta.color}>{meta.label}</Badge>
                </div>
              )
            })}
          </div>
        </GlassPanel>

        {/* AI Insights */}
        <GlassPanel delay={300}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/25 flex items-center justify-center shadow-[0_0_15px_var(--color-primary)]/20 animate-pulse-glow">
              <Sparkles size={16} className="text-[var(--color-primary)]" />
            </div>
            <h3 className="m-0 text-[14px] font-bold text-[var(--color-on-surface-variant)] tracking-[0.08em] uppercase">
              Box AI Insights
            </h3>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                Live
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {AI_INSIGHTS.map((item) => (
              <div
                key={item.client}
                className="p-4 rounded-[18px] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 transition-all duration-300 hover:bg-[var(--color-primary)]/10 hover:-translate-y-[2px]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-[13px] font-bold text-[var(--color-on-surface)]">{item.client}</span>
                  <Badge color={item.tagColor}>{item.tag}</Badge>
                </div>
                <p className="m-0 mb-3 text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed">
                  {item.insight}
                </p>
                <div className="flex items-center gap-2">
                  <Bot size={12} className="text-[var(--color-primary)]" />
                  <span className="text-[11px] font-bold text-[var(--color-primary)]/80">
                    Box AI confidence: {item.confidence}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Document Requests Section */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-on-surface-variant)]">
            Client Documents
          </h3>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-container)] px-5 py-2.5 text-[13px] font-bold tracking-wide text-[var(--color-surface-lowest)] shadow-[0_8px_20px_rgba(173,198,255,0.25)] transition-all duration-300 hover:shadow-[0_12px_25px_rgba(173,198,255,0.4)] hover:-translate-y-[1px] active:scale-[0.98]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 20px rgba(173,198,255,0.25)' }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Request Documents
          </button>
        </div>
        <DocumentRequestList
          requests={clientRequests}
          onSelect={handleSelectRequest}
        />
      </motion.div>

      {/* Request Creator Drawer */}
      <RequestCreatorDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </motion.div>
  )
}
