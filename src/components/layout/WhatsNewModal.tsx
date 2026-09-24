import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Dialog } from '../ui/dialog'
import { Button } from '../ui/primitives'
import { WHATS_NEW_VERSION, WHATS_NEW_ITEMS } from '../../lib/whatsNew'

const STORAGE_KEY = 'content-tracker:whats-new-seen'

export function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let seen: string | null = null
    try {
      seen = localStorage.getItem(STORAGE_KEY)
    } catch {
      // localStorage unavailable (private browsing, etc.) — just skip the popup rather than error.
      return
    }
    if (seen !== WHATS_NEW_VERSION) setOpen(true)
  }, [])

  function dismiss() {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION)
    } catch {
      // ignore — worst case it shows again next time
    }
  }

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title="What's New"
      width="max-w-md"
      footer={
        <Button onClick={dismiss} className="w-full sm:w-auto">
          Got it
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-pine-700">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Latest update</span>
        </div>
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {WHATS_NEW_ITEMS.map((item) => (
            <div key={item.title}>
              <p className="text-sm font-semibold text-ink-900">{item.title}</p>
              <p className="text-sm text-ink-500 mt-0.5">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
