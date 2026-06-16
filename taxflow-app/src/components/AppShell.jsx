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
    <div className="flex min-h-screen bg-[var(--color-surface-lowest)] relative overflow-hidden font-sans">
      {/* Ambient Deep Void Background Glows */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 40%),
            radial-gradient(ellipse at 100% 100%, color-mix(in srgb, var(--color-secondary) 8%, transparent) 0%, transparent 40%),
            var(--color-surface-lowest)
          `,
        }}
      />

      <div className="flex-1 flex flex-col relative z-[1] min-w-0">
        <TopNav />
        <AnimatePresence mode="wait">
          <motion.main
            key={user?.role}
            initial={{ opacity: 0, scale: 0.99, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex-1 p-8 overflow-y-auto"
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
    </div>
  )
}


