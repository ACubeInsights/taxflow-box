import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, UserPlus, Shield, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { SectionHeader } from '../ui'
import ClientListPanel from '../ClientListPanel'
import DocumentRequestCreator from '../DocumentRequestCreator'
import OnboardClientModal from '../OnboardClientModal'
import PermissionManagerPanel from '../PermissionManagerPanel'
import ShareFileModal from '../ShareFileModal'

const ACTIONS = [
  { id: 'request', label: 'New document request', icon: Plus, signal: true },
  { id: 'share', label: 'Share a file', icon: Upload, signal: false },
  { id: 'onboard', label: 'Invite a client', icon: UserPlus, signal: false },
  { id: 'permissions', label: 'Manage access', icon: Shield, signal: false },
]

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [shareFileOpen, setShareFileOpen] = useState(false)

  const handleAction = (id) => {
    switch (id) {
      case 'request': setDrawerOpen(true); break
      case 'share': setShareFileOpen(true); break
      case 'onboard': setOnboardOpen(true); break
      case 'permissions': setPermissionsOpen(true); break
    }
  }

  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="mx-auto w-full max-w-[var(--layout-content-max)]">
      <SectionHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Your book'}
        subtitle="Open a client to review documents, or start a new request."
      />

      <div className="mb-[var(--space-8)] flex flex-wrap gap-[var(--space-2)]">
        {ACTIONS.map((btn) => {
          const Icon = btn.icon
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleAction(btn.id)}
              className={btn.signal ? 'btn-signal' : 'btn-ghost'}
            >
              <Icon size={14} strokeWidth={2.5} aria-hidden />
              {btn.label}
            </button>
          )
        })}
      </div>

      <ClientListPanel />

      <DocumentRequestCreator
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <OnboardClientModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onSuccess={(result) => {
          setOnboardOpen(false)
          if (result.clientId) navigate(`/clients/${result.clientId}`)
        }}
      />

      {permissionsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-[var(--space-4)] sm:p-[var(--space-6)]"
          style={{ background: 'color-mix(in srgb, var(--color-archive) 72%, transparent)' }}
          onClick={() => setPermissionsOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[80vh] w-full max-w-[700px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Manage access"
          >
            <PermissionManagerPanel onClose={() => setPermissionsOpen(false)} />
          </div>
        </div>
      )}

      <ShareFileModal
        open={shareFileOpen}
        onClose={() => setShareFileOpen(false)}
      />
    </div>
  )
}
