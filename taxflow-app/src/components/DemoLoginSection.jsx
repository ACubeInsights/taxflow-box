import { useState } from 'react'
import { Shield, Users, FileText, ChevronDown } from 'lucide-react'

const DEMO_ACCOUNTS = [
  {
    id: 'superadmin',
    label: 'Admin',
    description: 'Firm administration and preparer accounts',
    icon: Shield,
    spine: 'var(--color-signal)',
  },
  {
    id: 'employee',
    label: 'Tax preparer',
    description: 'Client book, requests, and document review',
    icon: FileText,
    spine: 'var(--color-trace)',
  },
  {
    id: 'client',
    label: 'Client',
    description: 'Vault folders and document uploads',
    icon: Users,
    spine: 'var(--color-commit)',
  },
]

/**
 * Temporary / demo account access — Admin, Tax preparer, Client.
 * Kept for local and staging walkthroughs.
 */
export default function DemoLoginSection({ demoLogin }) {
  const [showDemo, setShowDemo] = useState(false)

  return (
    <div className="mt-[var(--space-6)]">
      <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
        <div className="h-px flex-1 bg-[var(--color-rule)]" aria-hidden />
        <button
          type="button"
          onClick={() => setShowDemo(v => !v)}
          aria-expanded={showDemo}
          className="flex cursor-pointer items-center gap-[var(--space-2)] border-none bg-transparent p-0 text-xs font-medium uppercase tracking-[0.04em] text-[var(--color-whisper)] hover:text-[var(--color-ink)]"
        >
          Demo accounts
          <ChevronDown
            size={12}
            aria-hidden
            style={{ transform: showDemo ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        <div className="h-px flex-1 bg-[var(--color-rule)]" aria-hidden />
      </div>

      {showDemo && (
        <div className="flex flex-col gap-[var(--space-2)]" role="group" aria-label="Demo accounts">
          <p className="m-0 mb-[var(--space-1)] text-xs text-[var(--color-whisper)]">
            Temporary access for walkthroughs — skips password.
          </p>
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => demoLogin(account.id)}
                className="flex w-full cursor-pointer items-stretch gap-[var(--space-3)] rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-ledger)] text-left transition-[border-color,background-color] hover:border-[var(--color-trace)] hover:bg-[color-mix(in_srgb,var(--color-ledger)_88%,var(--color-trace)_12%)]"
              >
                <span
                  className="folio-spine min-h-[48px] rounded-l-[var(--radius-panel)] rounded-r-none"
                  style={{ background: account.spine }}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 items-center gap-[var(--space-3)] py-[var(--space-3)] pr-[var(--space-4)]">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-folio)]"
                    aria-hidden
                  >
                    <Icon size={14} style={{ color: account.spine }} strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--color-ink)]">
                      {account.label}
                    </span>
                    <span className="mt-[var(--space-1)] block text-xs text-[var(--color-whisper)]">
                      {account.description}
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
