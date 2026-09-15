import { FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Film } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button, Field, Input } from '../components/ui/primitives'

export default function Login() {
  const { session, profile, signIn, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('deactivated_notice')) {
      sessionStorage.removeItem('deactivated_notice')
      setError('Your account has been deactivated. Contact your admin for access.')
    }
  }, [])

  // Only bounce away to "/" once we actually know this is a live, active
  // account. Redirecting on "session exists" alone — before the profile
  // has loaded, or for a deactivated account — is what causes a redirect
  // loop with ProtectedRoute (which sends inactive/unknown accounts right
  // back here). See ProtectedRoute.tsx for the other half of this fix.
  if (!authLoading && session && profile?.status === 'active') return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-10 w-10 rounded-md bg-gradient-to-b from-pine-500 to-pine-700 flex items-center justify-center mb-3 shadow-soft">
            <Film className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-ink-900">Content Team Tracker</h1>
          <p className="text-sm text-ink-500 mt-1">Sign in to log or review production</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-ink-100 rounded-xl2 shadow-soft p-6 flex flex-col gap-4">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <p className="text-sm text-clay-600 bg-clay-50 border border-clay-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={submitting} className="w-full mt-1">
            Sign in
          </Button>
        </form>

        <p className="text-xs text-ink-400 text-center mt-6">
          Accounts are created by your admin. Contact them if you need access.
        </p>
      </div>
    </div>
  )
}
