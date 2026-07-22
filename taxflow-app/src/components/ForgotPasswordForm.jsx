import { useState } from 'react'
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { authApi } from '../services/api'
import FloatingLabel from './FloatingLabel'

/**
 * Forgot-password form — lives inside the auth split panel.
 */
export default function ForgotPasswordForm({ onBack, initialEmail = '', displayError, setError }) {
  const [forgotEmail, setForgotEmail] = useState(initialEmail)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!forgotEmail.trim() || forgotLoading) return
    setForgotLoading(true)
    setError(null)
    try {
      await authApi.forgotPassword(forgotEmail.trim())
      setForgotSent(true)
    } catch (err) {
      setError(err.message || 'Could not send reset link')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-[var(--space-6)] flex cursor-pointer items-center gap-[var(--space-2)] border-none bg-transparent p-0 text-sm font-medium text-[var(--color-trace)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={14} aria-hidden />
        Back to sign in
      </button>

      {forgotSent ? (
        <div>
          <h2 className="m-0 mb-[var(--space-2)] font-display text-lg font-semibold text-[var(--color-ink)]">
            Reset link sent
          </h2>
          <p className="m-0 text-sm text-[var(--color-whisper)] leading-relaxed">
            If an account exists for <span className="text-[var(--color-ink)]">{forgotEmail}</span>,
            we sent a reset link. It expires in 15 minutes — check inbox and spam.
          </p>
        </div>
      ) : (
        <form onSubmit={handleForgotPassword} className="flex flex-col gap-[var(--space-4)]">
          <div>
            <h2 className="m-0 mb-[var(--space-2)] font-display text-lg font-semibold text-[var(--color-ink)]">
              Reset your password
            </h2>
            <p className="m-0 text-sm text-[var(--color-whisper)] leading-relaxed">
              Enter the email on your TaxFlow account. We will send a one-time reset link.
            </p>
          </div>

          <FloatingLabel
            label="Email"
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            autoComplete="email"
          />

          {displayError && (
            <div
              className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]"
              role="alert"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
              <p className="m-0 text-sm text-[var(--color-flag)]">{displayError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!forgotEmail.trim() || forgotLoading}
            className="btn-signal w-full"
          >
            {forgotLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Sending reset link…
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
