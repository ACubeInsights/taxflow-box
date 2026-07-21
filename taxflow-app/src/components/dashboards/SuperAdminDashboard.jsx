import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, UserCog, Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import OnboardClientModal from '../OnboardClientModal'
import AddEmployeeModal from '../AddEmployeeModal'
import ClientListPanel from '../ClientListPanel'

const ACTION_BUTTONS = [
  { id: 'employee', label: 'Add Employee', icon: UserCog, primary: true },
  { id: 'client',   label: 'Onboard Client', icon: UserPlus },
]

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)

  const handleAction = (id) => {
    if (id === 'employee') setAddEmployeeOpen(true)
    if (id === 'client')   setOnboardOpen(true)
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
        <h1 className="m-0 text-[24px] font-bold text-[var(--color-on-surface)] tracking-tight font-display flex items-center gap-2.5">
          <Shield size={20} className="text-[var(--color-primary)]" strokeWidth={2} />
          Administration
        </h1>
        <p className="m-0 mt-1 text-[13px] font-medium text-[var(--color-on-surface-variant)]">
          Manage employees, clients, and system settings
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

      {/* Client list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <ClientListPanel />
      </motion.div>

      <OnboardClientModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onSuccess={(result) => {
          setOnboardOpen(false)
          if (result.clientId) navigate(`/clients/${result.clientId}`)
        }}
      />

      <AddEmployeeModal
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
      />
    </div>
  )
}
