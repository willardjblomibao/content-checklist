import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar, GrowthTabs } from './TopBar'
import { MobileNav } from './MobileNav'
import { CommandPalette } from './CommandPalette'
import { PasswordReminderBanner } from './PasswordReminderBanner'
import { WhatsNewModal } from './WhatsNewModal'
import { useAuth } from '../../contexts/AuthContext'
import { PresenceProvider } from '../../contexts/PresenceContext'
import { cn } from '../../lib/utils'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function AppLayout() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global shortcuts: ⌘K / Ctrl+K opens search, N starts a new daily log.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target) && !paletteOpen) {
        if (document.querySelector('[role="dialog"]')) return
        e.preventDefault()
        navigate('/daily-log')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, paletteOpen])

  const inGrowth = pathname.startsWith('/growth')
  const onDailyLog = pathname === '/daily-log'

  return (
    <PresenceProvider>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />

        <main className="flex-1 min-w-0 pt-14 md:pt-0 flex flex-col">
          <TopBar onSearch={() => setPaletteOpen(true)} />
          {inGrowth && <GrowthTabs />}
          <PasswordReminderBanner />
          {profile && <WhatsNewModal />}
          <div
            className={cn(
              'max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 md:pt-8 flex-1 flex flex-col',
              onDailyLog ? 'pb-0' : 'pb-28 md:pb-10'
            )}
          >
            <Outlet />
          </div>
        </main>

        <MobileNav />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </PresenceProvider>
  )
}
