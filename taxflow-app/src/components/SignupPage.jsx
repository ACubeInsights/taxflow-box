import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { inviteApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import FloatingLabel from './FloatingLabel'
import { AuthSplit } from './LoginScreen'

function AuthMessage({ title, message, icon, action }) {
  return (
    <div className="text-center">
      <div className="mb-[var(--space-4)] flex justify-center">{icon}</div>
      <h2 className="m-0 font-display text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
      <p className="m-0 mt-[var(--space-3)] text-sm leading-relaxed text-[var(--color-whisper)]">
        {message}
      </p>
      {action}
    </div>
  )
}

export default function SignupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const token = searchParams.get('token')

  const [state, setState] = useState('loading')
  const [clientEmail, setClientEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [externalId, setExternalId] = useState('')
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }

    inviteApi.validateToken(token)
      .then((result) => {
        if (result.valid) {
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

    setServerError('')
    setState('submitting')

    try {
      await inviteApi.completeSignup(
        token,
        password,
        fullName.trim(),
        externalId.trim(),
        clientEmail.trim(),
      )
      await login(clientEmail.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.message || 'Could not create account'
      if (msg.includes('expired') || msg.includes('410')) setState('expired')
      else if (msg.includes('already exists')) {
        setServerError('An account with this email already exists. Sign in instead.')
        setState('valid')
      } else if (msg.includes('already') || msg.includes('409')) setState('used')
      else {
        setServerError(msg)
        setState('valid')
      }
    }
  }

  const shell = (body) => (
    <AuthSplit
      railTitle="Finish your vault invite"
      railBody="Your preparer invited you to upload tax documents into a secure Box vault."
      steps={['Open invite', 'Create password', 'Upload documents']}
    >
      {body}
    </AuthSplit>
  )

  if (state === 'loading') {
    return shell(
      <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-8)]">
        <Loader2 size={28} className="animate-spin text-[var(--color-signal)]" aria-hidden />
        <p className="m-0 text-sm text-[var(--color-whisper)]">Checking your invite…</p>
      </div>,
    )
  }

  if (state === 'expired') {
    return shell(
      <AuthMessage
        title="Invite expired"
        message="Ask your tax preparer to send a new invite link."
        icon={<AlertCircle size={32} className="text-[var(--color-hold)]" aria-hidden />}
      />,
    )
  }

  if (state === 'used') {
    return shell(
      <AuthMessage
        title="Account already created"
        message="This invite was already used. Sign in with the password you set."
        icon={<CheckCircle size={32} className="text-[var(--color-commit)]" aria-hidden />}
        action={
          <a href="/" className="btn-signal mt-[var(--space-6)] inline-flex no-underline">
            Sign in
          </a>
        }
      />,
    )
  }

  if (state === 'invalid') {
    return shell(
      <AuthMessage
        title="Invalid invite link"
        message="Check the link in your email, or ask your preparer for a new invite."
        icon={<AlertCircle size={32} className="text-[var(--color-flag)]" aria-hidden />}
      />,
    )
  }

  return shell(
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
      <div>
        <h2 className="m-0 font-display text-xl font-bold text-[var(--color-ink)]">
          Create your account
        </h2>
        <p className="m-0 mt-[var(--space-2)] text-sm text-[var(--color-whisper)]">
          You will land in your document vault after this step.
        </p>
      </div>

      <FloatingLabel
        label="Email"
        type="email"
        value={clientEmail}
        onChange={(e) => setClientEmail(e.target.value)}
        autoComplete="email"
      />
      <FloatingLabel
        label="Full name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
      />
      <FloatingLabel
        label="Company or external ID (optional)"
        type="text"
        value={externalId}
        onChange={(e) => setExternalId(e.target.value)}
      />
      <FloatingLabel
        label="Password (min 6 characters)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <FloatingLabel
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
      />

      {password.length > 0 && !passwordValid && (
        <p className="m-0 text-sm text-[var(--color-hold)]">Password must be at least 6 characters</p>
      )}
      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className="m-0 text-sm text-[var(--color-flag)]" role="alert">Passwords do not match</p>
      )}

      {serverError && (
        <div
          className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-3)]"
          role="alert"
        >
          <div className="flex items-start gap-[var(--space-2)]">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
            <p className="m-0 text-sm text-[var(--color-flag)]">{serverError}</p>
          </div>
          {serverError.includes('already exists') && (
            <a href="/" className="btn-ghost self-start no-underline">
              Sign in
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || state === 'submitting'}
        className="btn-signal w-full"
      >
        {state === 'submitting' ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Creating account…
          </>
        ) : (
          'Create account'
        )}
      </button>
    </form>,
  )
}
