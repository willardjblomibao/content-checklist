import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { PageSpinner } from './components/ui/primitives'
import Login from './pages/Login'
import DailyLog from './pages/DailyLog'
import History from './pages/History'
import Team from './pages/Team'
import Clients from './pages/Clients'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import AdminDashboard from './pages/AdminDashboard'
import AssistantDashboard from './pages/AssistantDashboard'

function RoleDashboard() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <PageSpinner />
  return isAdmin ? <AdminDashboard /> : <AssistantDashboard />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoleDashboard />} />
        <Route path="/daily-log" element={<DailyLog />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/team"
          element={
            <ProtectedRoute adminOnly>
              <Team />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute adminOnly>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute adminOnly>
              <Reports />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  )
}
