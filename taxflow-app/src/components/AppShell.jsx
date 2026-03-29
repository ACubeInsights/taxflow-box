import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useDocumentWorkflow } from '../context/DocumentWorkflowContext'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import SuperAdminDashboard from './dashboards/SuperAdminDashboard'
import CXODashboard from './dashboards/CXODashboard'
import EmployeeDashboard from './dashboards/EmployeeDashboard'
import ClientDashboard from './dashboards/ClientDashboard'
import UploadDropzone from './UploadDropzone'
import DocumentRequestList from './DocumentRequestList'
import ReviewMode from './ReviewMode'

const DASHBOARDS = {
  superadmin: SuperAdminDashboard,
  cxo: CXODashboard,
  employee: EmployeeDashboard,
  client: ClientDashboard,
}

export default function AppShell() {
  const { user } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState('default')

  // Reset activeView when role changes
  useEffect(() => {
    setActiveView('default')
  }, [user])

  // Responsive: auto-collapse sidebar below 1024px viewport
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)')

    const handleChange = (e) => {
      setSidebarCollapsed(e.matches)
    }

    // Set initial state
    setSidebarCollapsed(mql.matches)

    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  const Dashboard = DASHBOARDS[user] || EmployeeDashboard

  function renderContent() {
    if (user === 'client') {
      switch (activeView) {
        case 'upload':
          return <ClientUploadOnlyView />
        case 'my-documents':
          return <ClientDocumentsView />
        default:
          return <ClientDashboard />
      }
    }
    if (user === 'employee') {
      switch (activeView) {
        case 'documents':
          return <EmployeeDocumentsView />
        case 'clients':
          return <EmployeeClientsView />
        default:
          return <EmployeeDashboard />
      }
    }
    return <Dashboard />
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-surface-lowest)] relative overflow-hidden font-sans">
      {/* Ambient Deep Void Background Glows */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, rgba(173, 198, 255, 0.08) 0%, transparent 40%),
            radial-gradient(ellipse at 100% 100%, rgba(232, 179, 255, 0.08) 0%, transparent 40%),
            var(--color-surface-lowest)
          `,
        }}
      />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(p => !p)}
        activeView={activeView}
        onNavigate={setActiveView}
      />

      <div
        className="flex-1 flex flex-col relative z-[1] min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
      >
        <TopNav />
        <AnimatePresence mode="wait">
          <motion.main
            key={`${user}-${activeView}`}
            initial={{ opacity: 0, scale: 0.99, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex-1 p-8 overflow-y-auto"
          >
            {renderContent()}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Client: Upload-only view ── */
function ClientUploadOnlyView() {
  const { vault } = useDocumentWorkflow()
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20, letterSpacing: '-0.02em' }}>
        Upload Files
      </h2>
      <UploadDropzone onUpload={() => {}} disabled={!vault} folderId={vault?.id} />
    </div>
  )
}

/* ── Client: My Documents view ── */
function ClientDocumentsView() {
  const { requests } = useDocumentWorkflow()
  const clientRequests = requests.filter(r => r.clientId === 'client-1')
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20, letterSpacing: '-0.02em' }}>
        My Documents
      </h2>
      <DocumentRequestList requests={clientRequests} onSelect={() => {}} />
    </div>
  )
}

/* ── Employee: Documents view with ReviewMode ── */
function EmployeeDocumentsView() {
  const { requests, dispatch } = useDocumentWorkflow()
  const [reviewId, setReviewId] = useState(null)
  const clientRequests = requests.filter(r => r.clientId === 'client-1')

  if (reviewId) {
    const req = clientRequests.find(r => r.id === reviewId)
    if (req) {
      return (
        <ReviewMode
          request={req}
          onApprove={() => {
            dispatch({ type: 'APPROVE', payload: { requestId: req.id } })
            setReviewId(null)
          }}
          onRequestRevision={(comments) => {
            dispatch({ type: 'REQUEST_REVISION', payload: { requestId: req.id, comments } })
            setReviewId(null)
          }}
          onBack={() => setReviewId(null)}
        />
      )
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20, letterSpacing: '-0.02em' }}>
        Documents
      </h2>
      <DocumentRequestList requests={clientRequests} onSelect={setReviewId} />
    </div>
  )
}

/* ── Employee: Clients list view ── */
const CLIENTS = [
  { name: 'Acme Industries LLC', type: 'Business', docs: 14, status: 'review' },
  { name: 'Jennifer & Mark Torres', type: 'Individual', docs: 8, status: 'pending' },
  { name: 'Blue Horizon Trust', type: 'Trust', docs: 22, status: 'complete' },
  { name: 'Ray Kowalski', type: 'Individual', docs: 5, status: 'missing' },
  { name: 'Stellare Software Inc.', type: 'S-Corp', docs: 31, status: 'review' },
]

const STATUS_META = {
  review: { label: 'In Review', color: '#06b6d4' },
  pending: { label: 'Pending Docs', color: '#fbbf24' },
  complete: { label: 'Complete', color: '#34d399' },
  missing: { label: 'Missing Docs', color: '#f87171' },
}

function EmployeeClientsView() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20, letterSpacing: '-0.02em' }}>
        Clients
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CLIENTS.map((c) => {
          const meta = STATUS_META[c.status]
          return (
            <div
              key={c.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `${meta.color}15`, border: `1px solid ${meta.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: meta.color, flexShrink: 0,
              }}>
                {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff' }}>{c.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{c.type} · {c.docs} docs</p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25`,
              }}>
                {meta.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

