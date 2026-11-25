import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import { allNavItems, growthNav, adminNav } from './nav'

function sectionOf(to: string): string {
  if (to === '/daily-log') return 'Actions'
  if (growthNav.some((i) => i.to === to)) return 'Growth'
  if (adminNav.some((i) => i.to === to)) return 'Admin'
  return 'Workspace'
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = allNavItems(isAdmin)
    if (!q) return items
    return items.filter((i) => i.label.toLowerCase().includes(q) || sectionOf(i.to).toLowerCase().includes(q))
  }, [query, isAdmin])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Focus after the dialog paints.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  function go(to: string) {
    onClose()
    navigate(to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active].to)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let lastSection = ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-softLg border border-ink-100 overflow-hidden" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-ink-100">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
          />
          <kbd className="text-[10px] font-semibold text-ink-400 border border-ink-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2 scrollbar-thin">
          {results.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-500">No pages match "{query}".</p>}
          {results.map((item, idx) => {
            const section = sectionOf(item.to)
            const header = section !== lastSection
            lastSection = section
            const Icon = item.icon
            return (
              <div key={item.to}>
                {header && (
                  <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">{section}</p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(item.to)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left',
                    idx === active ? 'bg-pine-50 text-pine-800' : 'text-ink-700'
                  )}
                >
                  <span
                    className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                      idx === active ? 'bg-white text-pine-700' : 'bg-ink-100/70 text-ink-500'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium flex-1">{item.label}</span>
                  {idx === active && <CornerDownLeft className="h-3.5 w-3.5 text-pine-600" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
