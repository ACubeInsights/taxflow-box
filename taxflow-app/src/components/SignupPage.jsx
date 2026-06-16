import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, AlertCircle, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { inviteApi, setAuthToken } from '../services/api'
import { useAuth } from '../context/AuthContext'
import AnimatedBackground from './AnimatedBackground'

export default function SignupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const token = searchParams.get('token')

  const [state, setState] = useState('loading') // loading | valid | expired | used | invalid | submitting | error
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [externalId, setExternalId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [serverError, setServerError] = useState('')

  // If already logged in, redirect
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }

    inviteApi.validateToken(token)
      .then((result) => {
        if (result.valid) {
          setClientName(result.clientName || '')
          setClientEmail(result.email || '')
          setState('valid')
        } else {
          setState('invalid')
        }
      })
      .catch((err) => {
        const msg = err.message || ''
        if (msg.includes('expired') || msg.includes('410')) setState('expired')
        else if (msg.includes('already') || msg.includes('409')) setState('used')
        else setState('invalid')
      })
  }, [token])

  const passwordValid = password.length >= 6
  const passwordsMatch = password === confirmPassword
  const nameValid = fullName.trim().length > 0
  const emailValid = clientEmail.trim().length > 0 && clientEmail.includes('@')
  const canSubmit = passwordValid && passwordsMatch && nameValid && emailValid && state === 'valid'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setValidationError('')
    setServerError('')
    setState('submitting')

    try {
      const result = await inviteApi.completeSignup(token, password, fullName.trim(), externalId.trim(), clientEmail.trim())

      // Set auth state (mirrors login flow)
      setAuthToken(result.sessionToken)
      const userData = { ...result.user, vault: result.vault || null, externalId: result.user.externalId || null }

      // Store session in sessionStorage (same as AuthContext.login)
      sessionStorage.setItem('taxflow_session', JSON.stringify({
        user: userData,
        token: result.sessionToken,
        tokenExpiresAt: result.expiresAt,
      }))

      // Force reload to let AuthProvider pick up the new session
      window.location.href = '/dashboard'
    } catch (err) {
      const msg = err.message || 'Signup failed'
      if (msg.includes('expired') || msg.includes('410')) setState('expired')
      else if (msg.includes('already exists')) {
        setServerError('An account with this email already exists. Please log in instead.')
        setState('valid')
      }
      else if (msg.includes('already') || msg.includes('409')) setState('used')
      else {
        setServerError(msg)
        setState('valid') // Allow retry
      }
    }
  }

  // Error states
  if (state === 'loading') {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
          <p className="text-[var(--color-on-surface-variant)] text-sm">Validating your invitation...</p>
        </div>
      </PageWrapper>
    )
  }

  if (state === 'expired') {
    return (
      <PageWrapper>
        <ErrorCard
          title="Invitation Expired"
          message="This invitation link has expired. Please contact your tax preparer for a new invitation."
          icon={<AlertCircle size={32} className="text-amber-400" />}
        />
      </PageWrapper>
    )
  }

  if (state === 'used') {
    return (
      <PageWrapper>
        <ErrorCard
          title="Account Already Created"
          message="This invitation has already been used. Your account is ready — head to the login page."
          icon={<CheckCircle size={32} className="text-emerald-400" />}
          action={<a href="/" className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold no-underline bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/25 text-[var(--color-primary)]">Go to Login</a>}
        />
      </PageWrapper>
    )
  }

  if (state === 'invalid') {
    return (
      <PageWrapper>
        <ErrorCard
          title="Invalid Link"
          message="This invitation link is invalid or malformed. Please check the link in your email or contact your tax preparer."
          icon={<AlertCircle size={32} className="text-red-400" />}
        />
      </PageWrapper>
    )
  }

  // Valid state — show signup form
  return (
    <PageWrapper>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] rounded-[24px] border border-[var(--color-outline-variant)] overflow-hidden"
        style={{ background: 'var(--color-surface-container)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
      >
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30">
            <Lock size={24} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="m-0 text-[22px] font-bold text-[var(--color-on-surface)]">Welcome to TaxFlow Pro</h1>
          <p className="m-0 mt-2 text-[13px] text-[var(--color-on-surface-variant)]">
            Complete your account setup to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 flex flex-col gap-4">
          {/* Email (prefilled from invite, editable) */}
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] text-[14px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-primary)] transition-colors"
          />

          {/* Full Name */}
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] text-[14px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-primary)] transition-colors"
          />

          {/* External ID (optional) */}
          <input
            type="text"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="Company / External ID (optional)"
            className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] text-[14px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-primary)] transition-colors"
          />

          {/* Password field */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setValidationError('') }}
              placeholder="Password (min 6 characters)"
              className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] text-[14px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-primary)] transition-colors pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--color-on-surface-variant)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Confirm password */}
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setValidationError('') }}
            placeholder="Confirm password"
            className="w-full px-4 py-3.5 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)] text-[14px] text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none focus:border-[var(--color-primary)] transition-colors"
          />

          {/* Validation hints */}
          {password.length > 0 && password.length < 6 && (
            <p className="m-0 text-[11px] text-amber-400">Password must be at least 6 characters</p>
          )}
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="m-0 text-[11px] text-red-400">Passwords do not match</p>
          )}

          {/* Server error */}
          {serverError && (
            <div className="flex flex-col gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="m-0 text-[12px] text-red-300">{serverError}</p>
              </div>
              {serverError.includes('already exists') && (
                <a
                  href="/"
                  className="self-start ml-6 inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[12px] font-semibold no-underline bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/25 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/25 transition-colors"
                >
                  Go to Login
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || state === 'submitting'}
            className="w-full py-3.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
            style={{
              background: canSubmit ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))' : 'var(--color-surface-highest)',
              color: canSubmit ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)',
            }}
          >
            {state === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Setting up your account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </motion.div>
    </PageWrapper>
  )
}

function PageWrapper({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'var(--color-surface-lowest)' }}>
      <AnimatedBackground />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function ErrorCard({ title, message, icon, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-[400px] rounded-[24px] border border-[var(--color-outline-variant)] p-8 text-center"
      style={{ background: 'var(--color-surface-container)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
    >
      <div className="mb-4">{icon}</div>
      <h2 className="m-0 text-[18px] font-bold text-[var(--color-on-surface)]">{title}</h2>
      <p className="m-0 mt-3 text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed">{message}</p>
      {action}
    </motion.div>
  )
}
