import { useState } from 'react'
import { X, UserCog, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { employeeApi, collaborationApi } from '../services/api'
import FloatingLabel from './FloatingLabel'

export default function AddEmployeeModal({ open, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [boxEmail, setBoxEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [boxWarn, setBoxWarn] = useState(null)

  const isValid = name.trim() && email.trim() && password.trim().length >= 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setBoxWarn(null)
    try {
      const res = await employeeApi.createEmployee(name.trim(), email.trim(), 'employee', password)
      if (boxEmail.trim() && res.dbUserId) {
        try {
          await collaborationApi.setBoxEmail(res.dbUserId, boxEmail.trim())
        } catch (boxErr) {
          setBoxWarn(boxErr.message || 'Preparer added, but Box email could not be saved')
        }
      }
      setResult(res)
    } catch (err) {
      setError(err.message || 'Could not add preparer')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName(''); setEmail(''); setPassword(''); setBoxEmail('')
    setResult(null); setError(null); setBoxWarn(null); setLoading(false)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-[var(--space-4)]"
      style={{ background: 'color-mix(in srgb, var(--color-archive) 72%, transparent)' }}
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-rule)] bg-[var(--color-folio)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-preparer-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-[var(--space-6)] py-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-rule)] bg-[var(--color-ledger)]">
              <UserCog size={18} className="text-[var(--color-trace)]" aria-hidden />
            </div>
            <div>
              <h2 id="add-preparer-title" className="m-0 font-display text-md font-semibold text-[var(--color-ink)]">
                Add preparer
              </h2>
              <p className="m-0 text-xs text-[var(--color-whisper)]">Creates a login for a tax preparer</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="btn-ghost h-8 w-8 p-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-[var(--space-6)] py-[var(--space-5)]">
          {result ? (
            <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-2)] text-center">
              <CheckCircle2 size={28} className="text-[var(--color-commit)]" aria-hidden />
              <div>
                <h3 className="m-0 mb-[var(--space-1)] font-display text-md font-semibold text-[var(--color-ink)]">
                  Preparer added
                </h3>
                <p className="m-0 text-sm text-[var(--color-whisper)]">
                  {result.name} ({result.login}) can sign in with the password you set.
                </p>
                {boxWarn && (
                  <p className="m-0 mt-[var(--space-2)] text-sm text-[var(--color-hold)]">{boxWarn}</p>
                )}
              </div>
              <button type="button" onClick={handleClose} className="btn-ghost">Done</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)]">
              <FloatingLabel label="Full name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              <FloatingLabel label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <FloatingLabel label="Initial password (min 6 characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

              <div className="border-t border-[var(--color-rule)] pt-[var(--space-4)]">
                <p className="label-caps m-0 mb-[var(--space-2)]">Box editing (optional)</p>
                <FloatingLabel
                  label="Box login email"
                  type="email"
                  value={boxEmail}
                  onChange={(e) => setBoxEmail(e.target.value)}
                />
                <p className="m-0 mt-[var(--space-2)] text-xs leading-relaxed text-[var(--color-whisper)]">
                  Needed if this preparer will edit documents inside Box.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-control)] border border-[var(--color-flag)] bg-[var(--color-flag-muted)] p-[var(--space-3)]" role="alert">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--color-flag)]" aria-hidden />
                  <p className="m-0 text-sm text-[var(--color-flag)]">{error}</p>
                </div>
              )}

              <button type="submit" disabled={!isValid || loading} className="btn-signal w-full">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Adding preparer…</>
                  : <><UserCog size={16} aria-hidden /> Add preparer</>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
