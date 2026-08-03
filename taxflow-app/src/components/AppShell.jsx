import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()

  const isEmployee = user?.role === 'employee'
  const isSuperAdmin = user?.role === 'superadmin'
  const hasRouting = isEmployee || isSuperAdmin
  const Dashboard = DASHBOARDS[user?.role] || EmployeeDashboard

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--color-archive)]">
      <TopNav />

      <main
        key={location.pathname}
        className="relative z-[1] flex-1 overflow-y-auto px-[var(--space-4)] py-[var(--space-6)] sm:px-[var(--space-6)] lg:px-[var(--space-8)] lg:py-[var(--space-8)]"
      >
        {hasRouting ? (
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clients/:clientId" element={<ClientDetailView />} />
            <Route path="/clients/:clientId/projects/:projectId" element={<ProjectDetailView />} />
            <Route
              path="/clients/:clientId/projects/:projectId/documents/:documentId"
              element={<DocumentDetailView />}
            />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  )
}
