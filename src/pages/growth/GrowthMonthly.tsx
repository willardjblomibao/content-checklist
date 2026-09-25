import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, EmptyState, PageSpinner, Select } from '../../components/ui/primitives'
import type { Client, WeeklyMetric } from '../../types/database'
import { MONTH_NAMES } from '../../types/database'
import { cn } from '../../lib/utils'

const QUARTER_OF: Record<string, number> = MONTH_NAMES.reduce((acc, m, i) => {
  acc[m] = Math.floor(i / 3) + 1
  return acc
}, {} as Record<string, number>)

export default function GrowthMonthly() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1)
  const [rows, setRows] = useState<WeeklyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const showCompare = year !== 'all'

  useEffect(() => {
    if (isAdmin) {
      supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name')
        .then(({ data }) => {
          const list = (data ?? []) as Client[]
          setClients(list)
          setClientId((c) => c || list[0]?.id || '')
        })
    } else {
      setClientId((c) => (c && assignedClients.some((a) => a.id === c) ? c : assignedClients[0]?.id ?? ''))
    }
  }, [isAdmin, assignedClients])

  useEffect(() => {
    if (!clientId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase.from('weekly_metrics').select('*').eq('client_id', clientId)
    if (year !== 'all') query = query.in('year', [Number(year), compareYear])
    query.then(({ data }) => {
      setRows((data ?? []) as WeeklyMetric[])
      setLoading(false)
    })
  }, [clientId, year, compareYear])

  const monthly = useMemo(() => {
    const sum = (list: WeeklyMetric[], key: 'views' | 'new_audience') => list.reduce((s, r) => s + r[key], 0)
    return MONTH_NAMES.map((month) => {
      const current = year === 'all' ? rows.filter((r) => r.month === month) : rows.filter((r) => r.year === Number(year) && r.month === month)
      const prior = showCompare ? rows.filter((r) => r.year === compareYear && r.month === month) : []
      return {
        month,
        quarter: `Q${QUARTER_OF[month]}`,
        current: sum(current, 'views'),
        prior: sum(prior, 'views'),
        currentAudience: sum(current, 'new_audience'),
        priorAudience: sum(prior, 'new_audience'),
      }
    })
  }, [rows, year, compareYear, showCompare])

  const quarterly = useMemo(() => {
    const q: Record<string, { quarter: string; current: number; prior: number }> = {}
    for (const m of monthly) {
      const key = m.quarter
      if (!q[key]) q[key] = { quarter: key, current: 0, prior: 0 }
      q[key].current += m.current
      q[key].prior += m.prior
    }
    return Object.values(q)
  }, [monthly])

  const totalCurrent = monthly.reduce((s, m) => s + m.current, 0)
  const totalPrior = monthly.reduce((s, m) => s + m.prior, 0)
  const yoyPct = showCompare && totalPrior > 0 ? (((totalCurrent - totalPrior) / totalPrior) * 100).toFixed(1) : null
  const yearLabel = year === 'all' ? 'All Years' : year

  const selectedClientName = isAdmin
    ? clients.find((c) => c.id === clientId)?.name ?? ''
    : assignedClients.find((c) => c.id === clientId)?.name ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Monthly Summary</h1>
          <p className="text-sm text-ink-500 mt-1">
            {selectedClientName ? `Month, quarter and year-over-year views for ${selectedClientName}` : 'Month, quarter and year-over-year growth'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && clients.length > 0 && (
            <Select className="w-48" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {!isAdmin && assignedClients.length > 1 && (
            <Select className="w-48" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {assignedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <Select className="w-28" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">ALL</option>
            {[Number(year) || new Date().getFullYear(), Number(year) - 1, Number(year) - 2]
              .filter((v, i, a) => !Number.isNaN(v) && a.indexOf(v) === i)
              .map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
          </Select>
          {showCompare && (
            <>
              <span className="text-xs text-ink-400">vs</span>
              <Select className="w-28" value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))}>
                {[compareYear, compareYear + 1, compareYear - 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <PageSpinner />
      ) : !clientId ? (
        <EmptyState
          title={isAdmin ? 'No client selected' : 'No client assigned yet'}
          description={isAdmin ? 'Pick a client to see its monthly summary.' : 'Ask an admin to assign you to a client from the Team page.'}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No data for these years yet" description="Add weekly growth data first from the Weekly Growth page." />
      ) : (
        <>
          <div className={cn('grid grid-cols-1 gap-4', showCompare ? 'sm:grid-cols-3' : 'sm:grid-cols-1 max-w-xs')}>
            <Card className="p-4">
              <p className="text-xs font-medium text-ink-500">{yearLabel} Total Views</p>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalCurrent.toLocaleString()}</p>
            </Card>
            {showCompare && (
              <>
                <Card className="p-4">
                  <p className="text-xs font-medium text-ink-500">{compareYear} Total Views</p>
                  <p className="text-2xl font-semibold text-ink-900 mt-2">{totalPrior.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-medium text-ink-500">Year-over-Year</p>
                  <p className="text-2xl font-semibold text-ink-900 mt-2">{yoyPct === null ? '—' : `${Number(yoyPct) >= 0 ? '+' : ''}${yoyPct}%`}</p>
                </Card>
              </>
            )}
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-800 mb-4">
              Monthly Views {showCompare ? `— ${yearLabel} vs ${compareYear}` : `— ${yearLabel}`}
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m: string) => m.slice(0, 3)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="current" name={`${yearLabel}`} fill="#2F6B4F" radius={[4, 4, 0, 0]} />
                  {showCompare && <Bar dataKey="prior" name={`${compareYear}`} fill="#D97757" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-800">Quarterly Rollup</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Quarter</th>
                    <th className="px-3 py-3 text-right">{yearLabel} Views</th>
                    {showCompare && <th className="px-3 py-3 text-right">{compareYear} Views</th>}
                    {showCompare && <th className="px-5 py-3 text-right">Change</th>}
                  </tr>
                </thead>
                <tbody>
                  {quarterly.map((q) => {
                    const change = q.prior > 0 ? (((q.current - q.prior) / q.prior) * 100).toFixed(1) : null
                    return (
                      <tr key={q.quarter} className="border-b border-ink-50 last:border-0">
                        <td className="px-5 py-3 font-medium text-ink-900">{q.quarter}</td>
                        <td className="px-3 py-3 text-right text-ink-600">{q.current.toLocaleString()}</td>
                        {showCompare && <td className="px-3 py-3 text-right text-ink-600">{q.prior.toLocaleString()}</td>}
                        {showCompare && (
                          <td className="px-5 py-3 text-right text-ink-600">
                            {change === null ? '—' : `${Number(change) >= 0 ? '+' : ''}${change}%`}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-800">Monthly Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Month</th>
                    <th className="px-3 py-3 text-right">{yearLabel} Views</th>
                    {showCompare && <th className="px-3 py-3 text-right">{compareYear} Views</th>}
                    <th className="px-3 py-3 text-right">{yearLabel} New Audience</th>
                    {showCompare && <th className="px-5 py-3 text-right">{compareYear} New Audience</th>}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-ink-900">{m.month}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{m.current.toLocaleString()}</td>
                      {showCompare && <td className="px-3 py-3 text-right text-ink-600">{m.prior.toLocaleString()}</td>}
                      <td className="px-3 py-3 text-right text-ink-600">{m.currentAudience.toLocaleString()}</td>
                      {showCompare && <td className="px-5 py-3 text-right text-ink-600">{m.priorAudience.toLocaleString()}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
