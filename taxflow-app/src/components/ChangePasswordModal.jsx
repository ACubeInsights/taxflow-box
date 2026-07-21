import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { authApi } from '../services/api'
import FloatingLabel from './FloatingLabel'

const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }

export default function ChangePasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState(null)

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
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    setSuccess(false); setError(null); setLoading(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="changepw-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={handleClose}
        >
          <motion.div
            key="changepw-card"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={SPRING}
            className="w-full max-w-[420px] rounded-2xl border border-[var(--color-outline-variant)] overflow-hidden"
            style={{
              background: 'var(--color-surface-container)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-outline-variant)]">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-primary)]/30"
                  style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(99,102,241,0.08))' }}
                >
                  <KeyRound size={18} className="text-[var(--color-primary)]" />
                </div>
                <h2 className="m-0 text-[16px] font-bold text-[var(--color-on-surface)] tracking-tight">
                  Change Password
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] hover:border-[var(--color-outline)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {success ? (
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[var(--color-success-muted)] border border-[var(--color-success)]/30">
                    <CheckCircle2 size={28} className="text-[var(--color-success)]" />
                  </div>
                  <p className="m-0 text-[14px] font-bold text-[var(--color-on-surface)]">
                    Password changed successfully
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-highest)] transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <FloatingLabel
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <FloatingLabel
                    label="New Password (min 6 chars)"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <FloatingLabel
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />

                  {newPassword && confirmPassword && !passwordsMatch && (
                    <p className="m-0 text-[11px] text-[var(--color-error)] font-medium">Passwords do not match</p>
                  )}

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start gap-2 p-3 rounded-xl border border-[var(--color-error)]/25 bg-[var(--color-error-muted)]"
                      >
                        <AlertCircle size={15} className="text-[var(--color-error)] shrink-0 mt-0.5" />
                        <p className="m-0 text-[12px] text-[var(--color-error)] leading-relaxed">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={!isValid || loading}
                    className="w-full py-3.5 rounded-xl text-[14px] font-bold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: isValid
                        ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))'
                        : 'var(--color-surface-highest)',
                      color: isValid ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)',
                      boxShadow: isValid ? '0 2px 8px rgba(129,140,248,0.25)' : 'none',
                    }}
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> Updating...</>
                      : 'Update Password'
                    }
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
