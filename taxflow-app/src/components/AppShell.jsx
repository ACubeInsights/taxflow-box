import { Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import TopNav from './TopNav'
import SuperAdminDashboard from './dashboards/SuperAdminDashboard'
import EmployeeDashboard from './dashboards/EmployeeDashboard'
import ClientDashboard from './dashboards/ClientDashboard'
import ClientDetailView from './views/ClientDetailView'
import ProjectDetailView from './views/ProjectDetailView'
import DocumentDetailView from './views/DocumentDetailView'
import NotFoundView from './views/NotFoundView'

const DASHBOARDS = {
  superadmin: SuperAdminDashboard,
  employee: EmployeeDashboard,
  client: ClientDashboard,
}

export default function AppShell() {
  const { user } = useAuth()

  const isEmployee = user?.role === 'employee'
  const isSuperAdmin = user?.role === 'superadmin'
  const hasRouting = isEmployee || isSuperAdmin
  const Dashboard = DASHBOARDS[user?.role] || EmployeeDashboard

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-surface-lowest)] relative overflow-hidden">
      {/* Ambient background — extremely subtle */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 0%, rgba(129, 140, 248, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse 40% 30% at 80% 100%, rgba(196, 181, 253, 0.03) 0%, transparent 50%)
          `,
        }}
      />

      {/* Top navigation */}
      <TopNav />

      {/* Main content area */}
      <AnimatePresence mode="wait">
        <motion.main
          key={user?.role}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 relative z-[1] px-6 py-6 lg:px-8 lg:py-8 overflow-y-auto"
        >
          {hasRouting ? (
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients/:clientId" element={<ClientDetailView />} />
              <Route path="/clients/:clientId/projects/:projectId" element={<ProjectDetailView />} />
              <Route path="/clients/:clientId/projects/:projectId/documents/:documentId" element={<DocumentDetailView />} />
              <Route path="*" element={<NotFoundView />} />
            </Routes>
          ) : (
            <Dashboard />
          )}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
