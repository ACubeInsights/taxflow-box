import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const TOAST_STYLES = {
  success: {
    icon: CheckCircle,
    bg: 'var(--color-success-muted)',
    border: 'rgba(52,211,153,0.25)',
    color: 'var(--color-success)',
  },
  error: {
    icon: AlertCircle,
    bg: 'var(--color-error-muted)',
    border: 'rgba(251,113,133,0.25)',
    color: 'var(--color-error)',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'var(--color-warning-muted)',
    border: 'rgba(251,191,36,0.25)',
    color: 'var(--color-warning)',
  },
  info: {
    icon: Info,
    bg: 'var(--color-primary-muted)',
    border: 'rgba(129,140,248,0.25)',
    color: 'var(--color-primary)',
  },
}

let _nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const toast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = _nextId++
    setToasts(prev => {
      // Cap at 4 toasts — drop oldest
      const updated = [...prev, { id, type, message }]
      return updated.slice(-4)
    })
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Convenience wrappers
  const success = useCallback((message, opts) => toast({ type: 'success', message, ...opts }), [toast])
  const error   = useCallback((message, opts) => toast({ type: 'error',   message, ...opts }), [toast])
  const warning = useCallback((message, opts) => toast({ type: 'warning', message, ...opts }), [toast])
  const info    = useCallback((message, opts) => toast({ type: 'info',    message, ...opts }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}

      {/* Toast renderer — fixed bottom-right */}
      <div
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => {
            const style = TOAST_STYLES[t.type] || TOAST_STYLES.info
            const Icon = style.icon
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0,  scale: 1 }}
                exit={{   opacity: 0, y: 8,   scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="pointer-events-auto flex items-start gap-3 max-w-[360px] min-w-[260px] rounded-xl px-4 py-3 shadow-floating"
                style={{
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  backdropFilter: 'blur(16px)',
                }}
              >
                <Icon size={15} className="shrink-0 mt-0.5" style={{ color: style.color }} />
                <p className="m-0 flex-1 text-[13px] font-medium leading-snug" style={{ color: 'var(--color-on-surface)' }}>
                  {t.message}
                </p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 bg-transparent border-none cursor-pointer p-0.5 rounded-md text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
