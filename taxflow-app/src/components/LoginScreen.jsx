import { useState } from 'react'
import { AlertCircle, Loader2, ShieldCheck, FolderLock, FileCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import FloatingLabel from './FloatingLabel'
import ForgotPasswordForm from './ForgotPasswordForm'
import DemoLoginSection from './DemoLoginSection'

const DEFAULT_FEATURES = [
  {
    icon: FolderLock,
    title: 'Secure client vaults',
    description: 'Every file stays in an encrypted Box workspace.',
    accent: 'var(--color-trace)',
    accentMuted: 'var(--color-trace-muted)',
  },
  {
    icon: FileCheck,
    title: 'Structured requests',
    description: 'Send checklists and track what is still outstanding.',
    accent: 'var(--color-commit)',
    accentMuted: 'var(--color-commit-muted)',
  },
  {
    icon: Users,
    title: 'Team-ready workflow',
    description: 'Preparers, admins, and clients each see the right view.',
    accent: 'var(--color-signal)',
    accentMuted: 'var(--color-signal-muted)',
  },
]

/**
 * Auth split layout — left hero, right form.
 */
function AuthSplit({ children, railTitle, railBody, features, steps }) {
  const highlights = features?.length ? features : null

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--color-archive)] md:flex-row">
      <aside className="auth-hero relative hidden w-[45%] max-w-lg flex-col justify-between border-r border-[var(--color-rule)] px-[var(--space-12)] py-[var(--space-12)] md:flex">
        <div>
          <div className="mb-[var(--space-10)] flex items-center gap-[var(--space-3)]">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]"
              aria-hidden
            >
              <span className="font-display text-xs font-bold text-[var(--color-signal)]">TF</span>
            </div>
            <span className="font-display text-sm font-semibold tracking-tight text-[var(--color-ink)]">
              TaxFlow Pro
            </span>
          </div>

          <p className="label-caps m-0 mb-[var(--space-3)] text-[var(--color-trace)]">
            Tax document platform
          </p>
          <h1 className="m-0 mb-[var(--space-4)] max-w-[22ch] font-display text-2xl font-bold text-[var(--color-ink)]">
            {railTitle}
          </h1>
          <p className="m-0 max-w-[36ch] text-sm leading-relaxed text-[var(--color-whisper)]">
            {railBody}
          </p>
        </div>

        {highlights ? (
          <ul className="m-0 list-none space-y-[var(--space-4)] p-0" aria-label="Platform highlights">
            {highlights.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title} className="flex items-start gap-[var(--space-3)]">
                  <span
                    className="auth-feature-icon"
                    style={{ background: item.accentMuted, borderColor: item.accent }}
                    aria-hidden
                  >
                    <Icon size={16} style={{ color: item.accent }} strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 pt-[var(--space-1)]">
                    <span className="block text-sm font-medium text-[var(--color-ink)]">
                      {item.title}
                    </span>
                    <span className="mt-[var(--space-1)] block text-xs leading-relaxed text-[var(--color-whisper)]">
                      {item.description}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : steps?.length > 0 ? (
          <ol className="m-0 list-none space-y-[var(--space-3)] p-0" aria-label="Steps">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-[var(--space-3)] text-sm text-[var(--color-whisper)]">
                <span
                  className="folio-spine h-4"
                  style={{
                    background: index === 0
                      ? 'var(--color-signal)'
                      : index === 1
                        ? 'var(--color-trace)'
                        : 'var(--color-commit)',
                  }}
                  aria-hidden
                />
                {step}
              </li>
            ))}
          </ol>
        ) : null}

        <p className="m-0 flex items-center gap-[var(--space-2)] text-xs text-[var(--color-whisper)]">
          <ShieldCheck size={14} className="shrink-0 text-[var(--color-commit)]" aria-hidden />
          Enterprise-grade storage powered by Box
        </p>
      </aside>

      <div className="flex flex-1 flex-col justify-center px-[var(--space-4)] py-[var(--space-8)] sm:px-[var(--space-8)] lg:px-[var(--space-12)]">
        <div className="mb-[var(--space-8)] flex items-center gap-[var(--space-3)] md:hidden">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]"
            aria-hidden
          >
            <span className="font-display text-xs font-bold text-[var(--color-signal)]">TF</span>
          </div>
          <span className="font-display text-sm font-semibold text-[var(--color-ink)]">TaxFlow Pro</span>
        </div>

        <div className="auth-card mx-auto w-full max-w-md p-[var(--space-6)] sm:p-[var(--space-8)]">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function LoginScreen() {
  const { login, demoLogin, loginLoading, tokenError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [forgotMode, setForgotMode] = useState(false)

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message || 'Sign in failed')
    }
  }

  const displayError = error || tokenError

  return (
    <AuthSplit
      railTitle="Document management built for tax firms"
      railBody="Collect client files, track review status, and keep every engagement organized in one secure workspace."
      features={DEFAULT_FEATURES}
    >
      {forgotMode ? (
        <ForgotPasswordForm
          onBack={() => { setForgotMode(false); setError(null) }}
          initialEmail={email}
          displayError={displayError}
          setError={setError}
        />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
            <div className="mb-[var(--space-2)]">
              <h2 className="m-0 font-display text-xl font-bold text-[var(--color-ink)]">
                Welcome back
              </h2>
              <p className="m-0 mt-[var(--space-2)] text-sm leading-relaxed text-[var(--color-whisper)]">
                Sign in with the email address your firm registered for you.
              </p>
            </div>

            {displayError && (
              <div
                className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]"
                role="alert"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
                <p className="m-0 text-sm text-[var(--color-flag)]">{displayError}</p>
              </div>
            )}

            <FloatingLabel
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <FloatingLabel
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(null) }}
                className="cursor-pointer border-none bg-transparent p-0 text-sm font-medium text-[var(--color-trace)] hover:text-[var(--color-ink)]"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loginLoading || !isFormValid}
              className="btn-signal w-full"
            >
              {loginLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>

            <p className="m-0 mt-[var(--space-2)] text-center text-xs leading-relaxed text-[var(--color-whisper)]">
              New client? Open the invitation link in your email to create your account.
            </p>
          </form>

          <DemoLoginSection demoLogin={demoLogin} />
        </>
      )}
    </AuthSplit>
  )
}

export { AuthSplit }
