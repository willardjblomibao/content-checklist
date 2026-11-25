import {
  Home,
  History,
  TrendingUp,
  PlusSquare,
  CalendarRange,
  GitCompare,
  Zap,
  FileDown,
  Activity,
  Radio,
  Users,
  Building2,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  adminOnly?: boolean
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
  adminOnly?: boolean
}

/** Top of the sidebar, always visible. "Log today's work" is its own button above these. */
export const mainNav: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/history', label: 'History', icon: History },
]

export const growthNav: NavItem[] = [
  { to: '/growth', label: 'Overview', icon: TrendingUp, end: true },
  { to: '/growth/input', label: 'Weekly input', icon: PlusSquare },
  { to: '/growth/monthly', label: 'Monthly summary', icon: CalendarRange },
  { to: '/growth/compare', label: 'Compare platforms', icon: GitCompare },
  { to: '/growth/correlation', label: 'Content impact', icon: Zap },
  { to: '/growth/reports', label: 'Reports', icon: FileDown },
  { to: '/growth/activity', label: 'Activity log', icon: Activity },
  { to: '/growth/platforms', label: 'Platforms', icon: Radio, adminOnly: true },
]

export const adminNav: NavItem[] = [
  { to: '/team', label: 'Team', icon: Users },
  { to: '/clients', label: 'Clients', icon: Building2 },
  { to: '/reports', label: 'Production reports', icon: BarChart3 },
]

export const settingsNav: NavItem = { to: '/settings', label: 'Settings', icon: Settings }

export const dailyLogNav: NavItem = { to: '/daily-log', label: "Log today's work", icon: PlusSquare }

export function navGroups(isAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    { id: 'growth', label: 'Growth', items: growthNav.filter((i) => isAdmin || !i.adminOnly) },
  ]
  if (isAdmin) groups.push({ id: 'admin', label: 'Admin', items: adminNav, adminOnly: true })
  return groups
}

/** Every page a user can reach, used by the command palette. */
export function allNavItems(isAdmin: boolean): NavItem[] {
  return [
    dailyLogNav,
    ...mainNav,
    ...navGroups(isAdmin).flatMap((g) => g.items),
    settingsNav,
  ]
}

/** Section + page title for the breadcrumb in the top bar. */
export function crumbFor(pathname: string, search: string): { section: string; page: string } {
  if (pathname === '/daily-log') {
    return { section: 'Workspace', page: search.includes('edit=') ? 'Edit log' : "Log today's work" }
  }
  const growth = growthNav.find((i) => i.to === pathname)
  if (growth) return { section: 'Growth', page: growth.label }
  const admin = adminNav.find((i) => i.to === pathname)
  if (admin) return { section: 'Admin', page: admin.label }
  const main = [...mainNav, settingsNav].find((i) => i.to === pathname)
  if (main) return { section: 'Workspace', page: main.label }
  return { section: 'Workspace', page: '' }
}
