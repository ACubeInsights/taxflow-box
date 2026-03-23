import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Plus } from 'lucide-react'
import { useDocumentWorkflow } from '../context/DocumentWorkflowContext'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const initialForm = {
  name: '',
  description: '',
  dueDate: '',
  priority: 'Medium',
}

export default function RequestCreatorDrawer({ isOpen, onClose }) {
  const { dispatch } = useDocumentWorkflow()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Document name is required'
    if (!form.description.trim()) next.description = 'Description is required'
    if (!form.dueDate) next.dueDate = 'Due date is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    dispatch({
      type: 'ADD_REQUEST',
      payload: {
        name: form.name.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
        priority: form.priority,
        clientId: 'client-1',
      },
    })
    setForm(initialForm)
    setErrors({})
    onClose()
  }

  function handleClone() {
    dispatch({ type: 'CLONE_PRIOR_YEAR', payload: { clientId: 'client-1' } })
    setForm(initialForm)
    setErrors({})
    onClose()
  }

  function handleClose() {
    setForm(initialForm)
    setErrors({})
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-[var(--color-surface)]/80 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Drawer panel */}
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
                <Plus size={20} className="text-[var(--color-primary)]" /> New Request
              </h2>
              <button
                onClick={handleClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] transition-all duration-200 hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-on-surface)] active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Clone Prior Year Section */}
              <div className="border-b border-[var(--color-outline-variant)] px-8 py-8 bg-gradient-to-b from-[var(--color-surface-container)]/30 to-transparent">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                    <Copy size={16} />
                  </div>
                  <div>
                    <h3 className="m-0 text-[14px] font-bold text-[var(--color-on-surface)]">Prior Year Data</h3>
                    <p className="m-0 text-[12px] text-[var(--color-on-surface-variant)] leading-tight mt-0.5">Save time by carrying over last year's requests.</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleClone}
                  className="w-full relative overflow-hidden rounded-[16px] p-[1px] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/40 via-[var(--color-tertiary)]/40 to-[var(--color-primary)]/40 rounded-[16px] animate-[shimmer_3s_linear_infinite] group-hover:from-[var(--color-primary)]/60 group-hover:via-[var(--color-tertiary)]/60 group-hover:to-[var(--color-primary)]/60" />
                  <span className="relative flex items-center justify-center gap-2 rounded-[15px] bg-[var(--color-surface-high)] px-4 py-3.5 text-[14px] font-bold text-[var(--color-on-surface)] transition-all duration-200 group-hover:bg-[var(--color-surface-container)] shadow-sm">
                    Clone 2024 Requests
                  </span>
                </button>
              </div>

              {/* Form */}
              <form id="request-form" onSubmit={handleSubmit} className="flex flex-col gap-6 px-8 py-8">
                 <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]/70 flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-on-surface-variant)]/50" />
                    Manual Entry
                 </h3>

                {/* Document Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                    Document Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g. W-2 Form, 1099-INT"
                    className={`w-full rounded-[14px] border bg-[var(--color-surface-container)]/50 px-4 py-3.5 text-[14px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-all duration-200 focus:bg-[var(--color-surface-container)] focus:shadow-[0_0_0_2px_rgba(var(--color-primary-rgb),0.2)] ${
                      errors.name
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-[var(--color-outline-variant)] focus:border-[var(--color-primary)]'
                    }`}
                  />
                  {errors.name && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="m-0 mt-1 text-[12px] font-medium text-red-400">{errors.name}</motion.p>
                  )}
                </div>

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Describe exactly what the client needs to provide..."
                    rows={4}
                    className={`w-full resize-none rounded-[14px] border bg-[var(--color-surface-container)]/50 px-4 py-3.5 text-[14px] font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 outline-none transition-all duration-200 focus:bg-[var(--color-surface-container)] focus:shadow-[0_0_0_2px_rgba(var(--color-primary-rgb),0.2)] ${
                      errors.description
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-[var(--color-outline-variant)] focus:border-[var(--color-primary)]'
                    }`}
                  />
                  {errors.description && (
                     <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="m-0 mt-1 text-[12px] font-medium text-red-400">{errors.description}</motion.p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5">
                   {/* Due Date */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                      Due Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => handleChange('dueDate', e.target.value)}
                      className={`w-full rounded-[14px] border bg-[var(--color-surface-container)]/50 px-4 py-3.5 text-[14px] font-medium text-[var(--color-on-surface)] outline-none transition-all duration-200 focus:bg-[var(--color-surface-container)] focus:shadow-[0_0_0_2px_rgba(var(--color-primary-rgb),0.2)] [color-scheme:dark] ${
                        errors.dueDate
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-[var(--color-outline-variant)] focus:border-[var(--color-primary)]'
                      }`}
                    />
                     {errors.dueDate && (
                         <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="m-0 mt-1 text-[12px] font-medium text-red-400">{errors.dueDate}</motion.p>
                      )}
                  </div>

                  {/* Priority */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-[var(--color-on-surface)] tracking-wide">
                      Priority
                    </label>
                    <div className="relative">
                       <select
                        value={form.priority}
                        onChange={(e) => handleChange('priority', e.target.value)}
                        className="w-full appearance-none rounded-[14px] border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)]/50 px-4 py-3.5 pr-10 text-[14px] font-medium text-[var(--color-on-surface)] outline-none transition-all duration-200 focus:bg-[var(--color-surface-container)] focus:border-[var(--color-primary)] focus:shadow-[0_0_0_2px_rgba(var(--color-primary-rgb),0.2)]"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p} className="bg-[var(--color-surface-high)] text-[var(--color-on-surface)]">
                            {p}
                          </option>
                        ))}
                      </select>
                      <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-[var(--color-on-surface-variant)]">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                           <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Visual padding at bottom */}
                <div className="h-8" />
              </form>
            </div>
            
            {/* Footer with sticky submit button */}
            <div className="border-t border-[var(--color-outline-variant)] p-6 bg-[var(--color-surface-high)]/95 backdrop-blur-md">
               <button
                  type="submit"
                  form="request-form"
                  className="w-full rounded-[14px] bg-[var(--color-on-surface)] text-[var(--color-surface-lowest)] px-4 py-4 text-[14px] font-bold tracking-wide transition-all duration-200 hover:bg-[var(--color-on-surface-variant)] active:scale-[0.98] shadow-lg flex justify-center items-center gap-2"
                >
                  <Plus size={18} />
                  Create Request
                </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
