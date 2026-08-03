import { useState } from 'react'
import { X, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { authApi } from '../services/api'
import FloatingLabel from './FloatingLabel'

export default function ChangePasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const passwordsMatch = newPassword === confirmPassword
  const isValid = currentPassword.trim() && newPassword.trim().length >= 6 && passwordsMatch

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Could not change password')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    setSuccess(false); setError(null); setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-[var(--space-4)]"
      style={{ background: 'color-mix(in srgb, var(--color-archive) 72%, transparent)' }}
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-[var(--space-6)] py-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
              <KeyRound size={18} className="text-[var(--color-signal)]" aria-hidden />
            </div>
            <h2 id="change-password-title" className="m-0 font-display text-md font-semibold text-[var(--color-ink)]">
              Change password
            </h2>
          </div>
          <button type="button" onClick={handleClose} className="btn-ghost h-8 w-8 p-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-[var(--space-6)] py-[var(--space-5)]">
          {success ? (
            <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-4)] text-center">
              <CheckCircle2 size={28} className="text-[var(--color-commit)]" aria-hidden />
              <p className="m-0 text-sm font-medium text-[var(--color-ink)]">Password changed</p>
              <button type="button" onClick={handleClose} className="btn-ghost">Done</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
              <FloatingLabel
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <FloatingLabel
                label="New password (min 12 characters, letter + number)"
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
                <p className="m-0 text-sm text-[var(--color-flag)]" role="alert">Passwords do not match</p>
              )}

              {error && (
                <div className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-3)]" role="alert">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
                  <p className="m-0 text-sm text-[var(--color-flag)]">{error}</p>
                </div>
              )}

              <button type="submit" disabled={!isValid || loading} className="btn-signal w-full">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Saving password…</>
                  : 'Save new password'
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
