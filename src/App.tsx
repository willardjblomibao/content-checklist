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
import GrowthDashboard from './pages/growth/GrowthDashboard'
import GrowthInput from './pages/growth/GrowthInput'
import Platforms from './pages/growth/Platforms'
import GrowthMonthly from './pages/growth/GrowthMonthly'
import ActivityLogs from './pages/growth/ActivityLogs'
import GrowthReports from './pages/growth/GrowthReports'
import ContentCorrelation from './pages/growth/ContentCorrelation'
import PlatformComparison from './pages/growth/PlatformComparison'
import ClientReport from './pages/ClientReport'

function RoleDashboard() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <PageSpinner />
  return isAdmin ? <AdminDashboard /> : <AssistantDashboard />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public, token-gated — no login, no admin layout. See ClientReport.tsx. */}
      <Route path="/client-report/:token" element={<ClientReport />} />
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
        <Route path="/growth" element={<GrowthDashboard />} />
        <Route path="/growth/input" element={<GrowthInput />} />
        <Route path="/growth/monthly" element={<GrowthMonthly />} />
        <Route path="/growth/reports" element={<GrowthReports />} />
        <Route path="/growth/correlation" element={<ContentCorrelation />} />
        <Route path="/growth/compare" element={<PlatformComparison />} />
        <Route path="/growth/activity" element={<ActivityLogs />} />
        <Route
          path="/growth/platforms"
          element={
            <ProtectedRoute adminOnly>
              <Platforms />
            </ProtectedRoute>
          }
        />
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
