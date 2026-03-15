import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Users, Clock, CheckCircle, Sparkles, Plus } from 'lucide-react'
import { StatCard, SectionHeader, GlassPanel, PanelTitle, Badge } from '../ui'
import { useDocumentWorkflow } from '../../context/DocumentWorkflowContext'
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
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

const CLIENTS = [
  { name: 'Acme Industries LLC', type: 'Business', docs: 14, status: 'review', aiScore: 92 },
  { name: 'Jennifer & Mark Torres', type: 'Individual', docs: 8, status: 'pending', aiScore: 78 },
  { name: 'Blue Horizon Trust', type: 'Trust', docs: 22, status: 'complete', aiScore: 97 },
  { name: 'Ray Kowalski', type: 'Individual', docs: 5, status: 'missing', aiScore: 45 },
  { name: 'Stellare Software Inc.', type: 'S-Corp', docs: 31, status: 'review', aiScore: 88 },
]

const STATUS_META = {
  review: { label: 'In Review', color: '#06b6d4' },
  pending: { label: 'Pending Docs', color: '#fbbf24' },
  complete: { label: 'Complete', color: '#34d399' },
  missing: { label: 'Missing Docs', color: '#f87171' },
}

const AI_INSIGHTS = [
  {
    client: 'Acme Industries LLC',
    insight: 'Detected 3 potential deductions in Schedule C not flagged in prior year — estimated savings $4,200.',
    confidence: 92,
    tag: 'Deduction Opportunity',
    tagColor: '#34d399',
  },
  {
    client: 'Stellare Software Inc.',
    insight: 'R&D Tax Credit eligibility detected. Box AI extracted qualifying research expenses from uploaded receipts.',
    confidence: 88,
    tag: 'Credit Identified',
    tagColor: '#06b6d4',
  },
  {
    client: 'Jennifer & Mark Torres',
    insight: 'Missing 1099-DIV from Fidelity. Document gap detected compared to prior year filings.',
    confidence: 97,
    tag: 'Missing Document',
    tagColor: '#fbbf24',
  },
]

export default function EmployeeDashboard() {
  const { requests, dispatch } = useDocumentWorkflow()
  const [viewMode, setViewMode] = useState('list')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

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
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <SectionHeader
          title="My Workspace"
          subtitle="Your assigned clients, review queue, and Box AI-powered document insights"
          delay={0}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assigned Clients" value="18" change="3 new this week" changeType="up" color="#06b6d4" icon={Users} delay={50} />
        <StatCard label="Pending Review" value="7" change="2 urgent" changeType="down" color="#fbbf24" icon={Clock} delay={100} />
        <StatCard label="Completed" value="11" change="61% of total" changeType="up" color="#34d399" icon={CheckCircle} delay={150} />
        <StatCard label="AI Extractions" value="284" change="Today" changeType="neutral" color="#a78bfa" icon={Bot} delay={200} />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Client list */}
        <GlassPanel delay={250}>
          <PanelTitle>Assigned Clients — Pending Review</PanelTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CLIENTS.map((c) => {
              const meta = STATUS_META[c.status]
              return (
                <div
                  key={c.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 14px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.2s, transform 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.transform = 'translateX(2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: `${meta.color}15`,
                      border: `1px solid ${meta.color}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: meta.color,
                      flexShrink: 0,
                    }}
                  >
                    {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{c.type} · {c.docs} docs</p>
                  </div>
                  <Badge color={meta.color}>{meta.label}</Badge>
                </div>
              )
            })}
          </div>
        </GlassPanel>

        {/* AI Insights */}
        <GlassPanel delay={300}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(167,139,250,0.15)',
                border: '1px solid rgba(167,139,250,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Sparkles size={14} color="#a78bfa" />
            </div>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Box AI Insights
            </h3>
            <div style={{ marginLeft: 'auto' }}>
              <Badge color="#a78bfa">Live</Badge>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {AI_INSIGHTS.map((item) => (
              <div
                key={item.client}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'rgba(167,139,250,0.05)',
                  border: '1px solid rgba(167,139,250,0.12)',
                  cursor: 'default',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.09)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.05)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{item.client}</span>
                  <Badge color={item.tagColor}>{item.tag}</Badge>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                  {item.insight}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot size={10} color="#a78bfa" />
                  <span style={{ fontSize: 10, color: 'rgba(167,139,250,0.7)', fontWeight: 500 }}>
                    Box AI confidence: {item.confidence}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Document Requests Section */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/50">
            Client Documents
          </h3>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-100 hover:shadow-cyan-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            <Plus size={16} />
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
