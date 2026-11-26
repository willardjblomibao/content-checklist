import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import {
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  StickyNote,
  Video,
  GalleryHorizontal,
  FileText,
  Briefcase,
  CalendarDays,
} from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useProductionLogs, deleteProductionLog, type LogFilters } from '../hooks/useProductionLogs'
import { Badge, Button, Card, EmptyState, PageSpinner, Select, PageHeader, Segmented, StatCard } from '../components/ui/primitives'
import { ConfirmDialog } from '../components/ui/dialog'
import {
  PRODUCTION_FIELDS,
  totalItems,
  videoFormatCsvValues,
  logClientLabel,
  logClientName,
  type Client,
  type Profile,
  type ProductionLogWithRelations,
} from '../types/database'
import { cn, dayOfWeek, formatDate, initials, startOfMonthISO, startOfWeekISO, todayISO } from '../lib/utils'

const PAGE_SIZE = 20

type DatePreset = 'all' | 'week' | 'month' | '30d' | 'custom'

function presetRange(p: DatePreset): { dateFrom?: string; dateTo?: string } {
  const today = todayISO()
  if (p === 'week') return { dateFrom: startOfWeekISO(), dateTo: today }
  if (p === 'month') return { dateFrom: startOfMonthISO(), dateTo: today }
  if (p === '30d') return { dateFrom: format(subDays(new Date(), 29), 'yyyy-MM-dd'), dateTo: today }
  return {}
}

const AVATAR_COLORS = ['bg-pine-600', 'bg-violet-500', 'bg-clay-500', 'bg-amber-500', 'bg-pine-400', 'bg-coral-500']
function avatarColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** Content counts grouped the way people talk about them. */
function breakdown(log: ProductionLogWithRelations) {
  return [
    { key: 'v', icon: Video, label: 'videos', value: (log.videos_edited_count ?? 0) + (log.videos_reedited_count ?? 0) },
    { key: 'c', icon: GalleryHorizontal, label: 'carousels', value: (log.carousels_edited_count ?? 0) + (log.carousels_reedited_count ?? 0) },
    { key: 't', icon: FileText, label: 'text posts', value: (log.text_posts_prepared_count ?? 0) + (log.text_posts_reedited_count ?? 0) },
  ].filter((b) => b.value > 0)
}

function statusOf(log: ProductionLogWithRelations): 'completed' | 'in_progress' | 'none' {
  const logged = PRODUCTION_FIELDS.filter((f) => ((log as any)[f.countKey] ?? 0) > 0)
  if (logged.length === 0) return 'none'
  return logged.some((f) => (log as any)[f.statusKey] === 'in_progress') ? 'in_progress' : 'completed'
}

const SUMMARY_SELECT =
  'production_date, is_other_work, videos_edited_count, videos_edited_status, videos_reedited_count, videos_reedited_status, carousels_edited_count, carousels_edited_status, carousels_reedited_count, carousels_reedited_status, text_posts_prepared_count, text_posts_prepared_status, text_posts_reedited_count, text_posts_reedited_status'

