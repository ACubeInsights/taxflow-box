import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AlertTriangle, RefreshCw, Clock, FolderOpen, ArrowLeft, Users,
} from 'lucide-react'
import Breadcrumb from '../../Breadcrumb'
import { projectApi, clientApi } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { ENGAGEMENT_STATUS_COLORS } from '../../../constants/roles'
import { useToast } from '../../../context/ToastContext'
import { VaultTab } from './VaultTab'
import { TeamTab } from './TeamTab'
import { ProjectsTab } from './ProjectsTab'

const TABS = [
  { key: 'projects', label: 'Projects', icon: FolderOpen },
  { key: 'vault', label: 'Vault', icon: FolderOpen },
  { key: 'team', label: 'Team', icon: Users },
]

export default function ClientDetailView() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const employeeId = user?.id || 'employee-1'
  const { error: toastError } = useToast()
  const [client, setClient] = useState(null)
  const [clientLoading, setClientLoading] = useState(true)
  const [clientError, setClientError] = useState(null)
  const [activeTab, setActiveTab] = useState('projects')

  const fetchClient = useCallback(async () => {
    setClientLoading(true)
    setClientError(null)
    try {
      // Fetch all clients
      let clients = []
      try {
        const data = await projectApi.getAllClients()
        clients = data.clients || data || []
      } catch { /* ignore */ }

      let found = clients.find((c) => c.id === clientId)

      if (!found) {
        setClientError('not_found')
      } else {
        setClient(found)
      }
    } catch (err) {
      toastError(err.message || 'Failed to load client')
      setClientError(err.message || 'Failed to load client')
    } finally {
      setClientLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchClient() }, [fetchClient])

  if (clientLoading) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="h-4 w-48 rounded mb-6 animate-pulse bg-[var(--color-surface-high)]" />
        <div className="h-8 w-64 rounded mb-4 animate-pulse bg-[var(--color-surface-highest)]" />
        <GlassPanel>
          <div className="h-[300px] rounded-xl animate-pulse bg-[var(--color-surface-high)]" />
        </GlassPanel>
      </div>
    )
  }

  if (clientError === 'not_found') {
    return (
      <div className="max-w-[1200px] mx-auto">
        <GlassPanel>
          <div className="py-12 text-center">
            <AlertTriangle size={40} className="text-[var(--color-error)] mx-auto mb-4" />
            <p className="text-[var(--color-error)] text-lg font-bold m-0 mb-2">Client not found</p>
            <p className="text-[var(--color-on-surface-variant)] text-sm m-0 mb-6">
              The client you are looking for does not exist or is not assigned to you.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold no-underline bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/25 text-[var(--color-primary)]"
            >
              Back to Dashboard
            </Link>
          </div>
        </GlassPanel>
      </div>
    )
  }

  if (clientError) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <GlassPanel>
          <div className="py-8 text-center rounded-xl bg-[var(--color-error-muted)] border border-[var(--color-error)]/15">
            <AlertTriangle size={32} className="text-[var(--color-error)] mx-auto mb-3" />
            <p className="text-[var(--color-error)] text-sm font-semibold m-0 mb-2">Failed to load client</p>
            <p className="text-[var(--color-on-surface-variant)] text-xs m-0 mb-4">{clientError}</p>
            <button
              onClick={fetchClient}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer bg-[var(--color-error-muted)] border border-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </GlassPanel>
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: client.name, path: `/clients/${clientId}` },
  ]
  const statusColor = ENGAGEMENT_STATUS_COLORS[client.engagementStatus] || 'var(--color-on-surface-variant)'

  return (
    <div className="max-w-[1200px] mx-auto">
      <Breadcrumb segments={breadcrumbs} />
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0"
          style={{
            background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
            color: statusColor,
          }}
        >
          {(client.name || '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <h1 className="m-0 text-[28px] font-bold tracking-tight text-[var(--color-on-surface)]">
            {client.name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge color={statusColor}>{(client.engagementStatus || '').replace('_', ' ')}</Badge>
            <span className="text-[12px] text-[var(--color-on-surface-variant)]">{client.entityType}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 mb-6 border-b border-[var(--color-rule)]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const TabIcon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-selected={isActive}
              className={`flex cursor-pointer items-center gap-[var(--space-2)] border-b-2 bg-transparent px-[var(--space-4)] py-[var(--space-3)] text-sm font-medium transition-colors sm:px-[var(--space-6)] ${
                isActive
                  ? 'border-[var(--color-signal)] text-[var(--color-ink)]'
                  : 'border-transparent text-[var(--color-whisper)] hover:text-[var(--color-ink)]'
              }`}
            >
              <TabIcon size={15} aria-hidden />
              {tab.label}
            </button>
          )
        })}
      </div>
      {activeTab === 'projects' && <ProjectsTab clientId={clientId} navigate={navigate} />}
      {activeTab === 'vault' && <VaultTab client={client} />}
      {activeTab === 'team' && <TeamTab clientId={clientId} />}
    </div>
  )
}


