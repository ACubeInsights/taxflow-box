import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { authApi } from '../services/api'
import FloatingLabel from './FloatingLabel'

/**
 * ForgotPasswordForm — handles the forgot-password flow UI including
 * email input, submission, and confirmation message.
 *
 * @param {{ onBack: () => void, initialEmail?: string, displayError: string|null, setError: (err: string|null) => void }} props
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
      setError(err.message || 'Failed to send reset email')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 mb-4 bg-transparent border-none text-[12px] font-semibold text-[var(--color-primary)] cursor-pointer p-0"
      >
        <ArrowLeft size={14} /> Back to login
      </button>

      {forgotSent ? (
        <div className="text-center py-4">
          <p className="m-0 text-[14px] font-bold text-white mb-2">Check your email</p>
          <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] leading-relaxed">
            If an account exists for {forgotEmail}, we've sent a password reset link. Check your inbox and spam folder.
          </p>
          <p className="m-0 mt-3 text-[11px] text-[var(--color-on-surface-variant)]">
            The reset link expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={handleForgotPassword}>
          <p className="m-0 mb-4 text-[12px] text-[var(--color-on-surface-variant)] leading-relaxed">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          <div className="mb-4">
            <FloatingLabel label="Email address" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoComplete="email" />
          </div>

          <AnimatePresence>
            {displayError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="m-0 text-[12px] text-red-300 leading-relaxed">{displayError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={!forgotEmail.trim() || forgotLoading}
            className="w-full py-4 rounded-xl text-[15px] font-bold tracking-tight transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
            style={{
              background: forgotEmail.trim() ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))' : 'var(--color-surface-highest)',
              color: forgotEmail.trim() ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)',
            }}
          >
            {forgotLoading ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />Sending...</span> : 'Send Reset Link'}
          </button>
        </form>
      )}
    </div>
  )
}