export default function History() {
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [clients, setClients] = useState<Client[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [preset, setPreset] = useState<DatePreset>('all')
  const [filters, setFilters] = useState<LogFilters>({
    page: 0,
    pageSize: PAGE_SIZE,
    sortBy: 'production_date',
    sortDir: 'desc',
    userId: isAdmin ? undefined : profile?.id,
  })
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [summaryRows, setSummaryRows] = useState<ProductionLogWithRelations[]>([])

  const { logs, total, loading, refetch } = useProductionLogs(filters)

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients((data ?? []) as Client[]))
    if (isAdmin) {
      supabase
        .from('profiles')
        .select('*')
        .order('full_name')
        .then(({ data }) => setTeam((data ?? []) as Profile[]))
    }
  }, [isAdmin])

  // Summary tiles cover every record matching the filters, not just this page.
  useEffect(() => {
    let q = supabase.from('production_logs').select(SUMMARY_SELECT)
    if (filters.userId) q = q.eq('user_id', filters.userId)
    if (filters.clientId === 'other_work') q = q.eq('is_other_work', true)
    else if (filters.clientId) q = q.eq('client_id', filters.clientId)
    if (filters.dateFrom) q = q.gte('production_date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('production_date', filters.dateTo)
    q.limit(5000).then(({ data }) => setSummaryRows((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [filters.userId, filters.clientId, filters.dateFrom, filters.dateTo, logs])

  const summary = useMemo(() => {
    let items = 0
    let completed = 0
    let counted = 0
    const days = new Set<string>()
    for (const r of summaryRows) {
      days.add(r.production_date)
      for (const f of PRODUCTION_FIELDS) {
        const n = (r as any)[f.countKey] ?? 0
        if (!n) continue
        items += n
        counted += n
        if ((r as any)[f.statusKey] === 'completed') completed += n
      }
    }
    return {
      entries: summaryRows.length,
      items,
      completion: counted ? Math.round((completed / counted) * 100) : null,
      perDay: days.size ? items / days.size : 0,
      days: days.size,
    }
  }, [summaryRows])

  function setFilter<K extends keyof LogFilters>(key: K, value: LogFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: 0 }))
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'custom') {
      setFilters((f) => ({
        ...f,
        dateFrom: f.dateFrom ?? startOfMonthISO(),
        dateTo: f.dateTo ?? todayISO(),
        page: 0,
      }))
    } else {
      setFilters((f) => ({ ...f, ...{ dateFrom: undefined, dateTo: undefined }, ...presetRange(p), page: 0 }))
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error } = await deleteProductionLog(pendingDelete)
    setDeleting(false)
    setPendingDelete(null)
    if (error) {
      toast(`Couldn't delete: ${error}`, 'error')
    } else {
      toast('Record deleted.', 'success')
      refetch()
    }
  }

  function exportCsv() {
    const rows = logs.map((log) => ({
      Date: log.production_date,
      Day: dayOfWeek(log.production_date),
      Assistant: log.profile?.full_name ?? '',
      Client: logClientLabel(log as any, ''),
      ...Object.fromEntries(PRODUCTION_FIELDS.map((f) => [f.label, (log as any)[f.countKey]])),
      ...videoFormatCsvValues(log),
      'Total Items': totalItems(log),
      Notes: log.notes ?? '',
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `production-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = filters.page ?? 0
  const hasFilters = !!(filters.clientId || (isAdmin && filters.userId) || preset !== 'all')

  function ClientCell({ log }: { log: ProductionLogWithRelations }) {
    if ((log as any).is_other_work) {
      return (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600 shrink-0">
            <Briefcase className="h-3 w-3" /> Other
          </span>
          {logClientName(log as any) && <span className="truncate text-ink-700">{logClientName(log as any)}</span>}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="h-2 w-2 rounded-full bg-pine-500 shrink-0" />
        <span className="truncate text-ink-800 font-medium">{log.client?.name ?? '—'}</span>
      </span>
    )
  }

  function Actions({ log }: { log: ProductionLogWithRelations }) {
    const canEdit = isAdmin || log.user_id === profile?.id
    if (!canEdit) return null
    return (
      <div className="flex justify-end gap-0.5">
        <button
          onClick={() => navigate(`/daily-log?edit=${log.id}`)}
          className="p-1.5 text-ink-400 hover:text-pine-700 hover:bg-pine-50 rounded-lg"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPendingDelete(log.id)}
          className="p-1.5 text-ink-400 hover:text-clay-600 hover:bg-clay-50 rounded-lg"
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="History"
        description={isAdmin ? 'Every production log from the team.' : 'Every log you’ve submitted.'}
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={logs.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Entries" value={summary.entries.toLocaleString()} sub={`${summary.days} day${summary.days === 1 ? '' : 's'} logged`} />
        <StatCard label="Items produced" value={summary.items.toLocaleString()} highlight />
        <StatCard
          label="Completion rate"
          value={summary.completion === null ? '—' : `${summary.completion}%`}
          sub="Items marked completed"
        />
        <StatCard label="Avg items / day" value={summary.perDay.toFixed(1)} sub="On days with a log" />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          <Segmented
            ariaLabel="Date range"
            value={preset}
            onChange={applyPreset}
            options={[
              { value: 'all', label: 'All time' },
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
              { value: '30d', label: 'Last 30 days' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 rounded-[10px] bg-white border border-ink-200 px-2.5 py-1.5 shadow-card self-start">
            <CalendarDays className="h-3.5 w-3.5 text-ink-400" />
            <input
              type="date"
              aria-label="From date"
              value={filters.dateFrom ?? ''}
              max={filters.dateTo || todayISO()}
              onChange={(e) => setFilter('dateFrom', e.target.value || undefined)}
              className="bg-transparent text-[13px] font-medium text-ink-800 outline-none w-[124px]"
            />
            <span className="text-ink-300">→</span>
            <input
              type="date"
              aria-label="To date"
              value={filters.dateTo ?? ''}
              min={filters.dateFrom}
              max={todayISO()}
              onChange={(e) => setFilter('dateTo', e.target.value || undefined)}
              className="bg-transparent text-[13px] font-medium text-ink-800 outline-none w-[124px]"
            />
          </div>
        )}
        <div className="flex gap-2 lg:ml-auto">
          {isAdmin && (
            <Select
              aria-label="Assistant"
              className="w-auto min-w-[160px]"
              value={filters.userId ?? ''}
              onChange={(e) => setFilter('userId', e.target.value || undefined)}
            >
              <option value="">All assistants</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          )}
          <Select
            aria-label="Client"
            className="w-auto min-w-[150px]"
            value={filters.clientId ?? ''}
            onChange={(e) => setFilter('clientId', e.target.value || undefined)}
          >
            <option value="">All clients</option>
            <option value="other_work">Other Work</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No records found"
            description={hasFilters ? 'Nothing matches these filters. Try a wider date range.' : 'Logs you add will show up here.'}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                    <th className="px-5 py-3 whitespace-nowrap">Date</th>
                    {isAdmin && <th className="px-3 py-3 whitespace-nowrap">Assistant</th>}
                    <th className="px-3 py-3 whitespace-nowrap">Client</th>
                    <th className="px-3 py-3 whitespace-nowrap">Breakdown</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Total</th>
                    <th className="px-3 py-3 whitespace-nowrap">Status</th>
                    <th className="px-3 py-3">Notes</th>
                    <th className="px-5 py-3 w-[88px]" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const status = statusOf(log)
                    const parts = breakdown(log)
                    return (
                      <tr key={log.id} className="border-b border-ink-100/70 last:border-0 hover:bg-ink-50/60 group">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="font-semibold text-ink-900">{formatDate(log.production_date, 'MMM d')}</span>
                          <span className="ml-1.5 text-xs text-ink-500">{formatDate(log.production_date, 'EEE')}</span>
                          <span className="block text-[11px] text-ink-400">{formatDate(log.production_date, 'yyyy')}</span>
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className={cn(
                                  'h-7 w-7 rounded-full text-white flex items-center justify-center text-[11px] font-semibold',
                                  avatarColor(log.user_id)
                                )}
                              >
                                {initials(log.profile?.full_name ?? '?')}
                              </span>
                              <span className="text-ink-700">{log.profile?.full_name ?? '—'}</span>
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-3 whitespace-nowrap max-w-[200px]">
                          <ClientCell log={log} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {parts.length === 0 ? (
                              <span className="text-ink-300">—</span>
                            ) : (
                              parts.map((b) => (
                                <span
                                  key={b.key}
                                  title={`${b.value} ${b.label}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-ink-100/70 px-1.5 py-0.5 text-xs font-medium text-ink-700"
                                >
                                  <b.icon className="h-3 w-3 text-ink-500" />
                                  {b.value}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-ink-900 tabular-nums">{totalItems(log)}</td>
                        <td className="px-3 py-3">
                          {status === 'none' ? (
                            <span className="text-ink-300">—</span>
                          ) : (
                            <Badge variant={status} />
                          )}
                        </td>
                        <td className="px-3 py-3 max-w-[240px]">
                          {log.notes ? (
                            <span className="flex items-start gap-1.5 text-ink-600" title={log.notes}>
                              <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                              <span className="line-clamp-2">{log.notes}</span>
                            </span>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="opacity-60 group-hover:opacity-100 transition-opacity">
                            <Actions log={log} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-ink-100">
              {logs.map((log) => {
                const status = statusOf(log)
                const parts = breakdown(log)
                return (
                  <div key={log.id} className="px-4 py-3.5 flex gap-3">
                    <div className="w-11 shrink-0 text-center rounded-lg bg-ink-50 py-1.5">
                      <p className="text-[10px] font-semibold uppercase text-ink-500">{formatDate(log.production_date, 'MMM')}</p>
                      <p className="text-lg font-bold leading-none text-ink-900">{formatDate(log.production_date, 'd')}</p>
                      <p className="text-[10px] text-ink-400 mt-0.5">{formatDate(log.production_date, 'EEE')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <ClientCell log={log} />
                        <span className="text-sm font-bold text-ink-900 tabular-nums shrink-0">{totalItems(log)}</span>
                      </div>
                      {isAdmin && <p className="text-xs text-ink-500 mt-0.5">{log.profile?.full_name}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {parts.map((b) => (
                          <span key={b.key} className="inline-flex items-center gap-1 rounded-md bg-ink-100/70 px-1.5 py-0.5 text-xs font-medium text-ink-700">
                            <b.icon className="h-3 w-3 text-ink-500" />
                            {b.value}
                          </span>
                        ))}
                        {status !== 'none' && <Badge variant={status} />}
                      </div>
                      {log.notes && <p className="text-xs text-ink-600 mt-1.5 line-clamp-2">{log.notes}</p>}
                    </div>
                    <div className="shrink-0 self-center">
                      <Actions log={log} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-ink-100 bg-ink-50/40">
              <p className="text-xs text-ink-500">
                Page {currentPage + 1} of {totalPages} · {total.toLocaleString()} records
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setFilters((f) => ({ ...f, page: currentPage - 1 }))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage + 1 >= totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: currentPage + 1 }))}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this record?"
        description="This will permanently remove this production log. This can't be undone."
      />
    </div>
  )
}
