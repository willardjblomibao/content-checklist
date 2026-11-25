import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { ChevronDown, Film, LogOut, Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn, initials } from '../../lib/utils'
import { mainNav, navGroups, settingsNav, type NavItem } from './nav'

function isInGroup(pathname: string, items: NavItem[]) {
  return items.some((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/')))
}

const GROUP_STATE_KEY = 'pl.sidebar.groups'

function readGroupState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUP_STATE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function NavRow({ item, onNavigate, nested }: { item: NavItem; onNavigate?: () => void; nested?: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg text-sm transition-colors',
          nested ? 'pl-9 pr-3 py-[7px] text-[13px]' : 'px-3 py-2',
          isActive
            ? 'bg-pine-50 text-pine-800 font-semibold'
            : 'text-ink-600 font-medium hover:bg-ink-100/70 hover:text-ink-900'
        )
      }
    >
      {({ isActive }) => (
        <>
          {nested ? (
            <span
              className={cn(
                'absolute left-[18px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full',
                isActive ? 'bg-pine-600' : 'bg-transparent'
              )}
            />
          ) : (
            <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-pine-700' : 'text-ink-400 group-hover:text-ink-600')} />
          )}
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={cn(
          'rounded-[10px] bg-gradient-to-br from-pine-500 to-pine-800 flex items-center justify-center shrink-0 shadow-btn',
          size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
        )}
      >
        <Film className={cn('text-white', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      </div>
      <div className="flex flex-col leading-none min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={cn('brand-title truncate', size === 'sm' ? 'text-sm' : 'text-base')}>Partnerlee</span>
          <span className="text-[10px] font-bold text-pine-700 bg-pine-100 rounded-[5px] px-1 py-px">2.0</span>
        </span>
        <span className="text-ink-400 text-[10px] font-medium tracking-wide uppercase mt-1 truncate">Content Tracker</span>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const { pathname } = useLocation()
  const groups = navGroups(isAdmin)
  const [open, setOpen] = useState<Record<string, boolean>>(() => readGroupState())

  // Always reveal the group that holds the current page.
  useEffect(() => {
    const active = groups.find((g) => isInGroup(pathname, g.items))
    if (active && open[active.id] === false) setOpen((o) => ({ ...o, [active.id]: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function toggle(id: string) {
    setOpen((o) => {
      const next = { ...o, [id]: !(o[id] ?? true) }
      try {
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable — fine, state just won't persist */
      }
      return next
    })
  }

  return (
    <aside className="hidden md:flex md:w-[248px] md:flex-col shrink-0 bg-white h-screen sticky top-0 border-r border-ink-100">
      <div className="px-5 pt-5 pb-4">
        <BrandMark />
      </div>

      <div className="px-3.5">
        <Link
          to="/daily-log"
          className="flex items-center gap-2 rounded-[10px] bg-pine-600 hover:bg-pine-700 text-white px-3.5 py-2.5 text-sm font-semibold shadow-btn transition-colors"
        >
          <Plus className="h-4 w-4" />
          Log today's work
          <kbd className="ml-auto text-[10px] font-semibold text-white/80 border border-white/30 rounded px-1.5 py-px">N</kbd>
        </Link>
      </div>

      <nav className="flex-1 px-3.5 pt-4 pb-3 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
        {mainNav.map((item) => (
          <NavRow key={item.to} item={item} />
        ))}

        {groups.map((group) => {
          const isOpen = open[group.id] ?? true
          return (
            <div key={group.id} className="mt-4">
              <button
                type="button"
                onClick={() => toggle(group.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400 hover:text-ink-600"
              >
                {group.label}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')} />
              </button>
              {isOpen && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {group.items.map((item) =>
                    group.id === 'growth' ? (
                      <NavRow key={item.to} item={item} nested />
                    ) : (
                      <NavRow key={item.to} item={item} />
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div className="mt-4">
          <NavRow item={settingsNav} />
        </div>
      </nav>

      <div className="px-3.5 py-3.5 border-t border-ink-100">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {profile ? initials(profile.full_name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900 truncate">{profile?.full_name}</p>
            <p className="text-xs text-ink-500 capitalize">{profile?.role === 'assistant' ? 'Content assistant' : profile?.role}</p>
          </div>
          <button
            onClick={signOut}
            aria-label="Log out"
            title="Log out"
            className="text-ink-400 hover:text-clay-600 p-1.5 rounded-lg hover:bg-clay-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
