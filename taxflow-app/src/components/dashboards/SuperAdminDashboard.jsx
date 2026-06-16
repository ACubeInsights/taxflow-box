import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UserCog } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import OnboardClientModal from '../OnboardClientModal'
import AddEmployeeModal from '../AddEmployeeModal'
import ClientListPanel from '../ClientListPanel'

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)

  return (
    <div className="max-w-[1200px] mx-auto py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="m-0 text-[22px] font-semibold text-[var(--color-on-surface)]">
          Administration
        </h1>
        <p className="m-0 mt-1 text-[14px] text-[var(--color-on-surface-variant)]">
          Manage employees, clients, and system settings
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setAddEmployeeOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer bg-white text-[#1a1a1a] border-none transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          <UserCog size={15} />
          Add Employee
        </button>
        <button
          onClick={() => setOnboardOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] transition-all hover:bg-[var(--color-surface-container-high)] active:scale-[0.98]"
        >
          <UserPlus size={15} />
          Onboard Client
        </button>
      </div>

      {/* Client list */}
      <ClientListPanel />

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

      <AddEmployeeModal
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
      />
    </div>
  )
}
