import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const TOAST_STYLES = {
  success: {
    icon: CheckCircle,
    bg: 'var(--color-commit-muted)',
    border: 'var(--color-commit)',
    color: 'var(--color-commit)',
  },
  error: {
    icon: AlertCircle,
    bg: 'var(--color-flag-muted)',
    border: 'var(--color-flag)',
    color: 'var(--color-flag)',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'var(--color-hold-muted)',
    border: 'var(--color-hold)',
    color: 'var(--color-hold)',
  },
  info: {
    icon: Info,
    bg: 'var(--color-trace-muted)',
    border: 'var(--color-trace)',
    color: 'var(--color-trace)',
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
    setToasts(prev => [...prev, { id, type, message }].slice(-4))
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const success = useCallback((message, opts) => toast({ type: 'success', message, ...opts }), [toast])
  const error = useCallback((message, opts) => toast({ type: 'error', message, ...opts }), [toast])
  const warning = useCallback((message, opts) => toast({ type: 'warning', message, ...opts }), [toast])
  const info = useCallback((message, opts) => toast({ type: 'info', message, ...opts }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-[var(--space-6)] right-[var(--space-6)] z-[9999] flex flex-col items-end gap-[var(--space-2)]"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map(t => {
          const style = TOAST_STYLES[t.type] || TOAST_STYLES.info
          const Icon = style.icon
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex min-w-[260px] max-w-[360px] items-start gap-[var(--space-3)] rounded-[var(--radius-panel)] px-[var(--space-4)] py-[var(--space-3)]"
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
              }}
              role="status"
            >
              <Icon size={15} className="mt-0.5 shrink-0" style={{ color: style.color }} aria-hidden />
              <p className="m-0 flex-1 text-sm font-medium leading-snug text-[var(--color-ink)]">
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 cursor-pointer rounded-[var(--radius-chip)] border-none bg-transparent p-[var(--space-1)] text-[var(--color-whisper)] hover:text-[var(--color-ink)]"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
