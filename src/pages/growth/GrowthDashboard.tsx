import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Eye, Users, Sparkles, PlusSquare, Calendar, Radio, Trophy, Gauge, Flame, Target } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Card, EmptyState, PageSpinner, Select } from '../../components/ui/primitives'
import type { Client, Platform, WeeklyMetric } from '../../types/database'
import { formatDate } from '../../lib/utils'

type Row = WeeklyMetric & { platform: Pick<Platform, 'id' | 'name' | 'color'> | null }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function GrowthDashboard() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [platformFilter, setPlatformFilter] = useState('') // '' = ALL
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [monthFrom, setMonthFrom] = useState(1)
  const [monthTo, setMonthTo] = useState(12)
  const [rows, setRows] = useState<Row[]>([])
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
          setClientId((current) => current || list[0]?.id || '')
        })
    } else {
      // Employees pick among every client assigned to them — no access to anything else.
      setClientId((current) => (current && assignedClients.some((c) => c.id === current) ? current : assignedClients[0]?.id ?? ''))
    }
  }, [isAdmin, assignedClients])

  useEffect(() => {
    if (!clientId) {
      setPlatforms([])
      return
    }
    supabase
      .from('platforms')
      .select('*')
      .eq('client_id', clientId)
      .order('name')
      .then(({ data }) => setPlatforms((data ?? []) as Platform[]))
  }, [clientId])

  useEffect(() => {
    if (!clientId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('weekly_metrics')
      .select('*, platform:platforms(id, name, color)')
      .eq('client_id', clientId)
    if (year !== 'all') query = query.eq('year', Number(year))
    query.order('week_start').then(({ data }) => {
      setRows((data ?? []) as unknown as Row[])
      setLoading(false)
    })
  }, [clientId, year])

  const selectedClient = isAdmin
    ? clients.find((c) => c.id === clientId) ?? null
    : assignedClients.find((c) => c.id === clientId) ?? null

  const monthOf = (isoDate: string) => Number(isoDate.slice(5, 7))

  // Rows within the Month from/to window, still ALL platforms — used for the
  // platform breakdown, which per the original workbook always shows every
  // platform regardless of the Platform filter above.
  const rowsInMonthRange = useMemo(
    () => rows.filter((r) => monthOf(r.week_start) >= monthFrom && monthOf(r.week_start) <= monthTo),
    [rows, monthFrom, monthTo]
  )

  // Same window, narrowed to the chosen platform (or everything if ALL) —
  // this is what every KPI and the weekly trend chart read.
  const filteredRows = useMemo(
    () => (platformFilter ? rowsInMonthRange.filter((r) => r.platform_id === platformFilter) : rowsInMonthRange),
    [rowsInMonthRange, platformFilter]
  )

  const weekBuckets = useMemo(() => {
    const map = new Map<string, { week_start: string; views: number; new_audience: number }>()
    for (const r of filteredRows) {
      const bucket = map.get(r.week_start) ?? { week_start: r.week_start, views: 0, new_audience: 0 }
      bucket.views += r.views
      bucket.new_audience += r.new_audience
      map.set(r.week_start, bucket)
    }
    return Array.from(map.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))
  }, [filteredRows])

  const trendData = weekBuckets.map((w) => ({
    week: formatDate(w.week_start, 'MMM d'),
    Views: w.views,
    'New Audience': w.new_audience,
  }))

  // Platform breakdown — always ALL platforms, ignores the Platform filter (matches DASHBOARD sheet).
  const platformTotals = useMemo(() => {
    const map = new Map<string, { name: string; color: string; views: number; audience: number }>()
    for (const r of rowsInMonthRange) {
      if (!r.platform) continue
      const entry = map.get(r.platform.id) ?? { name: r.platform.name, color: r.platform.color, views: 0, audience: 0 }
      entry.views += r.views
      entry.audience += r.new_audience
      map.set(r.platform.id, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.views - a.views)
  }, [rowsInMonthRange])

  // ---- The 12 KPIs, same set as the DASHBOARD sheet ----
  const totalViews = filteredRows.reduce((s, r) => s + r.views, 0)
  const totalAudience = filteredRows.reduce((s, r) => s + r.new_audience, 0)
  const viewsPerFollower = totalAudience !== 0 ? totalViews / totalAudience : null
  const bestPlatform = platformTotals[0]?.name ?? '—'
  const weeksLogged = weekBuckets.filter((w) => w.views > 0).length
  const avgViewsPerWeek = weeksLogged > 0 ? totalViews / weeksLogged : 0
  const avgAudiencePerWeek = weeksLogged > 0 ? totalAudience / weeksLogged : 0
  const bestWeek = weekBuckets.reduce((max, w) => Math.max(max, w.views), 0)
  const platformsActive = platformTotals.filter((p) => p.views > 0).length

  const bestMonth = useMemo(() => {
    const byMonth = new Map<number, number>()
    for (const r of filteredRows) {
      const m = monthOf(r.week_start)
      byMonth.set(m, (byMonth.get(m) ?? 0) + r.views)
    }
    let best: { month: number; views: number } | null = null
    for (const [m, v] of byMonth) {
      if (!best || v > best.views) best = { month: m, views: v }
    }
    return best ? `${MONTHS[best.month - 1]} (${best.views.toLocaleString()})` : '—'
  }, [filteredRows])

  // Peak Audience / Audience Added — running follower totals, respecting the
  // Platform filter but (same as the workbook) using the whole selected year,
  // not the Month from/to window, since it's a cumulative figure.
  const { peakAudience, audienceAdded } = useMemo(() => {
    const source = platformFilter ? rows.filter((r) => r.platform_id === platformFilter) : rows
    const byWeek = new Map<string, number>()
    for (const r of source) {
      if (r.total_audience == null) continue
      byWeek.set(r.week_start, (byWeek.get(r.week_start) ?? 0) + r.total_audience)
    }
    const values = Array.from(byWeek.values())
    if (values.length === 0) return { peakAudience: null, audienceAdded: null }
    const peak = Math.max(...values)
    const added = peak - Math.min(...values)
    return { peakAudience: peak, audienceAdded: added }
  }, [rows, platformFilter])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Growth Dashboard</h1>
          <p className="text-sm text-ink-500 mt-1">
            {selectedClient ? `Views and audience growth for ${selectedClient.name}` : 'Reach and audience growth across platforms'}
          </p>
        </div>
        <Link to="/growth/input">
          <Button size="lg">
            <PlusSquare className="h-4 w-4" />
            Add Weekly Data
          </Button>
        </Link>
      </div>

      {!isAdmin && selectedClient && (
        <div className="inline-flex items-center gap-2 self-start text-xs font-medium text-pine-700 bg-pine-50 px-3 py-1.5 rounded-full">
          Client: {selectedClient.name}
        </div>
      )}

      {/* The five filters — Client, Year, Platform, Month from, Month to */}
      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          {isAdmin && clients.length > 0 && (
            <FilterField label="Client">
              <Select className="w-48" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          {!isAdmin && assignedClients.length > 1 && (
            <FilterField label="Client">
              <Select className="w-48" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {assignedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          <FilterField label="Year">
            <Select className="w-24" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="all">ALL</option>
              {[Number(year) || new Date().getFullYear(), Number(year) - 1, Number(year) - 2, Number(year) + 1]
                .filter((v, i, a) => !Number.isNaN(v) && a.indexOf(v) === i)
                .sort((a, b) => b - a)
                .map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
            </Select>
          </FilterField>
          <FilterField label="Platform">
            <Select className="w-40" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="">ALL</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Month from">
            <Select className="w-36" value={monthFrom} onChange={(e) => setMonthFrom(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Month to">
            <Select className="w-36" value={monthTo} onChange={(e) => setMonthTo(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
      </Card>

      {loading ? (
        <PageSpinner />
      ) : isAdmin && clients.length === 0 ? (
        <EmptyState title="No clients yet" description="Add a client from the Clients page to start tracking growth." />
      ) : !isAdmin && assignedClients.length === 0 ? (
        <EmptyState
          title="No client assigned yet"
          description="Ask an admin to assign you to a client from the Team page before you can log growth data."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No growth data for ${year === 'all' ? 'any year' : year} yet`}
          description="Add this client's weekly views and audience numbers, or pick a different year above."
          action={
            <Link to="/growth/input">
              <Button>
                <PlusSquare className="h-4 w-4" />
                Add Weekly Data
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Eye} label="Total Views" value={totalViews.toLocaleString()} />
            <KpiCard icon={Users} label="New Audience" value={totalAudience.toLocaleString()} />
            <KpiCard icon={Gauge} label="Views per Follower" value={viewsPerFollower === null ? '—' : viewsPerFollower.toFixed(1)} />
            <KpiCard icon={Calendar} label="Best Month" value={bestMonth} />
            <KpiCard icon={Sparkles} label="Best Platform" value={bestPlatform} />
            <KpiCard icon={Radio} label="Weeks Logged" value={String(weeksLogged)} />
            <KpiCard icon={TrendingUp} label="Avg Views / Week" value={Math.round(avgViewsPerWeek).toLocaleString()} />
            <KpiCard icon={Users} label="Avg Audience / Week" value={Math.round(avgAudiencePerWeek).toLocaleString()} />
            <KpiCard icon={Trophy} label="Best Week" value={bestWeek.toLocaleString()} />
            <KpiCard icon={Flame} label="Peak Audience" value={peakAudience === null ? '—' : peakAudience.toLocaleString()} />
            <KpiCard icon={Target} label="Audience Added" value={audienceAdded === null ? '—' : audienceAdded.toLocaleString()} />
            <KpiCard icon={Radio} label="Platforms Active" value={String(platformsActive)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-800 mb-4">
                Weekly Views &amp; Audience{platformFilter ? ` — ${platforms.find((p) => p.id === platformFilter)?.name ?? ''}` : ''}
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Views" stroke="#2F6B4F" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="New Audience" stroke="#D97757" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-800 mb-4">Platform Comparison (all platforms)</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformTotals} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="views" name="Views" radius={[6, 6, 0, 0]}>
                      {platformTotals.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-800">Platform Breakdown (all platforms)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Platform</th>
                    <th className="px-3 py-3 text-right">Views</th>
                    <th className="px-3 py-3 text-right">New Audience</th>
                    <th className="px-5 py-3 text-right">Share of Views</th>
                  </tr>
                </thead>
                <tbody>
                  {platformTotals.map((p) => {
                    const allViews = platformTotals.reduce((s, x) => s + x.views, 0)
                    return (
                      <tr key={p.name} className="border-b border-ink-50 last:border-0">
                        <td className="px-5 py-3 font-medium text-ink-900">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-ink-600">{p.views.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-ink-600">{p.audience.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-ink-600">
                          {allViews > 0 ? `${((p.views / allViews) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-ink-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-ink-900 mt-2 truncate">{value}</p>
    </Card>
  )
}
