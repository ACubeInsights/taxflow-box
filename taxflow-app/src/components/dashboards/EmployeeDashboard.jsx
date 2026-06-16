import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, UserPlus, Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ClientListPanel from '../ClientListPanel'
import DocumentRequestCreator from '../DocumentRequestCreator'
import OnboardClientModal from '../OnboardClientModal'
import PermissionManagerPanel from '../PermissionManagerPanel'

export default function EmployeeDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)

  return (
    <div className="max-w-[1200px] mx-auto py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="m-0 text-[22px] font-semibold text-[var(--color-on-surface)]">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="m-0 mt-1 text-[14px] text-[var(--color-on-surface-variant)]">
          Manage clients, documents, and permissions
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer bg-white text-[#1a1a1a] border-none transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          <Plus size={15} />
          New Document Request
        </button>
        <button
          onClick={() => setOnboardOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] transition-all hover:bg-[var(--color-surface-container-high)] active:scale-[0.98]"
        >
          <UserPlus size={15} />
          Onboard Client
        </button>
        <button
          onClick={() => setPermissionsOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] transition-all hover:bg-[var(--color-surface-container-high)] active:scale-[0.98]"
        >
          <Shield size={15} />
          Manage Permissions
        </button>
      </div>

      {/* Client list */}
      <ClientListPanel />

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
            initial={{ scale: 0.97, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-[750px] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <PermissionManagerPanel onClose={() => setPermissionsOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
