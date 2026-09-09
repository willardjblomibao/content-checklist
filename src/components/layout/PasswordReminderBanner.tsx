import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { KeyRound, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function PasswordReminderBanner() {
  const { profile } = useAuth()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)

  // Reappears every fresh sign-in / page load (dismissal only lasts this
  // browsing session) and hides itself once they're already on the page
  // where they'd change it, or once it's actually been changed.
  if (!profile?.must_change_password || dismissed || location.pathname === '/settings') return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center gap-3 text-sm text-amber-800">
        <KeyRound className="h-4 w-4 shrink-0" />
        <span className="flex-1 min-w-0">
          You're signed in with a temporary password. Please change it as soon as possible.
        </span>
        <Link
          to="/settings"
          className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
        >
          Change Password
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 text-amber-600 hover:text-amber-900 p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
