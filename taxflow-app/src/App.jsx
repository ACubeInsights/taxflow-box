import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import LoginScreen from './components/LoginScreen'
import ResetPasswordPage from './components/ResetPasswordPage'
import SignupPage from './components/SignupPage'
import AppShell from './components/AppShell'
import './App.css'

function AppContent() {
  const { user, transitioning } = useAuth()
  const location = useLocation()

  if (location.pathname === '/reset-password') return <ResetPasswordPage />
  if (location.pathname === '/signup') return <SignupPage />

  return (
    <div
      style={{
        opacity: transitioning ? 0 : 1,
        transition: 'opacity var(--duration-standard) var(--ease-standard)',
        minHeight: '100vh',
      }}
    >
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          >
            <LoginScreen />
          </motion.div>
        ) : (
          <motion.div
            key="shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            style={{ minHeight: '100vh' }}
          >
            <AppShell />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
