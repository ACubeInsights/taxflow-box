import { useState } from 'react'
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react'
import { inviteApi } from '../services/api'
import { useAuth } from '../context/AuthContext.jsx'
import FloatingLabel from './FloatingLabel'

export default function OnboardClientModal({ open, onClose, onSuccess }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const isValid = email.trim() && email.includes('@')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await inviteApi.createInvite({
        email: email.trim(),
        employeeEmail: user?.email || '',
      })
      setResult(res)
      onSuccess?.({ clientId: res.clientId })
    } catch (err) {
      setError(err.message || 'Could not send invite')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setEmail('')
    setResult(null)
    setError(null)
    setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-[var(--space-4)]"
      style={{ background: 'color-mix(in srgb, var(--color-archive) 72%, transparent)' }}
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-client-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-[var(--space-6)] py-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
              <UserPlus size={18} className="text-[var(--color-signal)]" aria-hidden />
            </div>
            <div>
              <h2 id="invite-client-title" className="m-0 font-display text-md font-semibold text-[var(--color-ink)]">
                Invite a client
              </h2>
              <p className="m-0 text-xs text-[var(--color-whisper)]">
                They receive a link to create their vault account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="btn-ghost h-8 w-8 p-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-[var(--space-6)] py-[var(--space-6)]">
          {result ? (
            <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-2)] text-center">
              <CheckCircle2 size={28} className="text-[var(--color-commit)]" aria-hidden />
              <div>
                <h3 className="m-0 mb-[var(--space-1)] font-display text-md font-semibold text-[var(--color-ink)]">
                  {result.emailSent ? 'Invite sent' : 'Invite created'}
                </h3>
                <p className="m-0 text-sm leading-relaxed text-[var(--color-whisper)]">
                  {result.emailSent ? (
                    <>
                      A signup link was sent to{' '}
                      <strong className="font-medium text-[var(--color-ink)]">{result.email}</strong>.
                    </>
                  ) : (
                    <>
                      Email delivery is not configured. Share this signup link with{' '}
                      <strong className="font-medium text-[var(--color-ink)]">{result.email}</strong>:
                    </>
                  )}
                </p>
                {result.signupUrl && !result.emailSent && (
                  <div className="mt-[var(--space-3)] w-full text-left">
                    <label className="mb-[var(--space-1)] block text-xs font-medium text-[var(--color-whisper)]" htmlFor="invite-signup-url">
                      Signup link
                    </label>
                    <textarea
                      id="invite-signup-url"
                      readOnly
                      rows={3}
                      className="w-full resize-none rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)] p-[var(--space-2)] text-xs text-[var(--color-ink)]"
                      value={result.signupUrl}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="btn-ghost mt-[var(--space-2)]"
                      onClick={() => navigator.clipboard?.writeText(result.signupUrl)}
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </div>
              <button type="button" onClick={handleClose} className="btn-ghost">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
              <FloatingLabel
                label="Client email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <p className="m-0 text-sm leading-relaxed text-[var(--color-whisper)]">
                They will set their own name and password from the invite link.
              </p>
              {error && (
                <div className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-3)]" role="alert">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
                  <p className="m-0 text-sm text-[var(--color-flag)]">{error}</p>
                </div>
              )}
              <button type="submit" disabled={!isValid || loading} className="btn-signal w-full">
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" aria-hidden /> Sending invite…</>
                ) : (
                  <><Send size={15} aria-hidden /> Send invite</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
