import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Loader2, Check, X, Users } from 'lucide-react'
import { FolioPanel as GlassPanel } from '../../ui'
import { collaborationApi } from '../../../services/api'
import EmptyState from '../../EmptyState'
import { SkeletonRow } from '../../Skeleton'


/* ── Team Tab (Collaborators) ── */
export function TeamTab({ clientId }) {
  const [collabs, setCollabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)
  const [employees, setEmployees] = useState([])
  const [pendingRemove, setPendingRemove] = useState(null) // employeeId
  const [removeError, setRemoveError] = useState(null)

  const fetchCollabs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await collaborationApi.listCollaborators(clientId)
      setCollabs(data.collaborators || [])
    } catch (err) {
      setError(err.message || 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchCollabs() }, [fetchCollabs])

  // Fetch employees for the add dropdown
  useEffect(() => {
    const fetchEmps = async () => {
      try {
        const { employeeApi } = await import('../../../services/api')
        const data = await employeeApi.listEmployees()
        setEmployees(Array.isArray(data) ? data : data.employees || [])
      } catch { /* ignore */ }
    }
    fetchEmps()
  }, [])

  const handleAdd = async (employeeId) => {
    setAddLoading(true)
    setAddError(null)
    try {
      await collaborationApi.addCollaborator(clientId, employeeId)
      setAdding(false)
      fetchCollabs()
    } catch (err) {
      setAddError(err.message || 'Failed to add collaborator')
    } finally {
      setAddLoading(false)
    }
  }

  const handleRemove = async (employeeId) => {
    setRemoveError(null)
    try {
      await collaborationApi.removeCollaborator(clientId, employeeId)
      setPendingRemove(null)
      fetchCollabs()
    } catch (err) {
      setRemoveError(err.message || 'Failed to remove collaborator')
      setPendingRemove(null)
    }
  }

  if (loading) {
    return (
      <GlassPanel>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="m-0 text-[14px] font-bold text-[var(--color-on-surface)]">Team Access</h3>
          <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">Employees with Box Editor access to this client's vault</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="h-8 px-4 rounded-xl flex items-center gap-1.5 text-[12px] font-bold cursor-pointer transition-all border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
        >
          <Users size={13} /> Add Member
        </button>
      </div>

      {/* Add collaborator form */}
      {adding && (
        <div className="mb-4 p-4 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-high)]">
          <p className="m-0 mb-3 text-[12px] font-semibold text-[var(--color-on-surface)]">Select employee to add:</p>
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
            {employees
              .filter(emp => !collabs.some(c => c.employeeId === emp.id))
              .map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleAdd(emp.id)}
                  disabled={addLoading}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer transition-all bg-transparent border border-[var(--color-outline-variant)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30 disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-[10px] font-bold text-[var(--color-primary)]">
                    {(emp.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[12px] font-semibold text-[var(--color-on-surface)] truncate">{emp.name}</p>
                    <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)]">{emp.email}</p>
                  </div>
                </button>
              ))}
          </div>
          {addError && <p className="m-0 mt-2 text-[11px] text-[var(--color-error)]">{addError}</p>}
          <button
            onClick={() => { setAdding(false); setAddError(null) }}
            className="mt-3 text-[11px] font-semibold text-[var(--color-on-surface-variant)] cursor-pointer bg-transparent border-none hover:text-[var(--color-on-surface)]"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-muted)]">
          <p className="m-0 text-[12px] text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {removeError && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-muted)]">
          <p className="m-0 text-[12px] text-[var(--color-error)]">{removeError}</p>
        </div>
      )}

      {/* Collaborator list */}
      {collabs.length === 0 && !adding ? (
        <EmptyState
          icon={Users}
          title="No team members assigned"
          subtitle="Add employees to give them editing access to this client's documents."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {collabs.map(collab => (
            <div key={collab.collaborationId} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-high)] border border-[var(--color-outline-variant)] group">
              <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center text-[11px] font-bold text-[var(--color-primary)] shrink-0">
                {(collab.employeeName || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[13px] font-semibold text-[var(--color-on-surface)] truncate">{collab.employeeName}</p>
                <p className="m-0 text-[10px] text-[var(--color-on-surface-variant)]">{collab.boxEmail} · {collab.role}</p>
              </div>
              {pendingRemove === collab.employeeId ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRemove(collab.employeeId)}
                    className="h-7 px-2 rounded-md text-[10px] font-bold bg-[var(--color-error-muted)] border border-[var(--color-error)]/30 text-[var(--color-error)] cursor-pointer hover:bg-[var(--color-error)]/20 transition-colors"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setPendingRemove(null)}
                    className="h-7 px-2 rounded-md text-[10px] font-bold bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer hover:bg-[var(--color-surface-highest)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPendingRemove(collab.employeeId)}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] cursor-pointer opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--color-error-muted)] hover:border-[var(--color-error)]/30 hover:text-[var(--color-error)]"
                  title="Remove access"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  )
}


