import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusSquare,
  History,
  Users,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Film,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn, initials } from '../../lib/utils'

const assistantNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/daily-log', label: 'Daily Log', icon: PlusSquare },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const adminNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/daily-log', label: 'Daily Log', icon: PlusSquare },
  { to: '/history', label: 'History', icon: History },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const nav = isAdmin ? adminNav : assistantNav

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col shrink-0 bg-ink-950 text-ink-200 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-ink-800">
        <div className="h-7 w-7 rounded-md bg-pine-600 flex items-center justify-center">
          <Film className="h-4 w-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">Content Tracker</span>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-900 hover:text-white'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-ink-800">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-pine-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {profile ? initials(profile.full_name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
            <p className="text-xs text-ink-400 capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={signOut}
            aria-label="Log out"
            className="text-ink-400 hover:text-white p-1.5 rounded-md hover:bg-ink-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
