import { Link, NavLink, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn, initials } from '../../lib/utils'
import { BrandMark } from './Sidebar'
import { crumbFor, growthNav } from './nav'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { pathname, search } = useLocation()
  const { profile } = useAuth()
  const crumb = crumbFor(pathname, search)

  return (
    <>
      {/* Desktop */}
      <header className="hidden md:flex sticky top-0 z-20 h-[60px] items-center gap-4 px-6 lg:px-8 bg-white/90 backdrop-blur border-b border-ink-100">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-500 truncate">
          {crumb.section}
          {crumb.page && (
            <>
              <span className="mx-1.5 text-ink-300">/</span>
              <span className="font-semibold text-ink-900">{crumb.page}</span>
            </>
          )}
        </nav>
        <button
          type="button"
          onClick={onSearch}
          className="ml-auto flex items-center gap-2 h-9 w-64 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-400 hover:border-ink-300 hover:text-ink-500 transition-colors"
        >
          <Search className="h-4 w-4" />
          Search pages…
          <kbd className="ml-auto text-[10px] font-semibold text-ink-400 border border-ink-200 rounded px-1.5 py-px">
            {isMac ? '⌘' : 'Ctrl'} K
          </kbd>
        </button>
      </header>

      {/* Mobile */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white/95 backdrop-blur border-b border-ink-100 flex items-center gap-3 px-4">
        <Link to="/" aria-label="Home">
          <BrandMark size="sm" />
        </Link>
        <button type="button" onClick={onSearch} aria-label="Search" className="ml-auto p-2 rounded-lg text-ink-600 hover:bg-ink-100">
          <Search className="h-5 w-5" />
        </button>
        <Link
          to="/settings"
          aria-label="Settings"
          className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-semibold"
        >
          {profile ? initials(profile.full_name) : '?'}
        </Link>
      </header>
    </>
  )
}

/** Secondary navigation shown on every Growth page. */
export function GrowthTabs() {
  const { isAdmin } = useAuth()
  const items = growthNav.filter((i) => isAdmin || !i.adminOnly)
  return (
    <div className="bg-white border-b border-ink-100 md:sticky md:top-[60px] z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Growth sections" className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'px-3 py-3 text-sm whitespace-nowrap border-b-2 transition-colors',
                  isActive
                    ? 'border-pine-600 text-pine-800 font-semibold'
                    : 'border-transparent text-ink-500 font-medium hover:text-ink-800'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
