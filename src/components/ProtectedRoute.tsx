import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PageSpinner } from './ui/primitives'

export function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: JSX.Element
  adminOnly?: boolean
}) {
  const { session, profile, loading, isAdmin } = useAuth()

  if (loading) return <PageSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <PageSpinner />
  if (profile.status === 'inactive') return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return children
}
