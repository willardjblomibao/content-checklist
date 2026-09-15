import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, StickyNote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePresence } from '../contexts/PresenceContext'
import { KpiCards, RangeSwitcher, type RangeKey } from '../components/dashboard/KpiCards'
import { ContributionHeatmap } from '../components/dashboard/ContributionHeatmap'
import { Button, Card, EmptyState, PageSpinner } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, type Profile, type ProductionLogWithRelations } from '../types/database'
import { formatDate, startOfMonthISO, startOfWeekISO, todayISO } from '../lib/utils'

function rangeToDates(range: RangeKey): { from: string; to: string } {
  const to = todayISO()
  if (range === 'today') return { from: to, to }
  if (range === 'week') return { from: startOfWeekISO(), to }
  return { from: startOfMonthISO(), to }
}

export default function AdminDashboard() {
  const { onlineUserIds } = usePresence()
  const [range, setRange] = useState<RangeKey>('today')
  const [logs, setLogs] = useState<ProductionLogWithRelations[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [recentNotes, setRecentNotes] = useState<ProductionLogWithRelations[]>([])
  const [heatmapLogs, setHeatmapLogs] = useState<ProductionLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to } = rangeToDates(range)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'assistant')
      .eq('status', 'active')
      .order('full_name')
      .then(({ data }) => setTeam((data ?? []) as Profile[]))
  }, [])

  useEffect(() => {
    // Independent of the KPI date range — always the latest flagged notes
    // across the whole team, so nothing worth seeing scrolls out of view
    // just because someone's looking at "Today" or "This Week".
    supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status), profile:profiles(id, full_name, email)')
      .not('notes', 'is', null)
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setRecentNotes((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [])

  useEffect(() => {
    const start = new Date()
    start.setDate(start.getDate() - 14 * 7)
    supabase
      .from('production_logs')
      .select(
        'production_date, videos_edited_count, videos_reedited_count, carousels_edited_count, carousels_reedited_count, text_posts_prepared_count, text_posts_reedited_count'
      )
      .gte('production_date', start.toISOString().slice(0, 10))
      .then(({ data }) => setHeatmapLogs((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [])

  const heatmapCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of heatmapLogs) {
      map.set(log.production_date, (map.get(log.production_date) ?? 0) + totalItems(log))
    }
    return map
  }, [heatmapLogs])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('production_logs')
      .select('*, profile:profiles(id, full_name, email)')
      .gte('production_date', from)
      .lte('production_date', to)
      .then(({ data }) => {
        setLogs((data ?? []) as unknown as ProductionLogWithRelations[])
        setLoading(false)
      })
  }, [from, to])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const f of PRODUCTION_FIELDS) t[f.countKey] = 0
    for (const log of logs) {
      for (const f of PRODUCTION_FIELDS) t[f.countKey] += (log as any)[f.countKey] ?? 0
    }
    return t
  }, [logs])

  const perAssistant = useMemo(() => {
    const rows = team.map((member) => {
      const memberLogs = logs.filter((l) => l.user_id === member.id)
      const totalsRow: Record<string, number> = {}
      for (const f of PRODUCTION_FIELDS) {
        totalsRow[f.countKey] = memberLogs.reduce((sum, l) => sum + ((l as any)[f.countKey] ?? 0), 0)
      }
      const total = Object.values(totalsRow).reduce((a, b) => a + b, 0)
      return { member, totalsRow, total }
    })
    return rows.sort((a, b) => b.total - a.total)
  }, [team, logs])

  const teamTotal = perAssistant.reduce((sum, r) => sum + r.total, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Content Team</h1>
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
        <h2 className="text-sm font-semibold text-ink-700">Team Production</h2>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <KpiCards totals={totals} />

          <div>
            <h2 className="text-sm font-semibold text-ink-700 mb-3">Team Activity</h2>
            <Card>
              <div className="p-5">
                <ContributionHeatmap countsByDate={heatmapCounts} label="team items" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2">
                Individual Performance
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pine-700 bg-pine-50 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-pine-500" />
                  {team.filter((m) => onlineUserIds.has(m.id)).length} online
                </span>
              </h2>
              <Card className="overflow-hidden">
                {perAssistant.length === 0 ? (
                  <EmptyState
                    title="No team members yet"
                    description="Add assistants from the Team page to start tracking production."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                          <th className="px-5 py-3">Assistant</th>
                          {PRODUCTION_FIELDS.map((f) => (
                            <th key={f.countKey} className="px-3 py-3 text-right whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                          <th className="px-5 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perAssistant.map(({ member, totalsRow, total }) => (
                          <tr key={member.id} className="border-b border-ink-50 last:border-0">
                            <td className="px-5 py-3 font-medium text-ink-900 whitespace-nowrap">
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full shrink-0 ${
                                    onlineUserIds.has(member.id) ? 'bg-pine-500' : 'bg-ink-200'
                                  }`}
                                  title={onlineUserIds.has(member.id) ? 'Online' : 'Offline'}
                                  aria-hidden="true"
                                />
                                {member.full_name}
                              </span>
                            </td>
                            {PRODUCTION_FIELDS.map((f) => (
                              <td key={f.countKey} className="px-3 py-3 text-right text-ink-600">
                                {totalsRow[f.countKey]}
                              </td>
                            ))}
                            <td className="px-5 py-3 text-right font-semibold text-ink-900">{total}</td>
                          </tr>
                        ))}
                        <tr className="bg-pine-50 font-semibold text-ink-900">
                          <td className="px-5 py-3">Team Total</td>
                          {PRODUCTION_FIELDS.map((f) => (
                            <td key={f.countKey} className="px-3 py-3 text-right">
                              {totals[f.countKey]}
                            </td>
                          ))}
                          <td className="px-5 py-3 text-right">{teamTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink-700 mb-3">Recent Notes</h2>
              <Card className="overflow-hidden">
                {recentNotes.length === 0 ? (
                  <EmptyState
                    title="No notes yet"
                    description="Notes assistants add to their daily logs will show up here."
                  />
                ) : (
                  <div className="divide-y divide-ink-100">
                    {recentNotes.map((log) => (
                      <Link
                        key={log.id}
                        to={`/daily-log?edit=${log.id}`}
                        className="flex items-start gap-2.5 px-4 py-3 hover:bg-ink-50/60"
                      >
                        <StickyNote className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs text-ink-500">
                            <span className="font-medium text-ink-700">{log.profile?.full_name ?? 'Unknown'}</span>
                            {' · '}
                            {log.client?.name ?? '—'}
                            {' · '}
                            {formatDate(log.production_date)}
                          </p>
                          <p className="text-sm text-ink-800 mt-0.5 line-clamp-3">{log.notes}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
