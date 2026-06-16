import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Zap, Lock, AlertCircle, Loader2 } from 'lucide-react'
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
    <div className="relative w-screen h-screen flex items-center justify-center p-5 overflow-y-auto bg-[var(--color-surface-lowest)] font-sans">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 1 }}
        className="relative z-10 w-full max-w-[460px]"
      >
        <div
          className="rounded-[32px] bg-[var(--color-surface-container)]/40 backdrop-blur-[40px] border border-[var(--color-outline-variant)] relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
          style={{
            padding: isMobile ? '32px 24px 24px' : '44px 44px 36px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.8)',
          }}
        >
          {/* Top highlight */}
          <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-[var(--color-outline)] to-transparent opacity-50 rounded-full" />

          {/* Brand */}
          <div className="text-center mb-7">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] border border-[var(--color-primary)]/40 mb-5 shadow-[0_0_32px_var(--color-primary)]/30"
              style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.2), rgba(75,142,255,0.1))' }}
            >
              <Zap size={28} className="text-[var(--color-primary)]" strokeWidth={2.5} />
            </div>
            <h1 className="m-0 text-[32px] font-bold text-[var(--color-on-surface)] leading-tight tracking-[-0.04em] font-display">
              TaxFlow Pro
            </h1>
            <p className="mt-2 text-[10px] text-[var(--color-on-surface-variant)] tracking-[0.16em] font-bold uppercase">
              Powered by Box AI
            </p>
          </div>

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
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10"
              >
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="m-0 text-[12px] text-red-300 leading-relaxed">{displayError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login form */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 mb-4">
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

            <div className="flex items-center justify-between mb-4">
              <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] leading-relaxed">
                Sign in with your registered email and password.
              </p>
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(null) }}
                className="bg-transparent border-none text-[11px] font-semibold text-[var(--color-primary)] cursor-pointer p-0 whitespace-nowrap ml-3 hover:text-white transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loginLoading || !isFormValid}
              className="relative w-full py-4 rounded-xl text-[15px] font-bold tracking-tight text-[var(--color-surface-lowest)] transition-all duration-300 overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: !isFormValid
                  ? 'var(--color-surface-highest)'
                  : 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))',
                boxShadow: !isFormValid
                  ? 'none'
                  : 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 30px rgba(173,198,255,0.25)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loginLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </span>
            </button>
          </form>
          </>
          )}

          <DemoLoginSection demoLogin={demoLogin} isMobile={isMobile} />

        </div>
      </motion.div>
    </div>
  )
}
