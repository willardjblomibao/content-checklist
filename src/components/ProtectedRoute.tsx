import { useEffect } from 'react'
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
  const { session, profile, loading, isAdmin, signOut } = useAuth()

  // If the account has been deactivated, actually sign the stale session
  // out (in an effect, not during render) instead of just redirecting to
  // /login while a valid session token is still sitting in memory. Without
  // this, Login sees "there's a session" and bounces back to "/", which
  // ProtectedRoute immediately bounces back to "/login" again — an
  // infinite Navigate <-> Navigate loop ("Maximum update depth exceeded").
  useEffect(() => {
    if (profile?.status === 'inactive') {
      sessionStorage.setItem('deactivated_notice', '1')
      signOut()
    }
  }, [profile?.status, signOut])

  if (loading) return <PageSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <PageSpinner />
  // Session still exists for a moment while signOut() above completes —
  // show a spinner rather than navigating anywhere until it actually clears.
  if (profile.status === 'inactive') return <PageSpinner />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return children
}
