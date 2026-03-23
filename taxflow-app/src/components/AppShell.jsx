import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import SuperAdminDashboard from './dashboards/SuperAdminDashboard'
import CXODashboard from './dashboards/CXODashboard'
import EmployeeDashboard from './dashboards/EmployeeDashboard'
import ClientDashboard from './dashboards/ClientDashboard'

const DASHBOARDS = {
  superadmin: SuperAdminDashboard,
  cxo: CXODashboard,
  employee: EmployeeDashboard,
  client: ClientDashboard,
}

export default function AppShell() {
  const { user } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Responsive: auto-collapse sidebar below 1024px viewport
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)')

    const handleChange = (e) => {
      setSidebarCollapsed(e.matches)
    }

    // Set initial state
    setSidebarCollapsed(mql.matches)

    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  const Dashboard = DASHBOARDS[user] || EmployeeDashboard

  return (
    <div className="flex min-h-screen bg-[var(--color-surface-lowest)] relative overflow-hidden font-sans">
      {/* Ambient Deep Void Background Glows */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, rgba(173, 198, 255, 0.08) 0%, transparent 40%),
            radial-gradient(ellipse at 100% 100%, rgba(232, 179, 255, 0.08) 0%, transparent 40%),
            var(--color-surface-lowest)
          `,
        }}
      />

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <div
        className="flex-1 flex flex-col relative z-[1] min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
      >
        <TopNav />
        <AnimatePresence mode="wait">
          <motion.main
            key={user}
            initial={{ opacity: 0, scale: 0.99, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex-1 p-8 overflow-y-auto"
          >
            <Dashboard />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}

