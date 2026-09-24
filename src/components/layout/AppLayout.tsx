import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Menu, X, Film } from 'lucide-react'
import { Sidebar, assistantNav, adminNav } from './Sidebar'
import { PasswordReminderBanner } from './PasswordReminderBanner'
import { WhatsNewModal } from './WhatsNewModal'
import { useAuth } from '../../contexts/AuthContext'
import { PresenceProvider } from '../../contexts/PresenceContext'
import { cn } from '../../lib/utils'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAdmin, profile, signOut } = useAuth()

  // Single source of truth: the same nav list the desktop Sidebar uses,
  // so mobile never falls behind when a page is added there.
  const nav = isAdmin ? adminNav : assistantNav

  return (
    <PresenceProvider>
      <div className="flex min-h-screen bg-canvas">
      <Sidebar />

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-ink-100 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-pine-800 flex items-center justify-center">
            <Film className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-ink-900 font-semibold text-sm">Content Tracker</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-ink-700 p-1.5" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white text-ink-900 overflow-y-auto">
          <div className="flex items-center justify-between h-14 px-4 border-b border-ink-100">
            <span className="font-semibold text-sm">Menu</span>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col p-3 gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-medium',
                    isActive
                      ? 'bg-gradient-to-b from-pine-500 to-pine-700 text-white'
                      : 'text-ink-500 hover:bg-pine-50'
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={signOut}
              className="mt-4 text-left px-4 py-2.5 rounded-full text-sm font-medium text-clay-600"
            >
              Log out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0 flex flex-col">
        <PasswordReminderBanner />
        {profile && <WhatsNewModal />}
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
    </PresenceProvider>
  )
}
