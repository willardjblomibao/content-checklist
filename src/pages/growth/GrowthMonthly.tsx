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

const QUARTER_OF: Record<string, number> = MONTH_NAMES.reduce((acc, m, i) => {
  acc[m] = Math.floor(i / 3) + 1
  return acc
}, {} as Record<string, number>)

export default function GrowthMonthly() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1)
  const [rows, setRows] = useState<WeeklyMetric[]>([])
  const [loading, setLoading] = useState(true)

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
    supabase
      .from('weekly_metrics')
      .select('*')
      .eq('client_id', clientId)
      .in('year', [year, compareYear])
      .then(({ data }) => {
        setRows((data ?? []) as WeeklyMetric[])
        setLoading(false)
      })
  }, [clientId, year, compareYear])

  const availableYears = useMemo(() => {
    const s = new Set(rows.map((r) => r.year))
    s.add(year)
    s.add(compareYear)
    return Array.from(s).sort((a, b) => b - a)
  }, [rows, year, compareYear])

  const monthly = useMemo(() => {
    return MONTH_NAMES.map((month) => {
      const current = rows.filter((r) => r.year === year && r.month === month)
      const prior = rows.filter((r) => r.year === compareYear && r.month === month)
      const sum = (list: WeeklyMetric[], key: 'views' | 'new_audience') => list.reduce((s, r) => s + r[key], 0)
      return {
        month,
        quarter: `Q${QUARTER_OF[month]}`,
        [`${year}`]: sum(current, 'views'),
        [`${compareYear}`]: sum(prior, 'views'),
        currentAudience: sum(current, 'new_audience'),
        priorAudience: sum(prior, 'new_audience'),
      }
    })
  }, [rows, year, compareYear])

  const quarterly = useMemo(() => {
    const q: Record<string, { quarter: string; current: number; prior: number }> = {}
    for (const m of monthly) {
      const key = m.quarter
      if (!q[key]) q[key] = { quarter: key, current: 0, prior: 0 }
      q[key].current += (m as any)[`${year}`]
      q[key].prior += (m as any)[`${compareYear}`]
    }
    return Object.values(q)
  }, [monthly, year, compareYear])

  const totalCurrent = monthly.reduce((s, m) => s + (m as any)[`${year}`], 0)
  const totalPrior = monthly.reduce((s, m) => s + (m as any)[`${compareYear}`], 0)
  const yoyPct = totalPrior > 0 ? (((totalCurrent - totalPrior) / totalPrior) * 100).toFixed(1) : null

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
          <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year, year - 1, year - 2].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <span className="text-xs text-ink-400">vs</span>
          <Select className="w-28" value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))}>
            {[compareYear, compareYear + 1, compareYear - 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-xs font-medium text-ink-500">{year} Total Views</p>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalCurrent.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-ink-500">{compareYear} Total Views</p>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalPrior.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-ink-500">Year-over-Year</p>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{yoyPct === null ? '—' : `${Number(yoyPct) >= 0 ? '+' : ''}${yoyPct}%`}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-800 mb-4">Monthly Views — {year} vs {compareYear}</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m: string) => m.slice(0, 3)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={`${year}`} name={`${year}`} fill="#2F6B4F" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`${compareYear}`} name={`${compareYear}`} fill="#D97757" radius={[4, 4, 0, 0]} />
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
                    <th className="px-3 py-3 text-right">{year} Views</th>
                    <th className="px-3 py-3 text-right">{compareYear} Views</th>
                    <th className="px-5 py-3 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterly.map((q) => {
                    const change = q.prior > 0 ? (((q.current - q.prior) / q.prior) * 100).toFixed(1) : null
                    return (
                      <tr key={q.quarter} className="border-b border-ink-50 last:border-0">
                        <td className="px-5 py-3 font-medium text-ink-900">{q.quarter}</td>
                        <td className="px-3 py-3 text-right text-ink-600">{q.current.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-ink-600">{q.prior.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-ink-600">
                          {change === null ? '—' : `${Number(change) >= 0 ? '+' : ''}${change}%`}
                        </td>
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
                    <th className="px-3 py-3 text-right">{year} Views</th>
                    <th className="px-3 py-3 text-right">{compareYear} Views</th>
                    <th className="px-3 py-3 text-right">{year} New Audience</th>
                    <th className="px-5 py-3 text-right">{compareYear} New Audience</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-ink-900">{m.month}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{((m as any)[`${year}`] as number).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{((m as any)[`${compareYear}`] as number).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{m.currentAudience.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-ink-600">{m.priorAudience.toLocaleString()}</td>
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
