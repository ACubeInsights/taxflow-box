import { Navigate } from 'react-router-dom'
import EmployeeDashboard from './components/dashboards/EmployeeDashboard'
import ClientDetailView from './components/views/ClientDetailView'
import ProjectDetailView from './components/views/ProjectDetailView'
import DocumentDetailView from './components/views/DocumentDetailView'
import NotFoundView from './components/views/NotFoundView'

/**
 * Employee route definitions for React Router.
 * Used inside AppShell when role === 'employee'.
 */
export const employeeRoutes = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: '/dashboard', element: <EmployeeDashboard /> },
  { path: '/clients/:clientId', element: <ClientDetailView /> },
  { path: '/clients/:clientId/projects/:projectId', element: <ProjectDetailView /> },
  { path: '/clients/:clientId/projects/:projectId/documents/:documentId', element: <DocumentDetailView /> },
  { path: '*', element: <NotFoundView /> },
]
