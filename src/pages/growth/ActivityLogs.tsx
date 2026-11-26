import { useEffect, useMemo, useState } from 'react'
import { Activity, Plus, Pencil, Trash2, Upload } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, EmptyState, PageSpinner, Select, PageHeader, Segmented } from '../../components/ui/primitives'
import type { ActivityLogWithRelations, Client } from '../../types/database'
import { cn, formatDate } from '../../lib/utils'

export default function ActivityLogs() {
  const { isAdmin } = useAuth()
  const [logs, setLogs] = useState<ActivityLogWithRelations[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<'all' | Kind>('all')

  useEffect(() => {
    if (isAdmin) {
      supabase.from('clients').select('*').order('name').then(({ data }) => setClients((data ?? []) as Client[]))
    }
  }, [isAdmin])

  useEffect(() => {
    setLoading(true)
    let query = supabase
      .from('activity_logs')
      .select('*, profile:profiles(id, full_name), client:clients(id, name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (clientFilter) query = query.eq('client_id', clientFilter)
    query.then(({ data }) => {
      setLogs((data ?? []) as unknown as ActivityLogWithRelations[])
      setLoading(false)
    })
  }, [clientFilter])

  const kinds = useMemo(() => logs.map((l) => ({ log: l, kind: kindOf(l.action) })), [logs])
  const visible = kinds.filter((k) => kindFilter === 'all' || k.kind === kindFilter)
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>()
    for (const item of visible) {
      const day = format(new Date(item.log.created_at), 'yyyy-MM-dd')
      map.set(day, [...(map.get(day) ?? []), item])
    }
    return Array.from(map.entries())
  }, [visible])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity log"
        description={isAdmin ? 'Who changed what in the Growth Tracker.' : 'Your own Growth Tracker activity.'}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          ariaLabel="Action type"
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'created', label: 'Added' },
            { value: 'updated', label: 'Updated' },
            { value: 'deleted', label: 'Deleted' },
            { value: 'imported', label: 'Imported' },
          ]}
        />
        {isAdmin && clients.length > 0 && (
          <Select className="w-auto min-w-[170px] sm:ml-auto" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description={kindFilter === 'all' ? 'Actions like saving weekly data or editing platforms will show up here.' : 'Nothing of this type yet.'}
          />
        ) : (
          <div className="px-5 py-2">
            {groups.map(([day, items]) => (
              <div key={day} className="py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400 mb-1">{dayLabel(day)}</p>
                <ol className="relative">
                  {items.map(({ log, kind }, i) => {
                    const k = KIND_STYLE[kind]
                    return (
                      <li key={log.id} className="relative flex gap-3 py-2.5">
                        {i < items.length - 1 && <span className="absolute left-[15px] top-10 bottom-0 w-px bg-ink-100" aria-hidden="true" />}
                        <span className={cn('relative z-[1] h-8 w-8 rounded-full flex items-center justify-center shrink-0', k.bg)}>
                          <k.icon className={cn('h-4 w-4', k.fg)} />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-sm text-ink-800">
                            <span className="font-semibold text-ink-900">{log.profile?.full_name ?? 'Someone'}</span> {log.action}
                          </p>
                          <p className="text-xs text-ink-500 mt-0.5 truncate">
                            {log.target}
                            {log.client?.name ? ` · ${log.client.name}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-ink-400 whitespace-nowrap pt-1">{formatDate(log.created_at, 'h:mm a')}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

type Kind = 'created' | 'updated' | 'deleted' | 'imported' | 'other'

function kindOf(action: string): Kind {
  const a = action.toLowerCase()
  if (/import|upload/.test(a)) return 'imported'
  if (/delet|remov/.test(a)) return 'deleted'
  if (/updat|edit|chang|renam/.test(a)) return 'updated'
  if (/creat|add|sav|log/.test(a)) return 'created'
  return 'other'
}

const KIND_STYLE: Record<Kind, { icon: typeof Plus; bg: string; fg: string }> = {
  created: { icon: Plus, bg: 'bg-pine-100', fg: 'text-pine-700' },
  updated: { icon: Pencil, bg: 'bg-amber-100', fg: 'text-amber-600' },
  deleted: { icon: Trash2, bg: 'bg-clay-100', fg: 'text-clay-600' },
  imported: { icon: Upload, bg: 'bg-violet-100', fg: 'text-violet-600' },
  other: { icon: Activity, bg: 'bg-ink-100', fg: 'text-ink-500' },
}

function dayLabel(iso: string): string {
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  return formatDate(iso, 'EEEE, MMMM d, yyyy')
}
