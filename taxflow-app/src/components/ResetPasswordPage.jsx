import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Zap, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { authApi } from '../services/api'
import AnimatedBackground from './AnimatedBackground'
import FloatingLabel from './FloatingLabel'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const isValid = newPassword.length >= 6 && newPassword === confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    try {
      await authApi.resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="relative w-screen h-screen flex items-center justify-center p-5 bg-[var(--color-surface-lowest)] font-sans">
        <AnimatedBackground />
        <div className="relative z-10 text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-300 text-lg font-bold">Invalid reset link</p>
          <p className="text-[var(--color-on-surface-variant)] text-sm mt-2">This link is missing the reset token.</p>
          <button onClick={() => navigate('/')} className="mt-6 px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] cursor-pointer">
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-screen h-screen flex items-center justify-center p-5 overflow-y-auto bg-[var(--color-surface-lowest)] font-sans">
      <AnimatedBackground />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="rounded-[32px] bg-[var(--color-surface-container)]/40 backdrop-blur-[40px] border border-[var(--color-outline-variant)] relative overflow-hidden" style={{ padding: '44px 44px 36px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.8)' }}>
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] border border-[var(--color-primary)]/40 mb-5" style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.2), rgba(75,142,255,0.1))' }}>
              <Zap size={28} className="text-[var(--color-primary)]" strokeWidth={2.5} />
            </div>
            <h1 className="m-0 text-[24px] font-bold text-[var(--color-on-surface)] tracking-tight">Reset Password</h1>
            <p className="mt-2 text-[12px] text-[var(--color-on-surface-variant)]">Enter your new password below</p>
          </div>

          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
              <p className="text-[16px] font-bold text-white mb-2">Password reset successful</p>
              <p className="text-[12px] text-[var(--color-on-surface-variant)] mb-6">You can now log in with your new password.</p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3.5 rounded-xl text-[14px] font-bold border-none cursor-pointer"
                style={{ background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))', color: 'var(--color-surface-lowest)' }}
              >
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FloatingLabel label="New Password (min 6 chars)" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <FloatingLabel label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="m-0 text-[11px] text-red-400">Passwords do not match</p>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="m-0 text-[12px] text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!isValid || loading}
                className="w-full py-3.5 rounded-xl text-[14px] font-bold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: isValid ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))' : 'var(--color-surface-highest)', color: isValid ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)' }}
              >
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Resetting...</span> : 'Reset Password'}
              </button>
            </form>
          )}

        </div>
      </motion.div>
    </div>
  )
}
