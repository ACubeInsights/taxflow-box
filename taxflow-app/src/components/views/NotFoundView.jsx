import { useNavigate } from 'react-router-dom'
import { Compass, ArrowLeft } from 'lucide-react'

export default function NotFoundView() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-[var(--space-4)]">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-[var(--space-4)] flex h-12 w-12 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
          <Compass size={22} className="text-[var(--color-whisper)]" strokeWidth={1.5} aria-hidden />
        </div>
        <h1 className="m-0 mb-[var(--space-2)] font-display text-lg font-semibold text-[var(--color-ink)]">
          Page not found
        </h1>
        <p className="m-0 mb-[var(--space-6)] text-sm leading-relaxed text-[var(--color-whisper)]">
          That address is not in your workspace. Open your dashboard to continue.
        </p>
        <button type="button" onClick={() => navigate('/dashboard')} className="btn-ghost">
          <ArrowLeft size={14} aria-hidden />
          Back to dashboard
        </button>
      </div>
    </div>
  )
}
