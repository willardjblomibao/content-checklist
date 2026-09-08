import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Menu, X, Film } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAdmin, signOut } = useAuth()

  const nav = isAdmin
    ? [
        { to: '/', label: 'Dashboard', end: true },
        { to: '/daily-log', label: 'Daily Log' },
        { to: '/history', label: 'History' },
        { to: '/team', label: 'Team' },
        { to: '/clients', label: 'Clients' },
        { to: '/reports', label: 'Reports' },
        { to: '/settings', label: 'Settings' },
      ]
    : [
        { to: '/', label: 'Dashboard', end: true },
        { to: '/daily-log', label: 'Daily Log' },
        { to: '/history', label: 'History' },
        { to: '/settings', label: 'Settings' },
      ]

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar />

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-ink-950 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-pine-600 flex items-center justify-center">
            <Film className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Content Tracker</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white p-1.5" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-ink-950 text-white">
          <div className="flex items-center justify-between h-14 px-4 border-b border-ink-800">
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
                    'px-3 py-2.5 rounded-md text-sm font-medium',
                    isActive ? 'bg-ink-800 text-white' : 'text-ink-300'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={signOut}
              className="mt-4 text-left px-3 py-2.5 rounded-md text-sm font-medium text-clay-500"
            >
              Log out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
