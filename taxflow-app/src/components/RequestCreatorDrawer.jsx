import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy } from 'lucide-react'
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col rounded-l-2xl border-l border-white/[0.07] bg-white/[0.05] shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <h2 className="text-lg font-bold tracking-tight text-white">
                New Document Request
              </h2>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.05] text-white/50 transition-colors duration-100 hover:bg-white/[0.1] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Clone Prior Year Section */}
            <div className="border-b border-white/[0.07] px-6 py-5">
              <p className="mb-3 text-xs font-medium tracking-wide text-white/40">
                Quick Setup
              </p>
              <button
                type="button"
                onClick={handleClone}
                className="clone-btn group relative w-full overflow-hidden rounded-xl p-[1px] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                {/* Animated gradient border */}
                <span className="clone-border absolute inset-0 rounded-xl" />
                {/* Inner content */}
                <span className="relative flex items-center justify-center gap-2.5 rounded-[11px] bg-[#0d1117] px-4 py-3 text-sm font-semibold text-white transition-shadow duration-200 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                  <Copy size={16} className="text-cyan-400" />
                  Clone 2024 Requests
                </span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
              {/* Document Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium tracking-wide text-white/50">
                  Document Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. W-2 Form"
                  className={`w-full rounded-xl border bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors duration-150 ${
                    errors.name
                      ? 'border-red-500'
                      : 'border-white/[0.07] focus:border-cyan-500/50'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium tracking-wide text-white/50">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe what the client needs to provide"
                  rows={3}
                  className={`w-full resize-none rounded-xl border bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors duration-150 ${
                    errors.description
                      ? 'border-red-500'
                      : 'border-white/[0.07] focus:border-cyan-500/50'
                  }`}
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-400">{errors.description}</p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-1.5 block text-xs font-medium tracking-wide text-white/50">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                  className={`w-full rounded-xl border bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition-colors duration-150 [color-scheme:dark] ${
                    errors.dueDate
                      ? 'border-red-500'
                      : 'border-white/[0.07] focus:border-cyan-500/50'
                  }`}
                />
                {errors.dueDate && (
                  <p className="mt-1 text-xs text-red-400">{errors.dueDate}</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-xs font-medium tracking-wide text-white/50">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="w-full rounded-xl border border-white/[0.07] bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition-colors duration-150 [color-scheme:dark] focus:border-cyan-500/50"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p} className="bg-gray-900 text-white">
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Submit button */}
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-100 hover:shadow-cyan-500/30 hover:brightness-110 active:scale-[0.98]"
              >
                Create Request
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
