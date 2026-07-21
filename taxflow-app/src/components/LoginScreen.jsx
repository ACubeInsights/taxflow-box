import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Lock, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import AnimatedBackground from './AnimatedBackground'
import FloatingLabel from './FloatingLabel'
import ForgotPasswordForm from './ForgotPasswordForm'
import DemoLoginSection from './DemoLoginSection'

export default function LoginScreen() {
  const { login, demoLogin, loginLoading, tokenError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [forgotMode, setForgotMode] = useState(false)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobile(mql.matches)
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message || 'Login failed')
    }
  }

  const displayError = error || tokenError

  return (
    <div className="relative w-screen h-screen flex items-center justify-center p-5 overflow-y-auto bg-[var(--color-surface-lowest)]">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Card */}
        <div
          className="rounded-2xl relative overflow-hidden noise-overlay"
          style={{
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            padding: isMobile ? '32px 24px' : '48px 40px 40px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset, 0 25px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* Top edge highlight */}
          <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--color-primary)]/30 to-transparent" />

          {/* Brand */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 border border-[var(--color-primary)]/20 glow-sm">
              <div
                className="w-full h-full rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(99,102,241,0.05))' }}
              >
                <Lock size={20} className="text-[var(--color-primary)]" strokeWidth={2} />
              </div>
            </div>
            <h1 className="m-0 text-[28px] font-bold text-[var(--color-on-surface)] leading-tight tracking-[-0.03em] font-display">
              Welcome back
            </h1>
            <p className="mt-2 text-[13px] text-[var(--color-on-surface-variant)] font-medium">
              Sign in to your TaxFlow Pro workspace
            </p>
          </motion.div>

          {/* Login form or Forgot Password form */}
          {forgotMode ? (
            <ForgotPasswordForm
              onBack={() => { setForgotMode(false); setError(null) }}
              initialEmail={email}
              displayError={displayError}
              setError={setError}
            />
          ) : (
          <>
          {/* Error display */}
          <AnimatePresence>
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-muted)]"
              >
                <AlertCircle size={15} className="text-[var(--color-error)] flex-shrink-0 mt-0.5" />
                <p className="m-0 text-[13px] text-[var(--color-error)] leading-relaxed font-medium">{displayError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="flex flex-col gap-3.5 mb-5">
              <FloatingLabel
                label="Email address"
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
            </div>

            <div className="flex items-center justify-end mb-5">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(null) }}
                className="bg-transparent border-none text-[12px] font-semibold text-[var(--color-on-surface-variant)] cursor-pointer p-0 hover:text-[var(--color-primary)] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loginLoading || !isFormValid}
              className="relative w-full h-12 rounded-xl text-[14px] font-semibold tracking-tight overflow-hidden cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
              style={{
                background: isFormValid
                  ? 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-container) 100%)'
                  : 'var(--color-surface-highest)',
                color: isFormValid ? '#09090b' : 'var(--color-on-surface-variant)',
                border: 'none',
                boxShadow: isFormValid
                  ? '0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 16px rgba(129, 140, 248, 0.3)'
                  : 'none',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loginLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </button>
          </motion.form>
          </>
          )}

          <DemoLoginSection demoLogin={demoLogin} isMobile={isMobile} />
        </div>

        {/* Footer text */}
        <motion.p
          className="text-center mt-6 text-[11px] text-[var(--color-on-surface-variant)]/50 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Protected by end-to-end encryption
        </motion.p>
      </motion.div>
    </div>
  )
}
