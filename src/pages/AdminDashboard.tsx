import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePresence } from '../contexts/PresenceContext'
import { KpiCards, RangeSwitcher, type RangeKey } from '../components/dashboard/KpiCards'
import { Button, Card, EmptyState, PageSpinner } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, type Profile, type ProductionLogWithRelations } from '../types/database'
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
        </>
      )}
    </div>
  )
}
