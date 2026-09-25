import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Papa from 'papaparse'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Download, Printer, FileWarning, Eye, Users, Sparkles, Calendar, Radio,
  Trophy, Gauge, Flame, Target, TrendingUp, Zap, Video, Clock, GitCompare, Crown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, EmptyState, PageSpinner, Select } from '../components/ui/primitives'
import { MONTH_NAMES } from '../types/database'
import { cn, formatDate, mondayOfISO, pearsonCorrelation, describeCorrelation } from '../lib/utils'

const MONTHS = MONTH_NAMES as unknown as string[]
const QUARTER_OF: Record<string, number> = MONTH_NAMES.reduce((acc, m, i) => {
  acc[m] = Math.floor(i / 3) + 1
  return acc
}, {} as Record<string, number>)

interface GrowthPlatform {
  id: string
  name: string
  icon: string
  color: string
  active: boolean
}

interface GrowthMetricRow {
  id: string
  platform_id: string
  platform_name: string
  platform_color: string
  week_start: string
  year: number
  month: string
  week: number
  views: number
  new_audience: number
  total_audience: number | null
}

interface ProductionSummaryRow {
  production_date: string
  videos_edited_count: number
  videos_reedited_count: number
  carousels_edited_count: number
  carousels_reedited_count: number
  text_posts_prepared_count: number
  text_posts_reedited_count: number
}

type TabId = 'dashboard' | 'monthly' | 'correlation' | 'compare'
const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'monthly', label: 'Monthly Summary' },
  { id: 'correlation', label: 'Content Impact' },
  { id: 'compare', label: 'Platform vs Platform' },
]

/**
 * Standalone, unauthenticated page: rendered outside <ProtectedRoute> and
 * <AppLayout> so there's no login gate and no admin nav — access is
 * entirely governed by the token in the URL. Nothing here touches
 * platforms/weekly_metrics/production_logs directly; all three loads go
 * through security-definer RPCs scoped to this one token's client. See
 * supabase/migrations/006_client_share_links.sql and
 * supabase/migrations/007_client_growth_report.sql.
 */
export default function ClientReport() {
  const { token } = useParams<{ token: string }>()

  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [clientName, setClientName] = useState('')
  const [platforms, setPlatforms] = useState<GrowthPlatform[]>([])
  const [metrics, setMetrics] = useState<GrowthMetricRow[]>([])
  const [production, setProduction] = useState<ProductionSummaryRow[]>([])
  const [tab, setTab] = useState<TabId>('dashboard')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    supabase
      .rpc('get_client_report_info', { p_token: token })
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : null
        if (error || !row) {
          setStatus('invalid')
          return
        }
        setClientName(row.client_name)
        Promise.all([
          supabase.rpc('get_client_growth_platforms', { p_token: token }),
          supabase.rpc('get_client_growth_weekly_metrics', { p_token: token }),
          supabase.rpc('get_client_growth_production_summary', { p_token: token }),
        ]).then(([p, m, s]) => {
          setPlatforms((p.data ?? []) as GrowthPlatform[])
          setMetrics((m.data ?? []) as GrowthMetricRow[])
          setProduction((s.data ?? []) as ProductionSummaryRow[])
          setStatus('ready')
        })
      })
  }, [token])

  function handlePrint() {
    window.print()
  }

  if (status === 'loading') return <PageSpinner />

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <Card className="max-w-sm w-full p-8 text-center">
          <FileWarning className="h-8 w-8 text-clay-600 mx-auto mb-3" />
          <h1 className="text-base font-semibold text-ink-900">This link isn't available</h1>
          <p className="text-sm text-ink-500 mt-2">
            It may have been revoked or the link is incomplete. Ask your agency contact for a fresh link.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-50 print:bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{clientName} — Growth Report</h1>
            <p className="text-sm text-ink-500 mt-1">View-only · filter, export, or print any section below</p>
          </div>
          <Button size="sm" onClick={handlePrint} className="print:hidden">
            <Printer className="h-3.5 w-3.5" />
            Print this view
          </Button>
        </div>

        <div className="flex gap-1 border-b border-ink-100 print:hidden overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                tab === t.id ? 'border-pine-600 text-pine-700' : 'border-transparent text-ink-500 hover:text-ink-800'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {metrics.length === 0 && production.length === 0 ? (
          <EmptyState title="No growth data yet" description="Your agency hasn't logged any weekly growth data for this period yet." />
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab metrics={metrics} platforms={platforms} clientName={clientName} />}
            {tab === 'monthly' && <MonthlyTab metrics={metrics} />}
            {tab === 'correlation' && <CorrelationTab metrics={metrics} production={production} />}
            {tab === 'compare' && <CompareTab metrics={metrics} platforms={platforms} clientName={clientName} />}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Dashboard — same 12 KPIs, weekly trend, and platform breakdown as the
