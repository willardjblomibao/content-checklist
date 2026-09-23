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
  TrendingUp,
  Radio,
  CalendarRange,
  Activity,
  FileDown,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn, initials } from '../../lib/utils'

export const assistantNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/daily-log', label: 'Daily Log', icon: PlusSquare },
  { to: '/history', label: 'History', icon: History },
  { to: '/growth', label: 'Growth', icon: TrendingUp, end: true },
  { to: '/growth/input', label: 'Weekly Growth', icon: PlusSquare },
  { to: '/growth/monthly', label: 'Monthly Summary', icon: CalendarRange },
  { to: '/growth/correlation', label: 'Content Impact', icon: Zap },
  { to: '/growth/reports', label: 'Growth Reports', icon: FileDown },
  { to: '/growth/activity', label: 'Activity Logs', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const adminNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/daily-log', label: 'Daily Log', icon: PlusSquare },
  { to: '/history', label: 'History', icon: History },
  { to: '/growth', label: 'Growth', icon: TrendingUp, end: true },
  { to: '/growth/input', label: 'Weekly Growth', icon: PlusSquare },
  { to: '/growth/monthly', label: 'Monthly Summary', icon: CalendarRange },
  { to: '/growth/correlation', label: 'Content Impact', icon: Zap },
  { to: '/growth/reports', label: 'Growth Reports', icon: FileDown },
  { to: '/growth/platforms', label: 'Platforms', icon: Radio },
  { to: '/growth/activity', label: 'Activity Logs', icon: Activity },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const nav = isAdmin ? adminNav : assistantNav

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col shrink-0 bg-white text-ink-500 h-screen sticky top-0 border-r border-ink-100">
      <div className="flex items-center gap-2 px-5 h-16">
        <div className="h-8 w-8 rounded-lg bg-pine-800 flex items-center justify-center">
          <Film className="h-4 w-4 text-white" />
        </div>
        <span className="text-ink-900 font-semibold text-sm tracking-tight">Content Tracker</span>
      </div>

      <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gradient-to-b from-pine-500 to-pine-700 text-white shadow-soft'
                  : 'text-ink-500 hover:bg-pine-50 hover:text-pine-800'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 mt-2 border-t border-ink-100">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {profile ? initials(profile.full_name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-900 truncate">{profile?.full_name}</p>
            <p className="text-xs text-ink-400 capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={signOut}
            aria-label="Log out"
            className="text-ink-400 hover:text-pine-700 p-1.5 rounded-full hover:bg-pine-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
