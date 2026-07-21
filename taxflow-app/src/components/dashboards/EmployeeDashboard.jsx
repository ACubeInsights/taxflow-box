import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, UserPlus, Shield, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ClientListPanel from '../ClientListPanel'
import DocumentRequestCreator from '../DocumentRequestCreator'
import OnboardClientModal from '../OnboardClientModal'
import PermissionManagerPanel from '../PermissionManagerPanel'
import ShareFileModal from '../ShareFileModal'

const ACTION_BUTTONS = [
  { id: 'request', label: 'New Request', icon: Plus, primary: true },
  { id: 'share', label: 'Share File', icon: Upload },
  { id: 'onboard', label: 'Onboard Client', icon: UserPlus },
  { id: 'permissions', label: 'Permissions', icon: Shield },
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

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="m-0 text-[24px] font-bold text-[var(--color-on-surface)] tracking-tight font-display">
          {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="m-0 mt-1 text-[13px] text-[var(--color-on-surface-variant)] font-medium">
          Manage your clients, documents, and workflows
        </p>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        className="flex flex-wrap gap-2.5 mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {ACTION_BUTTONS.map((btn) => {
          const Icon = btn.icon
          return (
            <button
              key={btn.id}
              onClick={() => handleAction(btn.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border transition-all duration-200 active:scale-[0.97] ${
                btn.primary
                  ? 'bg-[var(--color-primary)] text-[#09090b] border-transparent hover:brightness-110 shadow-[0_2px_8px_rgba(129,140,248,0.25)]'
                  : 'bg-transparent border-[var(--color-outline-variant)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-high)] hover:border-[var(--color-outline)]'
              }`}
            >
              <Icon size={14} strokeWidth={2.5} />
              {btn.label}
            </button>
          )
        })}
      </motion.div>

      {/* Client list — the main content area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <ClientListPanel />
      </motion.div>

      {/* Modals and drawers */}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => setPermissionsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[700px] max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PermissionManagerPanel onClose={() => setPermissionsOpen(false)} />
          </motion.div>
        </motion.div>
      )}

      <ShareFileModal
        open={shareFileOpen}
        onClose={() => setShareFileOpen(false)}
      />
    </div>
  )
}
