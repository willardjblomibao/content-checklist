import { useEffect, useMemo, useState } from 'react'
import { Zap, Video, TrendingUp, Users, Clock, Trophy } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Card, EmptyState, PageSpinner, Select } from '../../components/ui/primitives'
import type { Client } from '../../types/database'
import { formatDate, mondayOfISO, pearsonCorrelation, describeCorrelation } from '../../lib/utils'

interface WeekRow {
  week_start: string
  contentItems: number
  videos: number
  carousels: number
  textPosts: number
  views: number
  new_audience: number
}

export default function ContentCorrelation() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [weeks, setWeeks] = useState<WeekRow[]>([])
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
      setWeeks([])
      setLoading(false)
      return
    }
    setLoading(true)

    Promise.all([
      supabase
        .from('production_logs')
        .select(
          'production_date, videos_edited_count, videos_reedited_count, carousels_edited_count, carousels_reedited_count, text_posts_prepared_count, text_posts_reedited_count'
        )
        .eq('client_id', clientId)
        .gte('production_date', `${year}-01-01`)
        .lte('production_date', `${year}-12-31`),
      supabase.from('weekly_metrics').select('week_start, views, new_audience').eq('client_id', clientId).eq('year', year),
    ]).then(([logsRes, metricsRes]) => {
      const byWeek = new Map<string, WeekRow>()

      for (const log of (logsRes.data ?? []) as any[]) {
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

      for (const m of (metricsRes.data ?? []) as any[]) {
        const row = byWeek.get(m.week_start) ?? { week_start: m.week_start, contentItems: 0, videos: 0, carousels: 0, textPosts: 0, views: 0, new_audience: 0 }
        row.views += m.views ?? 0
        row.new_audience += m.new_audience ?? 0
        byWeek.set(m.week_start, row)
      }

      const sorted = Array.from(byWeek.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))
      setWeeks(sorted)
      setLoading(false)
    })
  }, [clientId, year])

  const selectedClientName = isAdmin
    ? clients.find((c) => c.id === clientId)?.name ?? ''
    : assignedClients.find((c) => c.id === clientId)?.name ?? ''

  // Same-week: does more content this week line up with more views this week?
  const sameWeekR = useMemo(
    () => pearsonCorrelation(weeks.map((w) => w.contentItems), weeks.map((w) => w.views)),
    [weeks]
  )

  // Lagged: does content THIS week line up with views NEXT week (a delayed payoff)?
  const laggedR = useMemo(() => {
    if (weeks.length < 4) return null
    const content = weeks.slice(0, -1).map((w) => w.contentItems)
    const nextViews = weeks.slice(1).map((w) => w.views)
    return pearsonCorrelation(content, nextViews)
  }, [weeks])

  const totalContent = weeks.reduce((s, w) => s + w.contentItems, 0)
  const totalViews = weeks.reduce((s, w) => s + w.views, 0)
  const bestContentWeek = weeks.reduce((best, w) => (w.contentItems > (best?.contentItems ?? -1) ? w : best), null as WeekRow | null)
  const bestGrowthWeek = weeks.reduce((best, w) => (w.views > (best?.views ?? -1) ? w : best), null as WeekRow | null)
  const weeksWithBoth = weeks.filter((w) => w.contentItems > 0 || w.views > 0)

  const chartData = weeks.map((w) => ({
    week: formatDate(w.week_start, 'MMM d'),
    'Content Items': w.contentItems,
    Views: w.views,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-pine-700" />
            Content Impact
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            {selectedClientName ? `Does more content actually move the needle for ${selectedClientName}?` : 'Content output vs. views and audience growth, side by side.'}
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
        </div>
      </div>

      {loading ? (
        <PageSpinner />
      ) : !clientId ? (
        <EmptyState
          title={isAdmin ? 'No client selected' : 'No client assigned yet'}
          description={isAdmin ? 'Pick a client above.' : 'Ask an admin to assign you to a client from the Team page.'}
        />
      ) : weeksWithBoth.length < 3 ? (
        <EmptyState
          title="Not enough data yet"
          description="Log at least a few weeks of both Daily Log content and Weekly Growth data for this client to see how they connect."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500">
                <Zap className="h-4 w-4" />
                <span className="text-xs font-medium">Same-Week Correlation</span>
              </div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{sameWeekR === null ? '—' : sameWeekR.toFixed(2)}</p>
              <p className="text-xs text-ink-500 mt-1">{describeCorrelation(sameWeekR)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Next-Week Correlation</span>
              </div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{laggedR === null ? '—' : laggedR.toFixed(2)}</p>
              <p className="text-xs text-ink-500 mt-1">{describeCorrelation(laggedR)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500">
                <Video className="h-4 w-4" />
                <span className="text-xs font-medium">Total Content Items</span>
              </div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalContent.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-ink-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Total Views</span>
              </div>
              <p className="text-2xl font-semibold text-ink-900 mt-2">{totalViews.toLocaleString()}</p>
            </Card>
          </div>

          <Card className="p-4 bg-pine-50 border-pine-100">
            <p className="text-sm text-pine-800">
              <strong>Reading this:</strong> Same-week correlation checks if busier content weeks line up with more views
              that same week. Next-week correlation checks for a delayed payoff — content posted this week showing up as
              views the following week. A number near <strong>+1</strong> means they move together strongly; near{' '}
              <strong>0</strong> means little to no relationship; negative means they move in opposite directions.
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
              <h2 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Busiest Content Week
              </h2>
              {bestContentWeek ? (
                <div>
                  <p className="text-lg font-semibold text-ink-900">{formatDate(bestContentWeek.week_start)}</p>
                  <p className="text-sm text-ink-500 mt-1">
                    {bestContentWeek.contentItems} items ({bestContentWeek.videos} video, {bestContentWeek.carousels} carousel,{' '}
                    {bestContentWeek.textPosts} text) · {bestContentWeek.views.toLocaleString()} views that week
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-400">No data</p>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-pine-600" />
                Best Growth Week
              </h2>
              {bestGrowthWeek ? (
                <div>
                  <p className="text-lg font-semibold text-ink-900">{formatDate(bestGrowthWeek.week_start)}</p>
                  <p className="text-sm text-ink-500 mt-1">
                    {bestGrowthWeek.views.toLocaleString()} views · {bestGrowthWeek.new_audience.toLocaleString()} new audience ·{' '}
                    {bestGrowthWeek.contentItems} content items that week
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-400">No data</p>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-800">Weekly Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Week</th>
                    <th className="px-3 py-3 text-right">Videos</th>
                    <th className="px-3 py-3 text-right">Carousels</th>
                    <th className="px-3 py-3 text-right">Text</th>
                    <th className="px-3 py-3 text-right">Total Items</th>
                    <th className="px-3 py-3 text-right">Views</th>
                    <th className="px-5 py-3 text-right">New Audience</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.week_start} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-3 text-ink-700 whitespace-nowrap">{formatDate(w.week_start)}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{w.videos}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{w.carousels}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{w.textPosts}</td>
                      <td className="px-3 py-3 text-right font-medium text-ink-800">{w.contentItems}</td>
                      <td className="px-3 py-3 text-right text-ink-600">{w.views.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-ink-600">{w.new_audience.toLocaleString()}</td>
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
