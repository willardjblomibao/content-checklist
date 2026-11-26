import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StickyNote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePresence } from '../contexts/PresenceContext'
import { KpiCards, RangeSwitcher, type RangeKey, type CustomRange } from '../components/dashboard/KpiCards'
import { ContributionHeatmap } from '../components/dashboard/ContributionHeatmap'
import { OtherWorkPanel } from '../components/dashboard/OtherWorkPanel'
import { Card, EmptyState, PageSpinner, PageHeader, SectionTitle } from '../components/ui/primitives'
import { TodayHero, chipsFor } from '../components/dashboard/TodayHero'
import { LogCalendar, summarizeMonth } from '../components/dashboard/LogCalendar'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { PRODUCTION_FIELDS, logActivityCount, videoFormatTotals, editedSplit, logClientLabel, type Profile, type ProductionLogWithRelations } from '../types/database'
import { cn, formatDate, initials, previousPeriod, startOfMonthISO, startOfWeekISO, todayISO } from '../lib/utils'

function sumFields(logs: ProductionLogWithRelations[]) {
  const t: Record<string, number> = {}
  for (const f of PRODUCTION_FIELDS) t[f.countKey] = 0
  for (const log of logs) {
    for (const f of PRODUCTION_FIELDS) t[f.countKey] += (log as any)[f.countKey] ?? 0
  }
  return t
}

const AVATAR_COLORS = ['bg-pine-600', 'bg-violet-500', 'bg-clay-500', 'bg-amber-500', 'bg-pine-400', 'bg-coral-500']

function rangeToDates(range: RangeKey, custom: CustomRange): { from: string; to: string } {
  const to = todayISO()
  if (range === 'custom') return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  if (range === 'today') return { from: to, to }
  if (range === 'week') return { from: startOfWeekISO(), to }
  return { from: startOfMonthISO(), to }
}

