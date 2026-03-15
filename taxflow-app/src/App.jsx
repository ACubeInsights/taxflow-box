import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DocumentWorkflowProvider } from './context/DocumentWorkflowContext'
import LoginScreen from './components/LoginScreen'
import AppShell from './components/AppShell'
import './App.css'

function AppContent() {
  const { user, transitioning } = useAuth()

  return (
    <div
      style={{
        opacity: transitioning ? 0 : 1,
        transition: 'opacity 0.3s ease',
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
            transition={{ duration: 0.3 }}
          >
            <LoginScreen />
          </motion.div>
        ) : (
          <motion.div
            key="shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
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
    <AuthProvider>
      <DocumentWorkflowProvider>
        <AppContent />
      </DocumentWorkflowProvider>
    </AuthProvider>
  )
}

export default App
