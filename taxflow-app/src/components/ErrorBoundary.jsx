import { Component } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * Root ErrorBoundary — catches any unhandled JS errors in the component tree
 * and renders a recovery screen instead of a blank page.
 *
 * Usage: wrap the root of the app in <ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // In production, you would send this to an error reporting service here
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isDev = import.meta.env.DEV
    const message = this.state.error?.message || 'An unexpected error occurred.'

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-surface-lowest)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[480px] rounded-2xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] p-8 text-center shadow-floating"
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-error-muted)] border border-[var(--color-error)]/20 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={24} className="text-[var(--color-error)]" />
          </div>

          {/* Heading */}
          <h1 className="m-0 text-[20px] font-bold text-[var(--color-on-surface)] tracking-tight font-display mb-2">
            Something went wrong
          </h1>
          <p className="m-0 text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed mb-6">
            {message}
          </p>

          {/* Dev-only stack trace */}
          {isDev && this.state.errorInfo && (
            <details className="mb-6 text-left">
              <summary className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-on-surface-variant)]/60 cursor-pointer mb-2">
                Stack trace
              </summary>
              <pre className="text-[10px] text-[var(--color-on-surface-variant)]/70 bg-[var(--color-surface-high)] rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer bg-[var(--color-primary)] text-[var(--color-surface-lowest)] border-none hover:brightness-110 transition-all active:scale-95 shadow-[0_2px_8px_rgba(129,140,248,0.25)]"
            >
              <RefreshCw size={14} strokeWidth={2.5} />
              Try again
            </button>
            <button
              onClick={() => { this.handleReset(); window.location.href = '/' }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer bg-transparent border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)] hover:text-[var(--color-on-surface)] transition-all"
            >
              <Home size={14} />
              Go home
            </button>
          </div>
        </motion.div>
      </div>
    )
  }
}
