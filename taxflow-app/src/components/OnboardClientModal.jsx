import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { onboardingApi } from '../services/api'
import { useAuth } from '../context/AuthContext.jsx'
import FloatingLabel from './FloatingLabel'

export default function OnboardClientModal({ open, onClose, onSuccess }) {
  const { user } = useAuth()
  const isEmployee = user?.role === 'employee'

  const [clientName, setClientName] = useState('')
  const [externalId, setExternalId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [employeeEmail, setEmployeeEmail] = useState(isEmployee ? (user?.email || '') : '')
  const [financialYear, setFinancialYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const isValid = clientName.trim() && externalId.trim() && email.trim() && password.trim().length >= 6 && employeeEmail.trim()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await onboardingApi.onboardClient(
        clientName.trim(),
        externalId.trim(),
        email.trim(),
        employeeEmail.trim(),
        financialYear.trim() || undefined,
        password
      )
      setResult(res)
    } catch (err) {
      setError(err.message || 'Onboarding failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setClientName('')
    setExternalId('')
    setEmail('')
    setPassword('')
    setEmployeeEmail(isEmployee ? (user?.email || '') : '')
    setFinancialYear(new Date().getFullYear().toString())
    setResult(null)
    setError(null)
    setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="w-full max-w-[480px] rounded-[24px] border border-[var(--color-outline-variant)] overflow-hidden"
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
                style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.15), rgba(75,142,255,0.08))' }}
              >
                <UserPlus size={18} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="m-0 text-[16px] font-bold text-[var(--color-on-surface)] tracking-tight">
                  Onboard New Client
                </h2>
                <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">
                  Creates Box App User, folders, and permissions
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {result ? (
              <SuccessView result={result} onClose={handleClose} onSuccess={onSuccess} />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FloatingLabel
                  label="Client Name"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <FloatingLabel
                  label="External ID (e.g. CL-001)"
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
                <FloatingLabel
                  label="Client Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FloatingLabel
                  label="Client Password (min 6 chars)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FloatingLabel
                  label={isEmployee ? 'Assigned Employee (you)' : 'Assigned Employee Email'}
                  type="email"
                  value={employeeEmail}
                  onChange={(e) => !isEmployee && setEmployeeEmail(e.target.value)}
                  disabled={isEmployee}
                />
                <FloatingLabel
                  label="Financial Year"
                  type="text"
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                />

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10"
                    >
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="m-0 text-[12px] text-red-300 leading-relaxed">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full py-3.5 rounded-xl text-[14px] font-bold tracking-tight transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
                  style={{
                    background: isValid && !loading
                      ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))'
                      : 'var(--color-surface-highest)',
                    color: isValid && !loading ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)',
                    boxShadow: isValid && !loading
                      ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 30px rgba(173,198,255,0.2)'
                      : 'none',
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Onboard Client
                      </>
                    )}
                  </span>
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function SuccessView({ result, onClose, onSuccess }) {
  const appUser = result.appUser || {}
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30">
        <CheckCircle2 size={28} className="text-emerald-400" />
      </div>
      <div>
        <h3 className="m-0 text-[16px] font-bold text-white mb-1">Client Onboarded</h3>
        <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] leading-relaxed">
          {appUser.name || 'Client'} ({appUser.login || appUser.email || ''})
          {appUser.isNew === false && ' — existing user was linked'}
        </p>
      </div>
      <div className="w-full text-left p-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)]">
        <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] mb-2 font-semibold uppercase tracking-wider">Details</p>
        <div className="flex flex-col gap-1">
          <DetailRow label="App User ID" value={appUser.userId} />
          <DetailRow label="Root Folder" value={result.folders?.root} />
          <DetailRow label="Uploads Folder" value={result.folders?.uploads} />
          <DetailRow label="Webhook" value={result.webhookId || 'Not registered'} />
        </div>
      </div>
      <div className="flex gap-3 mt-2">
        {onSuccess && (
          <button
            onClick={() => onSuccess(result)}
            className="px-6 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-colors"
            style={{
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))',
              color: 'var(--color-surface-lowest)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 20px rgba(173,198,255,0.2)',
            }}
          >
            View Client
          </button>
        )}
        <button
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-highest)] transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-[var(--color-on-surface-variant)]">{label}</span>
      <span className="text-[11px] font-mono text-[var(--color-on-surface)] opacity-80">{value || '—'}</span>
    </div>
  )
}
