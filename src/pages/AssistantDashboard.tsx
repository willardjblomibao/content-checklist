import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { KpiCards, RangeSwitcher, type RangeKey } from '../components/dashboard/KpiCards'
import { Button, Card, EmptyState, PageSpinner, Badge } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, type ProductionLogWithRelations } from '../types/database'
import { formatDate, startOfMonthISO, startOfWeekISO, todayISO } from '../lib/utils'

function rangeToDates(range: RangeKey): { from: string; to: string } {
  const to = todayISO()
  if (range === 'today') return { from: to, to }
  if (range === 'week') return { from: startOfWeekISO(), to }
  return { from: startOfMonthISO(), to }
}

export default function AssistantDashboard() {
  const { profile } = useAuth()
  const [range, setRange] = useState<RangeKey>('today')
  const [logs, setLogs] = useState<ProductionLogWithRelations[]>([])
  const [recent, setRecent] = useState<ProductionLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to } = rangeToDates(range)

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status)')
      .eq('user_id', profile.id)
      .gte('production_date', from)
      .lte('production_date', to)
      .then(({ data }) => {
        setLogs((data ?? []) as unknown as ProductionLogWithRelations[])
        setLoading(false)
      })
  }, [profile, from, to])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status)')
      .eq('user_id', profile.id)
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [profile, logs])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const f of PRODUCTION_FIELDS) t[f.countKey] = 0
    for (const log of logs) {
      for (const f of PRODUCTION_FIELDS) {
        t[f.countKey] += (log as any)[f.countKey] ?? 0
      }
    }
    return t
  }, [logs])

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Good morning, {firstName}</h1>
          <p className="text-sm text-ink-500 mt-1">{formatDate(todayISO(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link to="/daily-log">
          <Button size="lg">
            <Plus className="h-4 w-4" />
            Add Daily Log
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-ink-700">Your Production</h2>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      {loading ? <PageSpinner /> : <KpiCards totals={totals} />}

      <div>
        <h2 className="text-sm font-semibold text-ink-700 mb-3">Recent Activity</h2>
        <Card>
          {recent.length === 0 ? (
            <EmptyState
              title="No production logged yet"
              description="Start tracking today's work by adding your first daily log."
              action={
                <Link to="/daily-log">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Add Daily Log
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {recent.map((log) => {
                const total = PRODUCTION_FIELDS.reduce((sum, f) => sum + ((log as any)[f.countKey] ?? 0), 0)
                const anyInProgress = PRODUCTION_FIELDS.some((f) => (log as any)[f.statusKey] === 'in_progress')
                return (
                  <div key={log.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{log.client?.name ?? 'Unknown client'}</p>
                      <p className="text-xs text-ink-500 mt-0.5">{formatDate(log.production_date)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-ink-800">{total} items</span>
                      <Badge variant={anyInProgress ? 'in_progress' : 'completed'} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
