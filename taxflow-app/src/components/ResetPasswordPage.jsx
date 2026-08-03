import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { authApi } from '../services/api'
import FloatingLabel from './FloatingLabel'
import { AuthSplit } from './LoginScreen'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const passwordsMatch = newPassword === confirmPassword
  const isValid = newPassword.length >= 12 && passwordsMatch

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await authApi.resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthSplit
        railTitle="Reset link incomplete"
        railBody="This page needs a valid reset token from your email."
        steps={[]}
      >
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-[var(--space-4)] text-[var(--color-flag)]" aria-hidden />
          <h2 className="m-0 mb-[var(--space-2)] font-display text-lg font-semibold text-[var(--color-ink)]">
            Invalid reset link
          </h2>
          <p className="m-0 mb-[var(--space-6)] text-sm text-[var(--color-whisper)]">
            The link is missing its reset token. Request a new one from sign in.
          </p>
          <button type="button" onClick={() => navigate('/')} className="btn-signal w-full">
            Back to sign in
          </button>
        </div>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit
      railTitle="Choose a new password"
      railBody="After you save it, sign in with your email and this password."
      steps={[]}
    >
      {success ? (
        <div className="text-center">
          <CheckCircle2 size={32} className="mx-auto mb-[var(--space-4)] text-[var(--color-commit)]" aria-hidden />
          <h2 className="m-0 mb-[var(--space-2)] font-display text-lg font-semibold text-[var(--color-ink)]">
            Password reset
          </h2>
          <p className="m-0 mb-[var(--space-6)] text-sm text-[var(--color-whisper)]">
            Your password was updated. Sign in with the new one.
          </p>
          <button type="button" onClick={() => navigate('/')} className="btn-signal w-full">
            Sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
          <div>
            <h2 className="m-0 font-display text-xl font-bold text-[var(--color-ink)]">
              Reset password
            </h2>
            <p className="m-0 mt-[var(--space-2)] text-sm text-[var(--color-whisper)]">
              Use at least 12 characters with a letter and a number.
            </p>
          </div>

          <FloatingLabel
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <FloatingLabel
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          {newPassword && confirmPassword && !passwordsMatch && (
            <p className="m-0 text-sm text-[var(--color-flag)]" role="alert">
              Passwords do not match
            </p>
          )}

          {error && (
            <div
              className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] px-[var(--space-4)] py-[var(--space-3)]"
              role="alert"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
              <p className="m-0 text-sm text-[var(--color-flag)]">{error}</p>
            </div>
          )}

          <button type="submit" disabled={!isValid || loading} className="btn-signal w-full">
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Saving password…
              </>
            ) : (
              'Save new password'
            )}
          </button>
        </form>
      )}
    </AuthSplit>
  )
}
