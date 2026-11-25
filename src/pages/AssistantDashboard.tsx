import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Plus, StickyNote, Video, GalleryHorizontal, FileText, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { KpiCards, RangeSwitcher, type RangeKey } from '../components/dashboard/KpiCards'
import { ContributionHeatmap } from '../components/dashboard/ContributionHeatmap'
import { StreakCard } from '../components/dashboard/StreakCard'
import { OtherWorkPanel } from '../components/dashboard/OtherWorkPanel'
import { TodayHero, chipsFor } from '../components/dashboard/TodayHero'
import { Button, Card, EmptyState, PageSpinner, Badge, PageHeader, SectionTitle } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, logActivityCount, videoFormatTotals, editedSplit, logClientLabel, type ProductionLogWithRelations } from '../types/database'
import { computeStreak, formatDate, greeting, previousPeriod, startOfMonthISO, startOfWeekISO, todayISO } from '../lib/utils'

function rangeToDates(range: RangeKey): { from: string; to: string } {
  const to = todayISO()
  if (range === 'today') return { from: to, to }
  if (range === 'week') return { from: startOfWeekISO(), to }
  return { from: startOfMonthISO(), to }
}

function sumFields(logs: ProductionLogWithRelations[]) {
  const t: Record<string, number> = {}
  for (const f of PRODUCTION_FIELDS) t[f.countKey] = 0
  for (const log of logs) {
    for (const f of PRODUCTION_FIELDS) t[f.countKey] += (log as any)[f.countKey] ?? 0
  }
  return t
}

/** Icon for a log row, picked from whichever content type it has most of. */
function logIcon(log: ProductionLogWithRelations) {
  if ((log as any).is_other_work) return Briefcase
  const v = (log.videos_edited_count ?? 0) + (log.videos_reedited_count ?? 0)
  const c = (log.carousels_edited_count ?? 0) + (log.carousels_reedited_count ?? 0)
  const t = (log.text_posts_prepared_count ?? 0) + (log.text_posts_reedited_count ?? 0)
  if (c > v && c >= t) return GalleryHorizontal
  if (t > v && t > c) return FileText
  return Video
}

const SELECT_LOG = '*, client:clients(id, name, status)'