export default function AdminDashboard() {
  const { onlineUserIds } = usePresence()
  const [range, setRange] = useState<RangeKey>('week')
  const [custom, setCustom] = useState<CustomRange>(() => ({ from: startOfMonthISO(), to: todayISO() }))
  const [logs, setLogs] = useState<ProductionLogWithRelations[]>([])
  const [prevLogs, setPrevLogs] = useState<ProductionLogWithRelations[]>([])
  const [todayLogs, setTodayLogs] = useState<ProductionLogWithRelations[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [recentNotes, setRecentNotes] = useState<ProductionLogWithRelations[]>([])
  const [heatmapLogs, setHeatmapLogs] = useState<ProductionLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()))
  const [calLogs, setCalLogs] = useState<ProductionLogWithRelations[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [calUserId, setCalUserId] = useState<string | null>(null)

  const { from, to } = rangeToDates(range, custom)
  const prev = previousPeriod(range, from, to)

  useEffect(() => {
    supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status), profile:profiles(id, full_name, email)')
      .eq('production_date', todayISO())
      .then(({ data }) => setTodayLogs((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [])

  useEffect(() => {
    supabase
      .from('production_logs')
      .select('*')
      .gte('production_date', prev.from)
      .lte('production_date', prev.to)
      .then(({ data }) => setPrevLogs((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [prev.from, prev.to])

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
        'production_date, videos_edited_count, videos_reedited_count, carousels_edited_count, carousels_reedited_count, text_posts_prepared_count, text_posts_reedited_count, is_other_work'
      )
      .gte('production_date', start.toISOString().slice(0, 10))
      .then(({ data }) => setHeatmapLogs((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [])

  // Logging calendar: every assistant's entries in the displayed month.
  useEffect(() => {
    setCalLoading(true)
    supabase
      .from('production_logs')
      .select('user_id, production_date, videos_edited_count, videos_reedited_count, carousels_edited_count, carousels_reedited_count, text_posts_prepared_count, text_posts_reedited_count, is_other_work')
      .gte('production_date', format(calMonth, 'yyyy-MM-dd'))
      .lte('production_date', format(endOfMonth(calMonth), 'yyyy-MM-dd'))
      .then(({ data }) => {
        setCalLogs((data ?? []) as unknown as ProductionLogWithRelations[])
        setCalLoading(false)
      })
  }, [calMonth])

  // Per-assistant activity counts and missed workdays for that month.
  const calByUser = useMemo(() => {
    const maps = new Map<string, Map<string, number>>()
    for (const log of calLogs) {
      const m = maps.get(log.user_id) ?? new Map<string, number>()
      m.set(log.production_date, (m.get(log.production_date) ?? 0) + logActivityCount(log))
      maps.set(log.user_id, m)
    }
    return team
      .map((member) => {
        const counts = maps.get(member.id) ?? new Map<string, number>()
        const startDate = member.created_at.slice(0, 10)
        return { member, counts, startDate, summary: summarizeMonth(calMonth, counts, startDate) }
      })
      .sort((a, b) => b.summary.missed.length - a.summary.missed.length || a.member.full_name.localeCompare(b.member.full_name))
  }, [calLogs, team, calMonth])
  const calSelected = calByUser.find((r) => r.member.id === calUserId) ?? calByUser[0]

  const heatmapCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of heatmapLogs) {
      map.set(log.production_date, (map.get(log.production_date) ?? 0) + logActivityCount(log))
    }
    return map
  }, [heatmapLogs])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status), profile:profiles(id, full_name, email)')
      .gte('production_date', from)
      .lte('production_date', to)
      .then(({ data }) => {
        setLogs((data ?? []) as unknown as ProductionLogWithRelations[])
        setLoading(false)
      })
  }, [from, to])

  const totals = useMemo(() => sumFields(logs), [logs])
  const prevTotals = useMemo(() => sumFields(prevLogs), [prevLogs])
  const todayTotals = useMemo(() => sumFields(todayLogs), [todayLogs])
  const todayCount = Object.values(todayTotals).reduce((a, b) => a + b, 0)

  // Per-assistant activity for today, most productive first; people who
  // haven't logged anything yet sink to the bottom.
  const teamToday = useMemo(() => {
    const rows = team.map((member) => {
      const mine = todayLogs.filter((l) => l.user_id === member.id)
      const items = mine.reduce(
        (sum, l) => sum + PRODUCTION_FIELDS.reduce((s, f) => s + ((l as any)[f.countKey] ?? 0), 0),
        0
      )
      return { member, items, logged: mine.length > 0, otherOnly: mine.length > 0 && mine.every((l) => l.is_other_work) }
    })
    return rows.sort((a, b) => Number(b.logged) - Number(a.logged) || b.items - a.items)
  }, [team, todayLogs])
  const loggedToday = teamToday.filter((r) => r.logged).length
  const maxToday = Math.max(1, ...teamToday.map((r) => r.items))

  const perAssistant = useMemo(() => {
    const rows = team.map((member) => {
      const memberLogs = logs.filter((l) => l.user_id === member.id)
      const totalsRow: Record<string, number> = {}
      for (const f of PRODUCTION_FIELDS) {
        totalsRow[f.countKey] = memberLogs.reduce((sum, l) => sum + ((l as any)[f.countKey] ?? 0), 0)
      }
      const total = Object.values(totalsRow).reduce((a, b) => a + b, 0)
      const otherWork = memberLogs.filter((l) => l.is_other_work).length
      return { member, totalsRow, total, otherWork }
    })
    return rows.sort((a, b) => b.total - a.total)
  }, [team, logs])

  const teamTotal = perAssistant.reduce((sum, r) => sum + r.total, 0)
  const teamOtherWork = perAssistant.reduce((sum, r) => sum + r.otherWork, 0)

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Content team" description={formatDate(todayISO(), 'EEEE, MMMM d, yyyy')} />

      <TodayHero
        eyebrow="Team today"
        headline={`${todayCount} item${todayCount === 1 ? '' : 's'} logged`}
        detail={
          team.length === 0
            ? 'Add assistants from the Team page to start tracking.'
            : `${loggedToday} of ${team.length} assistant${team.length === 1 ? '' : 's'} have logged today · ${
                team.filter((m) => onlineUserIds.has(m.id)).length
              } online now`
        }
        chips={chipsFor(todayTotals, videoFormatTotals(todayLogs))}
        ctaLabel="Log today's work"
        ctaIsPrimaryAction
      />

      <section>
        <SectionTitle aside={<RangeSwitcher value={range} onChange={setRange} custom={custom} onCustomChange={setCustom} />} className="flex-wrap">
          Team production
        </SectionTitle>
        {!loading && <KpiCards totals={totals} previous={prevTotals} range={range} videoSplit={editedSplit(logs)} />}
      </section>

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <section className="lg:col-span-2 min-w-0">
              <SectionTitle>Team activity</SectionTitle>
              <Card>
                <div className="p-5 overflow-x-auto">
                  <ContributionHeatmap countsByDate={heatmapCounts} label="team items" />
                </div>
              </Card>
            </section>

            <section className="min-w-0">
              <SectionTitle aside={`${loggedToday} of ${team.length} logged`}>Team today</SectionTitle>
              <Card className="overflow-hidden">
                {teamToday.length === 0 ? (
                  <EmptyState title="No team members yet" description="Add assistants from the Team page." />
                ) : (
                  <div className="divide-y divide-ink-100">
                    {teamToday.map(({ member, items, logged, otherOnly }, i) => (
                      <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="relative shrink-0">
                          <span
                            className={cn(
                              'h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-semibold',
                              logged ? AVATAR_COLORS[i % AVATAR_COLORS.length] : 'bg-ink-300'
                            )}
                          >
                            {initials(member.full_name)}
                          </span>
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                              onlineUserIds.has(member.id) ? 'bg-pine-500' : 'bg-ink-200'
                            )}
                            title={onlineUserIds.has(member.id) ? 'Online' : 'Offline'}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-900 truncate">{member.full_name}</p>
                          {logged && !otherOnly ? (
                            <div className="h-1.5 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-pine-500" style={{ width: `${(items / maxToday) * 100}%` }} />
                            </div>
                          ) : (
                            <p className="text-xs text-ink-500 mt-0.5">{otherOnly ? 'Other work only' : 'Not logged yet'}</p>
                          )}
                        </div>
                        {logged ? (
                          <span className="text-sm font-bold text-ink-900 tabular-nums">{items}</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600">Pending</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          </div>

          {calSelected && (
            <section>
              <SectionTitle aside={`${calByUser.filter((r) => r.summary.missed.length > 0).length} of ${calByUser.length} missed a day in ${format(calMonth, 'MMMM')}`}>
                Log calendar
              </SectionTitle>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 min-w-0">
                  <LogCalendar
                    month={calMonth}
                    onMonthChange={setCalMonth}
                    counts={calSelected.counts}
                    startDate={calSelected.startDate}
                    personLabel={calSelected.member.full_name.split(' ')[0]}
                    loading={calLoading}
                  />
                </div>
                <Card className="overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-[15px] font-semibold text-ink-900">Missed workdays</p>
                    <p className="text-xs text-ink-500">{format(calMonth, 'MMMM yyyy')} · select someone to see their calendar</p>
                  </div>
                  <div className="divide-y divide-ink-100">
                    {calByUser.map(({ member, summary }, i) => {
                      const active = member.id === calSelected.member.id
                      const missed = summary.missed.length
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setCalUserId(member.id)}
                          aria-pressed={active}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            active ? 'bg-pine-50' : 'hover:bg-ink-50/70'
                          )}
                        >
                          <span
                            className={cn(
                              'h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0',
                              AVATAR_COLORS[i % AVATAR_COLORS.length]
                            )}
                          >
                            {initials(member.full_name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-sm truncate', active ? 'font-semibold text-pine-800' : 'font-medium text-ink-900')}>
                              {member.full_name}
                            </span>
                            <span className="block text-xs text-ink-500">
                              {summary.loggedWorkdays}/{summary.workdays} workdays logged
                            </span>
                          </span>
                          {missed > 0 ? (
                            <span className="rounded-full bg-clay-100 px-2 py-0.5 text-[11px] font-semibold text-clay-600 whitespace-nowrap">
                              {missed} missed
                            </span>
                          ) : (
                            <span className="rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-semibold text-pine-800">All logged</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </Card>
              </div>
            </section>
          )}

          <section>
            <SectionTitle>Team other work</SectionTitle>
            <OtherWorkPanel logs={logs} mode="team" />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="text-[15px] font-semibold text-ink-900 mb-3 flex items-center gap-2">
                Individual performance
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
                        <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                          <th className="px-5 py-3">Assistant</th>
                          {PRODUCTION_FIELDS.map((f) => (
                            <th key={f.countKey} className="px-3 py-3 text-right whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-right whitespace-nowrap text-amber-600">Other Work</th>
                          <th className="px-5 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perAssistant.map(({ member, totalsRow, total, otherWork }) => (
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
                            <td className="px-3 py-3 text-right text-amber-600">{otherWork > 0 ? otherWork : '—'}</td>
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
                          <td className="px-3 py-3 text-right text-amber-600">{teamOtherWork > 0 ? teamOtherWork : '—'}</td>
                          <td className="px-5 py-3 text-right">{teamTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div>
              <SectionTitle>Recent notes</SectionTitle>
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
                            {logClientLabel(log as any)}
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
