import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Sparkles, Plus, FileSearch, Clock, AlertTriangle, RefreshCw, UserPlus, Shield } from 'lucide-react'
import { SectionHeader, GlassPanel, PanelTitle, Badge } from '../ui'
import { portalApi, projectApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import SummaryBar from '../SummaryBar'
import ClientListPanel from '../ClientListPanel'
import DocumentRequestCreator from '../DocumentRequestCreator'
import OnboardClientModal from '../OnboardClientModal'
import PermissionManagerPanel from '../PermissionManagerPanel'

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
  const navigate = useNavigate()
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)

  // Activity feed state
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState(null)

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true)
    setActivityError(null)
    try {
      const data = await portalApi.getEmployeeActivity(user?.id, 10)
      setActivity(data.activities || data || [])
    } catch (err) {
      setActivityError(err.message || 'Failed to load activity')
    } finally {
      setActivityLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Navigate to first pending document for "Review Next Document"
  const handleReviewNext = useCallback(async () => {
    try {
      const clientsData = await projectApi.getEmployeeClients(user?.id)
      const clients = clientsData.clients || clientsData || []
      for (const client of clients) {
        const projectsData = await projectApi.getClientProjects(client.id)
        const projects = projectsData.projects || projectsData || []
        for (const project of projects) {
          const docsData = await projectApi.getProjectDocuments(project.id, 'Uploaded')
          const docs = docsData.documents || docsData || []
          if (docs.length > 0) {
            navigate(`/clients/${client.id}/projects/${project.id}/documents/${docs[0].id}`)
            return
          }
        }
      }
      // No pending docs found — stay on dashboard
    } catch {
      // Silently fail — user stays on dashboard
    }
  }, [navigate, user?.id])

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

      {/* Summary Bar */}
      <motion.div variants={itemVariants}>
        <SummaryBar />
      </motion.div>

      {/* Two-column: ClientListPanel + AI Insights */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <ClientListPanel />

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
                style={{ boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 5%, transparent)' }}
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

      {/* Recent Activity Feed */}
      <motion.div variants={itemVariants} className="mb-8">
        <GlassPanel>
          <PanelTitle>Recent Activity</PanelTitle>
          {activityLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[40px] rounded-xl bg-white/[0.04] animate-pulse"
                />
              ))}
            </div>
          ) : activityError ? (
            <div className="py-6 text-center">
              <AlertTriangle size={24} className="text-[var(--color-error)] mx-auto mb-2" />
              <p className="text-[var(--color-error)] text-xs font-semibold m-0 mb-2">Failed to load activity</p>
              <button
                onClick={fetchActivity}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer bg-[var(--color-error)]/15 border border-[var(--color-error)]/25 text-[var(--color-error)]"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : activity.length === 0 ? (
            <p className="text-[var(--color-on-surface-variant)] text-sm m-0 py-4 text-center">No recent activity.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--color-surface-high)] ring-1 ring-[var(--color-outline-variant)]"
                >
                  <Clock size={14} className="text-[var(--color-on-surface-variant)] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[13px] text-[var(--color-on-surface)]">
                      <span className="font-semibold">{entry.actorName}</span>{' '}
                      {entry.description}
                    </p>
                    <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] mt-0.5">
                      {entry.clientName} · {entry.documentName} · {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* Quick Action Buttons */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-container)] px-6 py-3 text-[13px] font-bold tracking-wide text-[var(--color-surface-lowest)] shadow-[0_8px_20px_color-mix(in_srgb,var(--color-primary)_25%,transparent)] transition-all duration-300 hover:shadow-[0_12px_25px_color-mix(in_srgb,var(--color-primary)_40%,transparent)] hover:-translate-y-[1px] active:scale-[0.98]"
          style={{ boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 40%, transparent), 0 8px 20px color-mix(in srgb, var(--color-primary) 25%, transparent)' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Document Request
        </button>
        <button
          onClick={handleReviewNext}
          className="flex items-center gap-2 rounded-[14px] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-6 py-3 text-[13px] font-bold tracking-wide text-[var(--color-on-surface)] transition-all duration-300 hover:bg-[var(--color-surface-container-high)] hover:-translate-y-[1px] active:scale-[0.98]"
        >
          <FileSearch size={16} strokeWidth={2.5} />
          Review Next Document
        </button>
        <button
          onClick={() => setOnboardOpen(true)}
          className="flex items-center gap-2 rounded-[14px] border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-[13px] font-bold tracking-wide text-emerald-400 transition-all duration-300 hover:bg-emerald-500/20 hover:-translate-y-[1px] active:scale-[0.98]"
        >
          <UserPlus size={16} strokeWidth={2.5} />
          Onboard New Client
        </button>
        <button
          onClick={() => setPermissionsOpen(true)}
          className="flex items-center gap-2 rounded-[14px] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-6 py-3 text-[13px] font-bold tracking-wide text-[var(--color-primary)] transition-all duration-300 hover:bg-[var(--color-primary)]/20 hover:-translate-y-[1px] active:scale-[0.98]"
        >
          <Shield size={16} strokeWidth={2.5} />
          Manage Permissions
        </button>
      </motion.div>

      {/* Document Request Creator */}
      <DocumentRequestCreator
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Onboard Client Modal */}
      <OnboardClientModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onSuccess={(result) => {
          setOnboardOpen(false)
          const clientId = result.clientId
          if (clientId) {
            navigate(`/clients/${clientId}`)
          }
        }}
      />

      {/* Permission Manager Panel */}
      {permissionsOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/50 backdrop-blur-sm"
          onClick={() => setPermissionsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-[600px] max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <PermissionManagerPanel onClose={() => setPermissionsOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