// admin Growth Dashboard, computed from the token-scoped rows.
// ---------------------------------------------------------------------
function DashboardTab({
  metrics,
  platforms,
  clientName,
}: {
  metrics: GrowthMetricRow[]
  platforms: GrowthPlatform[]
  clientName: string
}) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [platformFilter, setPlatformFilter] = useState('')
  const [monthFrom, setMonthFrom] = useState(1)
  const [monthTo, setMonthTo] = useState(12)

  const years = useMemo(() => Array.from(new Set(metrics.map((m) => m.year))).sort((a, b) => b - a), [metrics])
  const monthOf = (iso: string) => Number(iso.slice(5, 7))

  const rowsForYear = useMemo(() => metrics.filter((m) => m.year === year), [metrics, year])
  const rowsInMonthRange = useMemo(
    () => rowsForYear.filter((r) => monthOf(r.week_start) >= monthFrom && monthOf(r.week_start) <= monthTo),
    [rowsForYear, monthFrom, monthTo]
  )
  const filteredRows = useMemo(
    () => (platformFilter ? rowsInMonthRange.filter((r) => r.platform_id === platformFilter) : rowsInMonthRange),
    [rowsInMonthRange, platformFilter]
  )

  const weekBuckets = useMemo(() => {
    const map = new Map<string, { week_start: string; views: number; new_audience: number }>()
    for (const r of filteredRows) {
      const b = map.get(r.week_start) ?? { week_start: r.week_start, views: 0, new_audience: 0 }
      b.views += r.views
      b.new_audience += r.new_audience
      map.set(r.week_start, b)
    }
    return Array.from(map.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))
  }, [filteredRows])

  const trendData = weekBuckets.map((w) => ({ week: formatDate(w.week_start, 'MMM d'), Views: w.views, 'New Audience': w.new_audience }))

  const platformTotals = useMemo(() => {
    const map = new Map<string, { name: string; color: string; views: number; audience: number }>()
    for (const r of rowsInMonthRange) {
      const entry = map.get(r.platform_id) ?? { name: r.platform_name, color: r.platform_color, views: 0, audience: 0 }
      entry.views += r.views
      entry.audience += r.new_audience
      map.set(r.platform_id, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.views - a.views)
  }, [rowsInMonthRange])

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
    for (const r of filteredRows) byMonth.set(monthOf(r.week_start), (byMonth.get(monthOf(r.week_start)) ?? 0) + r.views)
    let best: { month: number; views: number } | null = null
    for (const [m, v] of byMonth) if (!best || v > best.views) best = { month: m, views: v }
    return best ? `${MONTHS[best.month - 1]} (${best.views.toLocaleString()})` : '—'
  }, [filteredRows])

  const { peakAudience, audienceAdded } = useMemo(() => {
    const source = platformFilter ? rowsForYear.filter((r) => r.platform_id === platformFilter) : rowsForYear
    const byWeek = new Map<string, number>()
    for (const r of source) {
      if (r.total_audience == null) continue
      byWeek.set(r.week_start, (byWeek.get(r.week_start) ?? 0) + r.total_audience)
    }
    const values = Array.from(byWeek.values())
    if (values.length === 0) return { peakAudience: null, audienceAdded: null }
    return { peakAudience: Math.max(...values), audienceAdded: Math.max(...values) - Math.min(...values) }
  }, [rowsForYear, platformFilter])

  function exportCsv() {
    const rows = weekBuckets.map((w) => ({ Week: w.week_start, Views: w.views, 'New Audience': w.new_audience }))
    downloadCsv(rows, `${clientName}-growth-dashboard-${year}.csv`)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4 print:hidden">
        <div className="flex items-end gap-3 flex-wrap">
          <FilterField label="Year">
            <Select className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {(years.length ? years : [year]).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Platform">
            <Select className="w-40" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="">ALL</option>
              {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Month from">
            <Select className="w-36" value={monthFrom} onChange={(e) => setMonthFrom(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Month to">
            <Select className="w-36" value={monthTo} onChange={(e) => setMonthTo(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </FilterField>
          <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </Card>

      {filteredRows.length === 0 ? (
        <EmptyState title={`No data for ${year} yet`} description="Try a different year or widen the month range above." />
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
              <h2 className="text-sm font-semibold text-ink-800 mb-4">Weekly Views &amp; Audience</h2>
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
                      {platformTotals.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-800">Platform Breakdown</h2>
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
                        <td className="px-5 py-3 text-right text-ink-600">{allViews > 0 ? `${((p.views / allViews) * 100).toFixed(1)}%` : '—'}</td>
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

// ---------------------------------------------------------------------
// Monthly Summary — year vs. comparison year, month + quarter rollups.
// ---------------------------------------------------------------------
function MonthlyTab({ metrics }: { metrics: GrowthMetricRow[] }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1)
  const years = useMemo(() => Array.from(new Set(metrics.map((m) => m.year))).sort((a, b) => b - a), [metrics])

  const rows = useMemo(() => metrics.filter((r) => r.year === year || r.year === compareYear), [metrics, year, compareYear])

  const monthly = useMemo(() => {
    return MONTH_NAMES.map((month) => {
      const current = rows.filter((r) => r.year === year && r.month === month)
      const prior = rows.filter((r) => r.year === compareYear && r.month === month)
      const sum = (list: GrowthMetricRow[], key: 'views' | 'new_audience') => list.reduce((s, r) => s + r[key], 0)
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
      if (!q[m.quarter]) q[m.quarter] = { quarter: m.quarter, current: 0, prior: 0 }
      q[m.quarter].current += (m as any)[`${year}`]
      q[m.quarter].prior += (m as any)[`${compareYear}`]
    }
    return Object.values(q)
  }, [monthly, year, compareYear])

  const totalCurrent = monthly.reduce((s, m) => s + (m as any)[`${year}`], 0)
  const totalPrior = monthly.reduce((s, m) => s + (m as any)[`${compareYear}`], 0)
  const yoyPct = totalPrior > 0 ? (((totalCurrent - totalPrior) / totalPrior) * 100).toFixed(1) : null

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4 print:hidden">
        <div className="flex items-end gap-3 flex-wrap">
          <FilterField label="Year">
            <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {(years.length ? years : [year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FilterField>
          <span className="text-xs text-ink-400 pb-2">vs</span>
          <FilterField label="Compare to">
            <Select className="w-28" value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))}>
              {(years.length ? years : [compareYear]).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FilterField>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No data for these years yet" description="Try different years above." />
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
            <div className="px-5 py-4 border-b border-ink-100"><h2 className="text-sm font-semibold text-ink-800">Quarterly Rollup</h2></div>
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
                        <td className="px-5 py-3 text-right text-ink-600">{change === null ? '—' : `${Number(change) >= 0 ? '+' : ''}${change}%`}</td>
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

// ---------------------------------------------------------------------
// Content Impact — correlates weekly content output (from production
// logs) against weekly views/audience growth. Same-week and next-week
// Pearson correlation, same as the admin Content Correlation page.
// ---------------------------------------------------------------------
function CorrelationTab({ metrics, production }: { metrics: GrowthMetricRow[]; production: ProductionSummaryRow[] }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const years = useMemo(
    () => Array.from(new Set([...metrics.map((m) => m.year), ...production.map((p) => Number(p.production_date.slice(0, 4)))])).sort((a, b) => b - a),
    [metrics, production]
  )

  const weeks = useMemo(() => {
    const byWeek = new Map<string, { week_start: string; contentItems: number; videos: number; carousels: number; textPosts: number; views: number; new_audience: number }>()
    for (const log of production) {
      if (Number(log.production_date.slice(0, 4)) !== year) continue
      const week_start = mondayOfISO(log.production_date)
      const row = byWeek.get(week_start) ?? { week_start, contentItems: 0, videos: 0, carousels: 0, textPosts: 0, views: 0, new_audience: 0 }
      const videos = (log.videos_edited_count ?? 0) + (log.videos_reedited_count ?? 0)
      const carousels = (log.carousels_edited_count ?? 0) + (log.carousels_reedited_count ?? 0)
      const textPosts = (log.text_posts_prepared_count ?? 0) + (log.text_posts_reedited_count ?? 0)
      row.videos += videos
      row.carousels += carousels
      row.textPosts += textPosts
      row.contentItems += videos + carousels + textPosts
      byWeek.set(week_start, row)
    }
    for (const m of metrics) {
      if (m.year !== year) continue
      const row = byWeek.get(m.week_start) ?? { week_start: m.week_start, contentItems: 0, videos: 0, carousels: 0, textPosts: 0, views: 0, new_audience: 0 }
      row.views += m.views
      row.new_audience += m.new_audience
      byWeek.set(m.week_start, row)
    }
    return Array.from(byWeek.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))
  }, [metrics, production, year])

  const sameWeekR = useMemo(() => pearsonCorrelation(weeks.map((w) => w.contentItems), weeks.map((w) => w.views)), [weeks])
  const laggedR = useMemo(() => {
    if (weeks.length < 4) return null
    return pearsonCorrelation(weeks.slice(0, -1).map((w) => w.contentItems), weeks.slice(1).map((w) => w.views))
  }, [weeks])

  const totalContent = weeks.reduce((s, w) => s + w.contentItems, 0)
  const totalViews = weeks.reduce((s, w) => s + w.views, 0)
  const bestContentWeek = weeks.reduce((best, w) => (w.contentItems > (best?.contentItems ?? -1) ? w : best), null as (typeof weeks)[number] | null)
  const bestGrowthWeek = weeks.reduce((best, w) => (w.views > (best?.views ?? -1) ? w : best), null as (typeof weeks)[number] | null)
  const weeksWithBoth = weeks.filter((w) => w.contentItems > 0 || w.views > 0)
  const chartData = weeks.map((w) => ({ week: formatDate(w.week_start, 'MMM d'), 'Content Items': w.contentItems, Views: w.views }))

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4 print:hidden">
        <FilterField label="Year">
          <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {(years.length ? years : [year]).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </FilterField>
      </Card>

      {weeksWithBoth.length < 3 ? (
        <EmptyState title="Not enough data yet" description="This view needs at least a few weeks of both content and growth data for the same year." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500"><Zap className="h-4 w-4" /><span className="text-xs font-medium">Same-Week Correlation</span></div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{sameWeekR === null ? '—' : sameWeekR.toFixed(2)}</p>
              <p className="text-xs text-ink-500 mt-1">{describeCorrelation(sameWeekR)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Next-Week Correlation</span></div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{laggedR === null ? '—' : laggedR.toFixed(2)}</p>
              <p className="text-xs text-ink-500 mt-1">{describeCorrelation(laggedR)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500"><Video className="h-4 w-4" /><span className="text-xs font-medium">Total Content Items</span></div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalContent.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500"><TrendingUp className="h-4 w-4" /><span className="text-xs font-medium">Total Views</span></div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalViews.toLocaleString()}</p>
            </Card>
          </div>

          <Card className="p-4 bg-pine-50 border-pine-100">
            <p className="text-sm text-pine-800">
              <strong>Reading this:</strong> Same-week correlation checks if busier content weeks line up with more
              views that same week. Next-week correlation checks for a delayed payoff. A number near <strong>+1</strong>{' '}
              means they move together strongly; near <strong>0</strong> means little relationship; negative means
              they move in opposite directions.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-800 mb-4">Content Output vs. Views, Week by Week</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Content Items" fill="#D97757" radius={[4, 4, 0, 0]} barSize={18} />
                  <Line yAxisId="right" type="monotone" dataKey="Views" stroke="#2F6B4F" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Busiest Content Week</h2>
              {bestContentWeek ? (
                <div>
                  <p className="text-lg font-semibold text-ink-900">{formatDate(bestContentWeek.week_start)}</p>
                  <p className="text-sm text-ink-500 mt-1">
                    {bestContentWeek.contentItems} items ({bestContentWeek.videos} video, {bestContentWeek.carousels} carousel,{' '}
                    {bestContentWeek.textPosts} text) · {bestContentWeek.views.toLocaleString()} views that week
                  </p>
                </div>
              ) : <p className="text-sm text-ink-400">No data</p>}
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-pine-600" />Best Growth Week</h2>
              {bestGrowthWeek ? (
                <div>
                  <p className="text-lg font-semibold text-ink-900">{formatDate(bestGrowthWeek.week_start)}</p>
                  <p className="text-sm text-ink-500 mt-1">
                    {bestGrowthWeek.views.toLocaleString()} views · {bestGrowthWeek.new_audience.toLocaleString()} new audience ·{' '}
                    {bestGrowthWeek.contentItems} content items that week
                  </p>
                </div>
              ) : <p className="text-sm text-ink-400">No data</p>}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Platform vs Platform — head-to-head monthly comparison of two platforms.
// ---------------------------------------------------------------------
function CompareTab({ metrics, platforms, clientName }: { metrics: GrowthMetricRow[]; platforms: GrowthPlatform[]; clientName: string }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [platformA, setPlatformA] = useState(platforms[0]?.id ?? '')
  const [platformB, setPlatformB] = useState(platforms[1]?.id ?? platforms[0]?.id ?? '')
  const years = useMemo(() => Array.from(new Set(metrics.map((m) => m.year))).sort((a, b) => b - a), [metrics])

  useEffect(() => {
    if (!platformA && platforms[0]) setPlatformA(platforms[0].id)
    if (!platformB && (platforms[1] || platforms[0])) setPlatformB((platforms[1] ?? platforms[0]).id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platforms])

  const rows = useMemo(() => metrics.filter((m) => m.year === year), [metrics, year])
  const platformAName = platforms.find((p) => p.id === platformA)?.name ?? 'Platform A'
  const platformBName = platforms.find((p) => p.id === platformB)?.name ?? 'Platform B'

  const monthly = useMemo(() => {
    return MONTHS.map((month, i) => {
      const monthIndex = i + 1
      const monthRows = rows.filter((r) => Number(r.week_start.slice(5, 7)) === monthIndex)
      const sum = (platformId: string, key: 'views' | 'new_audience') =>
        monthRows.filter((r) => r.platform_id === platformId).reduce((s, r) => s + r[key], 0)
      return { month, monthIndex, aViews: sum(platformA, 'views'), aFollowers: sum(platformA, 'new_audience'), bViews: sum(platformB, 'views'), bFollowers: sum(platformB, 'new_audience') }
    })
  }, [rows, platformA, platformB])

  const monthsWithData = monthly.filter((m) => m.aViews || m.aFollowers || m.bViews || m.bFollowers)
  const daysInMonth = (y: number, monthIndex1: number) => new Date(y, monthIndex1, 0).getDate()

  const totals = useMemo(() => {
    const sumOf = (key: 'aViews' | 'aFollowers' | 'bViews' | 'bFollowers') => monthly.reduce((s, m) => s + m[key], 0)
    const aViews = sumOf('aViews'), aFollowers = sumOf('aFollowers'), bViews = sumOf('bViews'), bFollowers = sumOf('bFollowers')
    const activeDays = monthsWithData.reduce((s, m) => s + daysInMonth(year, m.monthIndex), 0) || 1
    return {
      aViews, aFollowers, bViews, bFollowers,
      aVpf: aFollowers > 0 ? aViews / aFollowers : null,
      bVpf: bFollowers > 0 ? bViews / bFollowers : null,
      aFpd: aFollowers / activeDays,
      bFpd: bFollowers / activeDays,
    }
  }, [monthly, monthsWithData, year])

  const chartData = monthly.map((m) => ({ month: m.month.slice(0, 3), [platformAName]: m.aViews, [platformBName]: m.bViews }))
  function winner(a: number | null, b: number | null) {
    if (a === null || b === null || a === b) return null
    return a > b ? 'a' : 'b'
  }

  function exportCsv() {
    const rows = monthsWithData.map((m) => ({
      Month: m.month,
      [`${platformAName} Views`]: m.aViews,
      [`${platformAName} Followers`]: m.aFollowers,
      [`${platformBName} Views`]: m.bViews,
      [`${platformBName} Followers`]: m.bFollowers,
    }))
    downloadCsv(rows, `${platformAName}-vs-${platformBName}-${clientName}-${year}.csv`)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4 print:hidden">
        <div className="flex items-end gap-3 flex-wrap">
          <FilterField label="Year">
            <Select className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {(years.length ? years : [year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Platform A">
            <Select className="w-40" value={platformA} onChange={(e) => setPlatformA(e.target.value)}>
              {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Platform B">
            <Select className="w-40" value={platformB} onChange={(e) => setPlatformB(e.target.value)}>
              {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FilterField>
          <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={exportCsv} disabled={monthsWithData.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </Card>

      {platforms.length < 2 ? (
        <EmptyState title="Need at least 2 platforms" description="This client only has one platform tracked so far." />
      ) : monthsWithData.length === 0 ? (
        <EmptyState title={`No data for ${year} yet`} description="Try a different year above." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComparisonCard name={platformAName} views={totals.aViews} followers={totals.aFollowers} vpf={totals.aVpf} fpd={totals.aFpd} isViewsWinner={winner(totals.aViews, totals.bViews) === 'a'} isFollowersWinner={winner(totals.aFollowers, totals.bFollowers) === 'a'} />
            <ComparisonCard name={platformBName} views={totals.bViews} followers={totals.bFollowers} vpf={totals.bVpf} fpd={totals.bFpd} isViewsWinner={winner(totals.aViews, totals.bViews) === 'b'} isFollowersWinner={winner(totals.aFollowers, totals.bFollowers) === 'b'} />
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-800 mb-4 flex items-center gap-2"><GitCompare className="h-4 w-4 text-pine-700" />Monthly Views — {platformAName} vs {platformBName}</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={platformAName} stroke="#2F6B4F" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey={platformBName} stroke="#D97757" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100"><h2 className="text-sm font-semibold text-ink-800">Monthly Breakdown</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Month</th>
                    <th className="px-3 py-3 text-right">{platformAName} Views</th>
                    <th className="px-3 py-3 text-right">{platformAName} Followers</th>
                    <th className="px-3 py-3 text-right">{platformBName} Views</th>
                    <th className="px-5 py-3 text-right">{platformBName} Followers</th>
                  </tr>
                </thead>
                <tbody>
                  {monthsWithData.map((m) => (
                    <tr key={m.month} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-ink-900">{m.month}</td>
                      <td className={cn('px-3 py-3 text-right', m.aViews >= m.bViews ? 'text-pine-700 font-medium' : 'text-ink-600')}>{m.aViews.toLocaleString()}</td>
                      <td className={cn('px-3 py-3 text-right', m.aFollowers >= m.bFollowers ? 'text-pine-700 font-medium' : 'text-ink-600')}>{m.aFollowers.toLocaleString()}</td>
                      <td className={cn('px-3 py-3 text-right', m.bViews >= m.aViews ? 'text-clay-600 font-medium' : 'text-ink-600')}>{m.bViews.toLocaleString()}</td>
                      <td className={cn('px-5 py-3 text-right', m.bFollowers >= m.aFollowers ? 'text-clay-600 font-medium' : 'text-ink-600')}>{m.bFollowers.toLocaleString()}</td>
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

// ---------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------
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
      <div className="flex items-center gap-2 text-ink-500"><Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span></div>
      <p className="text-2xl font-semibold text-ink-900 mt-2 truncate">{value}</p>
    </Card>
  )
}

function ComparisonCard({ name, views, followers, vpf, fpd, isViewsWinner, isFollowersWinner }: { name: string; views: number; followers: number; vpf: number | null; fpd: number; isViewsWinner: boolean; isFollowersWinner: boolean }) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-ink-900 mb-3">{name}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Views" value={views.toLocaleString()} winner={isViewsWinner} />
        <Stat label="Followers Gained" value={followers.toLocaleString()} winner={isFollowersWinner} />
        <Stat label="Views per Follower" value={vpf === null ? '—' : vpf.toFixed(1)} />
        <Stat label="Followers per Day" value={fpd.toFixed(2)} />
      </div>
    </Card>
  )
}

function Stat({ label, value, winner }: { label: string; value: string; winner?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-500 flex items-center gap-1">{label}{winner && <Crown className="h-3 w-3 text-amber-500" />}</p>
      <p className="text-lg font-semibold text-ink-900 mt-0.5">{value}</p>
    </div>
  )
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
