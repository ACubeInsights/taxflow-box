import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

  const isValid = currentPassword.trim() && newPassword.trim().length >= 6 && newPassword === confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
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
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSuccess(false)
    setError(null)
    setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-[420px] rounded-[24px] border border-[var(--color-outline-variant)] overflow-hidden"
          style={{ background: 'var(--color-surface-container)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-outline-variant)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-primary)]/30" style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.15), rgba(75,142,255,0.08))' }}>
                <KeyRound size={18} className="text-[var(--color-primary)]" />
              </div>
              <h2 className="m-0 text-[16px] font-bold text-[var(--color-on-surface)] tracking-tight">Change Password</h2>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:text-white cursor-pointer"><X size={16} /></button>
          </div>

          <div className="px-6 py-5">
            {success ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <p className="m-0 text-[14px] font-bold text-white">Password changed successfully</p>
                <button onClick={handleClose} className="px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] cursor-pointer">Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FloatingLabel label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                <FloatingLabel label="New Password (min 6 chars)" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <FloatingLabel label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="m-0 text-[11px] text-red-400">Passwords do not match</p>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="m-0 text-[12px] text-red-300">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={!isValid || loading}
                  className="w-full py-3.5 rounded-xl text-[14px] font-bold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: isValid ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))' : 'var(--color-surface-highest)', color: isValid ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)' }}
                >
                  {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Updating...</span> : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
