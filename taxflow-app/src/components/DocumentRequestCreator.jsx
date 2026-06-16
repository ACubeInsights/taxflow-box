import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { projectApi, documentTypeApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split('T')[0]
}

const initialForm = {
  clientId: '',
  projectId: '',
  documentTypeId: '',
  name: '',
  description: '',
  instructions: '',
  priority: 'Medium',
  dueDate: defaultDueDate(),
  isDraft: false,
}

export default function DocumentRequestCreator({
  isOpen,
  onClose,
  preselectedClientId = '',
  preselectedProjectId = '',
}) {
  const { user } = useAuth()
  const employeeId = user?.id || 'employee-1'
  const [form, setForm] = useState({ ...initialForm, clientId: preselectedClientId, projectId: preselectedProjectId })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dropdown data
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [docTypes, setDocTypes] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingDocTypes, setLoadingDocTypes] = useState(false)
  const [loadingTypeDetail, setLoadingTypeDetail] = useState(false)

  // Duplicate check
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setForm({ ...initialForm, clientId: preselectedClientId, projectId: preselectedProjectId })
      setErrors({})
      setSubmitError('')
      setDuplicateWarning(null)
      setAwaitingConfirm(false)
    }
  }, [isOpen, preselectedClientId, preselectedProjectId])

  // Fetch clients on mount
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      setLoadingClients(true)
      try {
        const data = await projectApi.getAllClients()
        if (!cancelled) setClients(Array.isArray(data) ? data : [])
      } catch { if (!cancelled) setClients([]) }
      finally { if (!cancelled) setLoadingClients(false) }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen])

  // Fetch projects when client changes
  useEffect(() => {
    if (!form.clientId) { setProjects([]); return }
    let cancelled = false
    const load = async () => {
      setLoadingProjects(true)
      try {
        const data = await projectApi.getClientProjects(form.clientId)
        if (!cancelled) setProjects(Array.isArray(data) ? data : [])
      } catch { if (!cancelled) setProjects([]) }
      finally { if (!cancelled) setLoadingProjects(false) }
    }
    load()
    return () => { cancelled = true }
  }, [form.clientId])

  // Fetch doc types when project changes
  useEffect(() => {
    if (!form.projectId) { setDocTypes([]); return }
    let cancelled = false
    const load = async () => {
      setLoadingDocTypes(true)
      try {
        const data = await documentTypeApi.getDocumentTypes()
        if (!cancelled) setDocTypes(Array.isArray(data) ? data : [])
      } catch { if (!cancelled) setDocTypes([]) }
      finally { if (!cancelled) setLoadingDocTypes(false) }
    }
    load()
    return () => { cancelled = true }
  }, [form.projectId])

  // Auto-fetch doc type detail
  useEffect(() => {
    if (!form.documentTypeId) return
    let cancelled = false
    const load = async () => {
      setLoadingTypeDetail(true)
      try {
        const detail = await documentTypeApi.getDocumentType(form.documentTypeId)
        if (!cancelled && detail) {
          setForm(prev => ({
            ...prev,
            name: detail.name || prev.name,
            description: detail.description || prev.description,
            instructions: detail.instructions || prev.instructions,
          }))
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingTypeDetail(false) }
    }
    load()
    return () => { cancelled = true }
  }, [form.documentTypeId])

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Reset cascading fields
      if (field === 'clientId') {
        next.projectId = ''
        next.documentTypeId = ''
        next.name = ''
        next.description = ''
        next.instructions = ''
      }
      if (field === 'projectId') {
        next.documentTypeId = ''
        next.name = ''
        next.description = ''
        next.instructions = ''
      }
      return next
    })
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    }
    setDuplicateWarning(null)
    setAwaitingConfirm(false)
  }

  const validate = () => {
    const next = {}
    if (!form.clientId) next.clientId = 'Client is required'
    if (!form.projectId) next.projectId = 'Project is required'
    if (!form.documentTypeId) next.documentTypeId = 'Document Type is required'
    if (!form.name?.trim()) next.name = 'Document Name is required'
    if (!form.dueDate) next.dueDate = 'Due Date is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const doSubmit = async (skipDuplicateCheck = false) => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      // Duplicate check
      if (!skipDuplicateCheck) {
        const dupResult = await projectApi.checkDuplicate(form.projectId, form.documentTypeId)
        if (dupResult?.isDuplicate) {
          setDuplicateWarning(dupResult.message || 'A request for this document type already exists.')
          setAwaitingConfirm(true)
          setSubmitting(false)
          return
        }
      }

      await projectApi.createDocumentRequest(form.projectId, {
        name: form.name.trim(),
        description: form.description.trim(),
        priority: form.priority,
        dueDate: form.dueDate,
        documentType: form.documentTypeId,
        isDraft: form.isDraft,
      })

      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Failed to create request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    doSubmit(false)
  }

  const handleConfirmDuplicate = () => {
    setDuplicateWarning(null)
    setAwaitingConfirm(false)
    doSubmit(true)
  }

  const handleClose = () => {
    setForm(initialForm)
    setErrors({})
    setSubmitError('')
    setDuplicateWarning(null)
    onClose()
  }

  const selectClass = (hasError) =>
    `w-full appearance-none rounded-[14px] border ${hasError ? 'border-red-500/50' : 'border-[var(--color-outline-variant)]'} bg-[var(--color-surface-container)]/50 px-4 py-3.5 pr-10 text-[14px] font-medium text-[var(--color-on-surface)] outline-none transition-all duration-200 focus:bg-[var(--color-surface-container)] focus:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed`

  const inputClass = (hasError) =>
    `w-full rounded-[14px] border ${hasError ? 'border-red-500/50' : 'border-[var(--color-outline-variant)]'} bg-[var(--color-surface-container)]/50 px-4 py-3.5 text-[14px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-all duration-200 focus:bg-[var(--color-surface-container)] focus:border-[var(--color-primary)]`

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-[var(--color-surface)]/80 backdrop-blur-md"
            onClick={handleClose}
          />

          <motion.div
            key="drawer"
            initial={{ x: '100%', opacity: 0, filter: 'blur(10px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: '100%', opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed top-0 right-0 z-[101] flex h-full w-full max-w-lg flex-col border-l border-[var(--color-outline-variant)] bg-[var(--color-surface-high)]/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-8 py-6 bg-[var(--color-surface)]/50 backdrop-blur-md sticky top-0 z-10">
              <h2 className="text-[20px] font-bold tracking-tight text-[var(--color-on-surface)] m-0 flex items-center gap-2">
                <Plus size={20} className="text-[var(--color-primary)]" /> New Document Request
              </h2>
              <button
                onClick={handleClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] transition-all duration-200 hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-on-surface)] active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <form id="doc-request-form" onSubmit={handleSubmit} className="flex flex-col gap-6 px-8 py-8">
                {/* Client dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                    Client <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.clientId}
                      onChange={e => handleChange('clientId', e.target.value)}
                      className={selectClass(errors.clientId)}
                      disabled={loadingClients}
                    >
                      <option value="">Select client...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {loadingClients && <Loader2 size={14} className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-white/30" />}
                  </div>
                  {errors.clientId && <p className="m-0 text-[12px] font-medium text-red-400">{errors.clientId}</p>}
                </div>

                {/* Project dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                    Project <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.projectId}
                      onChange={e => handleChange('projectId', e.target.value)}
                      className={selectClass(errors.projectId)}
                      disabled={!form.clientId || loadingProjects}
                    >
                      <option value="">Select project...</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {loadingProjects && <Loader2 size={14} className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-white/30" />}
                  </div>
                  {errors.projectId && <p className="m-0 text-[12px] font-medium text-red-400">{errors.projectId}</p>}
                </div>

                {/* Document Type dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                    Document Type <span className="text-red-400">*</span>
                    {loadingTypeDetail && <Loader2 size={12} className="inline ml-2 animate-spin text-white/30" />}
                  </label>
                  <div className="relative">
                    <select
                      value={form.documentTypeId}
                      onChange={e => handleChange('documentTypeId', e.target.value)}
                      className={selectClass(errors.documentTypeId)}
                      disabled={!form.projectId || loadingDocTypes}
                    >
                      <option value="">Select document type...</option>
                      {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                    </select>
                    {loadingDocTypes && <Loader2 size={14} className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-white/30" />}
                  </div>
                  {errors.documentTypeId && <p className="m-0 text-[12px] font-medium text-red-400">{errors.documentTypeId}</p>}
                </div>

                {/* Document Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                    Document Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="e.g. W-2 Form"
                    className={inputClass(errors.name)}
                  />
                  {errors.name && <p className="m-0 text-[12px] font-medium text-red-400">{errors.name}</p>}
                </div>

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => handleChange('description', e.target.value)}
                    placeholder="Describe what the client needs to provide..."
                    rows={3}
                    className={inputClass(false) + ' resize-none'}
                  />
                </div>

                {/* Instructions */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">Instructions</label>
                  <textarea
                    value={form.instructions}
                    onChange={e => handleChange('instructions', e.target.value)}
                    placeholder="Guidance for the client..."
                    rows={3}
                    className={inputClass(false) + ' resize-none'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* Priority */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">Priority</label>
                    <div className="relative">
                      <select
                        value={form.priority}
                        onChange={e => handleChange('priority', e.target.value)}
                        className={selectClass(false)}
                      >
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                      Due Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={e => handleChange('dueDate', e.target.value)}
                      className={inputClass(errors.dueDate) + ' [color-scheme:dark]'}
                    />
                    {errors.dueDate && <p className="m-0 text-[12px] font-medium text-red-400">{errors.dueDate}</p>}
                  </div>
                </div>

                {/* Draft vs Publish toggle */}
                <div className="flex items-center justify-between rounded-[14px] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/30 px-4 py-3">
                  <div>
                    <p className="m-0 text-[13px] font-bold text-[var(--color-on-surface)]">
                      {form.isDraft ? 'Save as Draft' : 'Publish'}
                    </p>
                    <p className="m-0 text-[11px] text-[var(--color-on-surface-variant)]">
                      {form.isDraft ? 'Client will not be notified' : 'Client will be notified'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, isDraft: !prev.isDraft }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.isDraft ? 'bg-white/[0.15]' : 'bg-[var(--color-primary)]/40'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                        form.isDraft
                          ? 'left-0.5 bg-white/40'
                          : 'left-[22px] bg-[var(--color-primary)]'
                      }`}
                    />
                  </button>
                </div>

                <div className="h-4" />
              </form>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--color-outline-variant)] p-6 bg-[var(--color-surface-high)]/95 backdrop-blur-md space-y-3">
              {/* Duplicate warning */}
              {duplicateWarning && (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                    <p className="m-0 text-[12px] font-medium text-yellow-300">{duplicateWarning}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmDuplicate}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-yellow-500/20 px-3 py-2 text-[12px] font-bold text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
                    >
                      Create anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDuplicateWarning(null); setAwaitingConfirm(false) }}
                      className="flex-1 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/50 border border-white/[0.1] hover:bg-white/[0.08] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                form="doc-request-form"
                disabled={submitting || awaitingConfirm}
                className="w-full rounded-[14px] bg-[var(--color-on-surface)] text-[var(--color-surface-lowest)] px-4 py-4 text-[14px] font-bold tracking-wide transition-all duration-200 hover:bg-[var(--color-on-surface-variant)] active:scale-[0.98] shadow-lg flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                {form.isDraft ? 'Save Draft' : 'Create & Publish'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
