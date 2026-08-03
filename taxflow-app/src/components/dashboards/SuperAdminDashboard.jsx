import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UserCog } from 'lucide-react'
import { SectionHeader } from '../ui'
import OnboardClientModal from '../OnboardClientModal'
import AddEmployeeModal from '../AddEmployeeModal'
import ClientListPanel from '../ClientListPanel'
import PendingReviewsPanel from '../PendingReviewsPanel'

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)

  return (
    <div className="mx-auto w-full max-w-[var(--layout-content-max)]">
      <SectionHeader
        title="Firm administration"
        subtitle="Invite preparers and clients. Client work happens in each client’s folio."
      />

      <div className="mb-[var(--space-8)] flex flex-wrap gap-[var(--space-2)]">
        <button type="button" onClick={() => setAddEmployeeOpen(true)} className="btn-signal">
          <UserCog size={14} strokeWidth={2.5} aria-hidden />
          Add preparer
        </button>
        <button type="button" onClick={() => setOnboardOpen(true)} className="btn-ghost">
          <UserPlus size={14} strokeWidth={2.5} aria-hidden />
          Invite a client
        </button>
      </div>

      <PendingReviewsPanel />

      <ClientListPanel />

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
