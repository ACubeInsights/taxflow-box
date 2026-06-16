import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UserCog, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { employeeApi } from '../services/api'
import FloatingLabel from './FloatingLabel'

export default function AddEmployeeModal({ open, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const isValid = name.trim() && email.trim() && password.trim().length >= 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await employeeApi.createEmployee(name.trim(), email.trim(), 'employee', password)
      setResult(res)
    } catch (err) {
      setError(err.message || 'Failed to create employee')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setEmail('')
    setPassword('')
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
          className="w-full max-w-[440px] rounded-[24px] border border-[var(--color-outline-variant)] overflow-hidden"
          style={{ background: 'var(--color-surface-container)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-outline-variant)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-secondary)]/30" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))' }}>
                <UserCog size={18} className="text-[var(--color-secondary)]" />
              </div>
              <div>
                <h2 className="m-0 text-[16px] font-bold text-[var(--color-on-surface)] tracking-tight">Add Employee</h2>
                <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">Creates a new employee account</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:text-white hover:border-white/20 transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {result ? (
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="m-0 text-[16px] font-bold text-white mb-1">Employee Added</h3>
                  <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] leading-relaxed">
                    {result.name} ({result.login})
                    {result.isNew === false && ' — existing user linked'}
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-[var(--color-on-surface-variant)]">
                    Role: {result.role} · User ID: {result.userId}
                  </p>
                </div>
                <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)] leading-relaxed px-4">
                  This employee can now log in via the Staff Login tab using their email.
                </p>
                <button onClick={handleClose} className="mt-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-highest)] transition-colors cursor-pointer">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FloatingLabel label="Full Name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                <FloatingLabel label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <FloatingLabel label="Initial Password (min 6 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
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
                    background: isValid && !loading ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-container))' : 'var(--color-surface-highest)',
                    color: isValid && !loading ? 'var(--color-surface-lowest)' : 'var(--color-on-surface-variant)',
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? (<><Loader2 size={16} className="animate-spin" />Creating...</>) : (<><UserCog size={16} />Add Employee</>)}
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