export default function AssistantDashboard() {
  const { profile } = useAuth()
  const [range, setRange] = useState<RangeKey>('week')
  const [logs, setLogs] = useState<ProductionLogWithRelations[]>([])
  const [prevLogs, setPrevLogs] = useState<ProductionLogWithRelations[]>([])
  const [todayLogs, setTodayLogs] = useState<ProductionLogWithRelations[]>([])
  const [recent, setRecent] = useState<ProductionLogWithRelations[]>([])
  const [heatmapLogs, setHeatmapLogs] = useState<ProductionLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to } = rangeToDates(range)
  const prev = previousPeriod(range, from, to)

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    Promise.all([
      supabase.from('production_logs').select(SELECT_LOG).eq('user_id', profile.id).gte('production_date', from).lte('production_date', to),
      supabase.from('production_logs').select(SELECT_LOG).eq('user_id', profile.id).gte('production_date', prev.from).lte('production_date', prev.to),
    ]).then(([cur, before]) => {
      setLogs((cur.data ?? []) as unknown as ProductionLogWithRelations[])
      setPrevLogs((before.data ?? []) as unknown as ProductionLogWithRelations[])
      setLoading(false)
    })
  }, [profile, from, to, prev.from, prev.to])

  useEffect(() => {
    if (!profile) return
    const today = todayISO()
    supabase
      .from('production_logs')
      .select(SELECT_LOG)
      .eq('user_id', profile.id)
      .eq('production_date', today)
      .then(({ data }) => setTodayLogs((data ?? []) as unknown as ProductionLogWithRelations[]))

    supabase
      .from('production_logs')
      .select(SELECT_LOG)
      .eq('user_id', profile.id)
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data ?? []) as unknown as ProductionLogWithRelations[]))

    const start = new Date()
    start.setDate(start.getDate() - 14 * 7)
    supabase
      .from('production_logs')
      .select(
        'production_date, videos_edited_count, videos_reedited_count, carousels_edited_count, carousels_reedited_count, text_posts_prepared_count, text_posts_reedited_count, is_other_work'
      )
      .eq('user_id', profile.id)
      .gte('production_date', start.toISOString().slice(0, 10))
      .then(({ data }) => setHeatmapLogs((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [profile])

  const heatmapCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of heatmapLogs) {
      map.set(log.production_date, (map.get(log.production_date) ?? 0) + logActivityCount(log))
    }
    return map
  }, [heatmapLogs])

  const totals = useMemo(() => sumFields(logs), [logs])
  const prevTotals = useMemo(() => sumFields(prevLogs), [prevLogs])
  const todayTotals = useMemo(() => sumFields(todayLogs), [todayLogs])
  const streak = useMemo(() => computeStreak(heatmapCounts), [heatmapCounts])

  const todayCount = Object.values(todayTotals).reduce((a, b) => a + b, 0)
  const todayInProgress = todayLogs.reduce(
    (n, log) => n + PRODUCTION_FIELDS.filter((f) => ((log as any)[f.countKey] ?? 0) > 0 && (log as any)[f.statusKey] === 'in_progress').length,
    0
  )
  const todayOtherWork = todayLogs.filter((l) => (l as any).is_other_work).length
  const nothingYet = todayLogs.length === 0

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  let detail: string
  if (nothingYet) detail = streak > 0 ? `Log something today to keep your ${streak}-day streak going.` : 'Nothing logged yet today.'
  else if (todayInProgress > 0) detail = `${todayInProgress} item type${todayInProgress === 1 ? '' : 's'} still in progress.`
  else if (todayOtherWork > 0 && todayCount === 0) detail = `${todayOtherWork} other-work entr${todayOtherWork === 1 ? 'y' : 'ies'} logged.`
  else detail = `Everything logged today is marked completed. Nice work!`

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={formatDate(todayISO(), 'EEEE, MMMM d, yyyy')}
      />

      <TodayHero
        headline={nothingYet ? 'Ready when you are' : `${todayCount} item${todayCount === 1 ? '' : 's'} logged`}
        detail={detail}
        chips={chipsFor(todayTotals, videoFormatTotals(todayLogs))}
        streak={streak}
        ctaLabel={nothingYet ? "Log today's work" : 'Add another log'}
        ctaIsPrimaryAction={nothingYet}
      />

      <section>
        <SectionTitle aside={<RangeSwitcher value={range} onChange={setRange} />} className="flex-wrap">
          Your production
        </SectionTitle>
        {loading ? <PageSpinner /> : <KpiCards totals={totals} previous={prevTotals} range={range} videoSplit={editedSplit(logs)} />}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          <section>
            <SectionTitle>Your activity</SectionTitle>
            <Card>
              <div className="p-5 overflow-x-auto">
                <ContributionHeatmap countsByDate={heatmapCounts} />
              </div>
            </Card>
          </section>

          {!loading && (
            <section>
              <SectionTitle>Other work</SectionTitle>
              <OtherWorkPanel logs={logs} mode="self" />
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <section>
            <SectionTitle>Your streak</SectionTitle>
            <StreakCard countsByDate={heatmapCounts} />
          </section>

          <section>
            <SectionTitle
              aside={
                <Link to="/history" className="inline-flex items-center gap-1 hover:text-pine-700">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              Recent logs
            </SectionTitle>
            <Card className="overflow-hidden">
              {recent.length === 0 ? (
                <EmptyState
                  title="No production logged yet"
                  description="Start tracking today's work by adding your first daily log."
                  action={
                    <Link to="/daily-log">
                      <Button>
                        <Plus className="h-4 w-4" />
                        Log today's work
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-ink-100">
                  {recent.map((log) => {
                    const loggedFields = PRODUCTION_FIELDS.filter((f) => ((log as any)[f.countKey] ?? 0) > 0)
                    const total = loggedFields.reduce((sum, f) => sum + ((log as any)[f.countKey] ?? 0), 0)
                    const anyInProgress = loggedFields.some((f) => (log as any)[f.statusKey] === 'in_progress')
                    const isOther = (log as any).is_other_work
                    const Icon = logIcon(log)
                    return (
                      <Link
                        key={log.id}
                        to={`/daily-log?edit=${log.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50/70 transition-colors"
                      >
                        <span
                          className={`h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                            isOther ? 'bg-amber-50 text-amber-600' : 'bg-pine-50 text-pine-700'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-900 flex items-center gap-1.5 truncate">
                            <span className="truncate">{logClientLabel(log as any, 'Unknown client')}</span>
                            {log.notes && (
                              <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Has notes">
                                <title>{log.notes}</title>
                              </StickyNote>
                            )}
                          </p>
                          <p className="text-xs text-ink-500 mt-0.5 truncate">
                            {isOther && log.notes ? log.notes : `${total} item${total === 1 ? '' : 's'}`} ·{' '}
                            {formatDate(log.production_date, 'MMM d')}
                          </p>
                        </div>
                        {isOther ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-600 shrink-0">
                            Other
                          </span>
                        ) : loggedFields.length === 0 ? (
                          <Badge variant="neutral">No items</Badge>
                        ) : (
                          <Badge variant={anyInProgress ? 'in_progress' : 'completed'} />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
