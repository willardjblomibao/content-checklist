import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Home, History, TrendingUp, Menu, Plus, X, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import { navGroups, settingsNav } from './nav'
import { NavRow } from './Sidebar'

function Tab({ to, label, icon: Icon, end, activeOverride }: { to: string; label: string; icon: typeof Home; end?: boolean; activeOverride?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 text-[11px] flex-1 py-1',
          (activeOverride ?? isActive) ? 'text-pine-800 font-semibold' : 'text-ink-500 font-medium'
        )
      }
    >
      <Icon className="h-[22px] w-[22px]" />
      {label}
    </NavLink>
  )
}

/** Bottom tab bar + "More" sheet for phones. */
export function MobileNav() {
  const { pathname } = useLocation()
  const { isAdmin, signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  // The Daily Log page has its own sticky save bar.
  if (pathname === '/daily-log') return null

  const close = () => setMoreOpen(false)

  return (
    <>
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-ink-100 flex items-end px-2 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]"
      >
        <Tab to="/" label="Home" icon={Home} end />
        <Tab to="/history" label="History" icon={History} />
        <div className="flex-1 flex justify-center">
          <Link
            to="/daily-log"
            aria-label="Log today's work"
            className="-mt-7 h-14 w-14 rounded-2xl bg-pine-600 text-white flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(23,117,102,0.55)] active:bg-pine-700"
          >
            <Plus className="h-7 w-7" />
          </Link>
        </div>
        <Tab to="/growth" label="Growth" icon={TrendingUp} activeOverride={pathname.startsWith('/growth')} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-1 text-[11px] flex-1 py-1 text-ink-500 font-medium"
        >
          <Menu className="h-[22px] w-[22px]" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="More">
          <div className="absolute inset-0 bg-ink-950/30" onClick={close} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="mx-auto h-1 w-10 rounded-full bg-ink-200 mb-3" />
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-base font-semibold text-ink-900">Menu</span>
              <button type="button" onClick={close} aria-label="Close menu" className="p-1.5 rounded-lg hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navGroups(isAdmin).map((g) => (
              <div key={g.id} className="mt-3">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">{g.label}</p>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((item) => (
                    <NavRow key={item.to} item={item} onNavigate={close} />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 border-t border-ink-100 pt-3 flex flex-col gap-0.5">
              <NavRow item={settingsNav} onNavigate={close} />
              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-clay-600 hover:bg-clay-50"
              >
                <LogOut className="h-[18px] w-[18px]" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
