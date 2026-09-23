import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, EmptyState, PageSpinner, Select } from '../../components/ui/primitives'
import type { ActivityLogWithRelations, Client } from '../../types/database'
import { formatDate } from '../../lib/utils'

export default function ActivityLogs() {
  const { isAdmin } = useAuth()
  const [logs, setLogs] = useState<ActivityLogWithRelations[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Activity Logs</h1>
          <p className="text-sm text-ink-500 mt-1">
            {isAdmin ? "Every action taken across the Growth Tracker module." : 'Your own Growth Tracker activity.'}
          </p>
        </div>
        {isAdmin && clients.length > 0 && (
          <Select className="w-48" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
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
        ) : logs.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions like saving weekly data or editing platforms will show up here." />
        ) : (
          <div className="divide-y divide-ink-100">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <Activity className="h-4 w-4 text-pine-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm text-ink-900">
                    <span className="font-medium">{log.profile?.full_name ?? 'Someone'}</span> — {log.action}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {log.target}
                    {log.client?.name ? ` · ${log.client.name}` : ''}
                    {' · '}
                    {formatDate(log.created_at, 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
