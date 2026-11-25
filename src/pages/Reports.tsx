import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Download, Upload } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import {
  SERIES,
  MUTED,
  INK,
  compact,
  xAxisProps,
  yAxisProps,
  gridProps,
  chartMargin,
  lineCursor,
  lineProps,
  activeDot,
  AreaGradient,
  GlowFilter,
  ChartTooltip,
  ChartCard,
  niceY,
  maxOf,
} from '../components/charts/chartKit'
import { RankBarChart } from '../components/charts/GrowthCharts'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Button, Card, Field, Input, PageSpinner, Select } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, videoFormatCsvValues, VIDEO_FORMAT_CSV_COLUMNS, videoFormatTotals, logClientLabel, type Client, type Profile, type ProductionLogWithRelations } from '../types/database'
import { formatDate, startOfMonthISO, todayISO } from '../lib/utils'

type StatusFilter = '' | 'completed' | 'in_progress'

export default function Reports() {
  const { toast } = useToast()
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [logs, setLogs] = useState<ProductionLogWithRelations[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [assistants, setAssistants] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  const [filterClient, setFilterClient] = useState('')
  const [filterAssistant, setFilterAssistant] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')
  const [filterContentType, setFilterContentType] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status), profile:profiles(id, full_name, email)')
      .gte('production_date', dateFrom)
      .lte('production_date', dateTo)
      .order('production_date')
    setLogs((data ?? []) as unknown as ProductionLogWithRelations[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients((data ?? []) as Client[]))
    supabase
      .from('profiles')
      .select('*')
      .order('full_name')
      .then(({ data }) => setAssistants((data ?? []) as Profile[]))
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterClient === 'other_work' && !(l as any).is_other_work) return false
      if (filterClient && filterClient !== 'other_work' && l.client_id !== filterClient) return false
      if (filterAssistant && l.user_id !== filterAssistant) return false
      if (filterContentType && ((l as any)[filterContentType] ?? 0) === 0) return false
      if (filterStatus) {
        // Only fields with items logged have a meaningful status.
        const loggedFields = PRODUCTION_FIELDS.filter((f) => ((l as any)[f.countKey] ?? 0) > 0)
        if (loggedFields.length === 0) return false
        const anyInProgress = loggedFields.some((f) => (l as any)[f.statusKey] === 'in_progress')
        if (filterStatus === 'in_progress' && !anyInProgress) return false
        if (filterStatus === 'completed' && anyInProgress) return false
      }
      return true
    })
  }, [logs, filterClient, filterAssistant, filterStatus, filterContentType])

  const hasActiveFilters = !!(filterClient || filterAssistant || filterStatus || filterContentType)

  function clearFilters() {
    setFilterClient('')
    setFilterAssistant('')
    setFilterStatus('')
    setFilterContentType('')
  }

  const byAssistant = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of filteredLogs) {
      const name = l.profile?.full_name ?? 'Unknown'
      map.set(name, (map.get(name) ?? 0) + totalItems(l))
    }
    return Array.from(map, ([name, total]) => ({ name, total }))
  }, [filteredLogs])

  const byClient = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of filteredLogs) {
      const name = (l as any).is_other_work ? 'Other Work' : l.client?.name ?? 'Unknown'
      map.set(name, (map.get(name) ?? 0) + totalItems(l))
    }
    return Array.from(map, ([name, total]) => ({ name, total })).filter((d) => d.total > 0)
  }, [filteredLogs])

  const byContentType = useMemo(() => {
    // Colour is fixed per content type (by its position in PRODUCTION_FIELDS),
    // so hiding an empty type never repaints the others.
    return PRODUCTION_FIELDS.map((f, i) => ({
      name: f.label,
      color: SERIES[i],
      value: filteredLogs.reduce((sum, l) => sum + ((l as any)[f.countKey] ?? 0), 0),
    })).filter((d) => d.value > 0)
  }, [filteredLogs])
  const contentTotal = byContentType.reduce((s, d) => s + d.value, 0)

  const videoFormats = useMemo(() => videoFormatTotals(filteredLogs), [filteredLogs])
  const formatParts = [
    { label: 'Short-form', value: videoFormats.short, color: SERIES[0], ink: '#fff' },
    { label: 'Long-form', value: videoFormats.long, color: SERIES[1], ink: '#1C1E1C' },
    ...(videoFormats.unspecified > 0
      ? [{ label: 'Not specified', value: videoFormats.unspecified, color: MUTED, ink: '#1C1E1C' }]
      : []),
  ].map((p) => ({ ...p, share: videoFormats.total ? Math.round((p.value / videoFormats.total) * 100) : 0 }))

  const overTime = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of filteredLogs) {
      map.set(l.production_date, (map.get(l.production_date) ?? 0) + totalItems(l))
    }
    return Array.from(map, ([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredLogs])

  const statusSplit = useMemo(() => {
    let completed = 0
    let inProgress = 0
    for (const l of filteredLogs) {
      for (const f of PRODUCTION_FIELDS) {
        const count = (l as any)[f.countKey] ?? 0
        if (count === 0) continue
        if ((l as any)[f.statusKey] === 'completed') completed += count
        else inProgress += count
      }
    }
    return [
      { name: 'Completed', value: completed },
      { name: 'In Progress', value: inProgress },
    ]
  }, [filteredLogs])

  const completionPct = useMemo(() => {
    const [completed, inProgress] = statusSplit
    const total = completed.value + inProgress.value
    return total === 0 ? 0 : Math.round((completed.value / total) * 100)
  }, [statusSplit])

  function exportCsv() {
    const rows = filteredLogs.map((l) => ({
      Date: l.production_date,
      Assistant: l.profile?.full_name ?? '',
      Client: logClientLabel(l as any, ''),
      ...Object.fromEntries(PRODUCTION_FIELDS.map((f) => [f.label, (l as any)[f.countKey]])),
      ...videoFormatCsvValues(l),
      'Total Items': totalItems(l),
      Notes: l.notes ?? '',
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${dateFrom}-to-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    setImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        let imported = 0
        let skipped = 0

        // Build a client name -> id map, creating missing clients as we go.
        const clientMap = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]))

        for (const row of rows) {
          const clientName = (row['Client Name'] || row['Client'] || '').trim()
          const dateRaw = (row['Date'] || '').trim()
          const assistantName = (row['Assistant'] || row['Editor'] || '').trim()
          if (!clientName || !dateRaw || !assistantName) {
            skipped++
            continue
          }

          let clientId = clientMap.get(clientName.toLowerCase())
          if (!clientId) {
            const { data: newClient } = await supabase
              .from('clients')
              .insert({ name: clientName, status: 'active' })
              .select()
              .single()
            if (newClient) {
              clientId = newClient.id
              clientMap.set(clientName.toLowerCase(), newClient.id)
            }
          }

          const { data: assistant } = await supabase
            .from('profiles')
            .select('id')
            .ilike('full_name', assistantName)
            .maybeSingle()

          if (!clientId || !assistant) {
            skipped++
            continue
          }

          const parseCount = (v?: string) => Math.max(0, parseInt(v || '0', 10) || 0)
          const parseStatus = (v?: string) => (v?.trim() === 'X' ? 'completed' : v?.trim() === '/' ? 'in_progress' : 'completed')

          // Optional short/long-form columns (only sent when the file has them,
          // so imports keep working on a database without migration 011).
          const formatCols: Record<string, number> = {}
          for (const c of VIDEO_FORMAT_CSV_COLUMNS) {
            if (row[c.header] !== undefined && row[c.header] !== '') formatCols[c.key] = parseCount(row[c.header])
          }
          const videosEdited = Math.max(
            parseCount(row['Videos Edited']),
            (formatCols.videos_edited_short_count ?? 0) + (formatCols.videos_edited_long_count ?? 0)
          )
          const videosReedited = Math.max(
            parseCount(row['Videos Re-edited']),
            (formatCols.videos_reedited_short_count ?? 0) + (formatCols.videos_reedited_long_count ?? 0)
          )

          await supabase.from('production_logs').insert({
            ...formatCols,
            user_id: assistant.id,
            client_id: clientId,
            production_date: dateRaw,
            videos_edited_count: videosEdited,
            videos_edited_status: parseStatus(row['Videos Edited Checked']),
            videos_reedited_count: videosReedited,
            videos_reedited_status: parseStatus(row['Videos Re-edited Checked']),
            carousels_edited_count: parseCount(row['Carousels Edited']),
            carousels_edited_status: parseStatus(row['Carousels Edited Checked']),
            carousels_reedited_count: parseCount(row['Carousels Re-edited']),
            carousels_reedited_status: parseStatus(row['Carousels Re-edited Checked']),
            text_posts_prepared_count: parseCount(row['Text Posts Prepared']),
            text_posts_prepared_status: parseStatus(row['Text Posts Prepared Checked']),
            text_posts_reedited_count: parseCount(row['Text Posts Re-edited']),
            text_posts_reedited_status: parseStatus(row['Text Posts Re-edited Checked']),
          })
          imported++
        }

        setImporting(false)
        toast(`Imported ${imported} rows${skipped ? `, skipped ${skipped}` : ''}.`, imported ? 'success' : 'error')
        load()
      },
      error: () => {
        setImporting(false)
        toast('Could not parse that CSV file.', 'error')
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500 mt-1">Production breakdowns for the selected period.</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-semibold rounded-lg border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
            <Upload className="h-4 w-4" />
            {importing ? 'Importing…' : 'Import CSV'}
          </label>
          <Button variant="secondary" onClick={exportCsv} disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-wrap gap-4 items-end">
          <Field label="From">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <Field label="Quick range">
            <Select
              onChange={(e) => {
                const v = e.target.value
                const to = todayISO()
                if (v === 'month') setDateFrom(startOfMonthISO())
                if (v === 'today') setDateFrom(to)
                setDateTo(to)
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Choose…
              </option>
              <option value="today">Today</option>
              <option value="month">This Month</option>
            </Select>
          </Field>
        </div>
        <div className="px-4 pb-4 pt-1 border-t border-ink-100 flex flex-wrap gap-4 items-end">
          <Field label="Client">
            <Select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
              <option value="">All clients</option>
              <option value="other_work">Other Work</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assistant">
            <Select value={filterAssistant} onChange={(e) => setFilterAssistant(e.target.value)}>
              <option value="">All assistants</option>
              {assistants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Content Type">
            <Select value={filterContentType} onChange={(e) => setFilterContentType(e.target.value)}>
              <option value="">All content types</option>
              {PRODUCTION_FIELDS.map((f) => (
                <option key={f.countKey} value={f.countKey}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}>
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
            </Select>
          </Field>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" type="button" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <PageSpinner />
      ) : filteredLogs.length === 0 ? (
        <Card>
          <div className="p-10 text-center text-sm text-ink-500">
            No entries match the selected filters.
            {hasActiveFilters && (
              <>
                {' '}
                <button className="text-pine-700 font-medium hover:underline" onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <RankBarChart
            title="Production by assistant"
            subtitle="Total items in the selected range"
            valueName="Items"
            data={byAssistant.map((d) => ({ name: d.name, value: d.total }))}
          />

          <RankBarChart
            title="Production by client"
            subtitle="Total items in the selected range"
            valueName="Items"
            color={SERIES[2]}
            data={byClient.map((d) => ({ name: d.name, value: d.total }))}
          />

          <ChartCard title="Production by content type" subtitle="Share of all items" height={240}>
            <div className="h-full flex items-center gap-4 sm:gap-6">
              <div className="relative h-full aspect-square max-w-[50%] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byContentType}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="68%"
                      outerRadius="96%"
                      paddingAngle={2}
                      cornerRadius={4}
                      stroke="#fff"
                      strokeWidth={2}
                      startAngle={90}
                      endAngle={-270}
                      animationDuration={700}
                    >
                      {byContentType.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip colorFor={(e) => (e.payload?.color as string) ?? undefined} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold tracking-tight text-ink-900">{compact(contentTotal)}</span>
                  <span className="text-[11px] font-medium text-ink-500">items</span>
                </div>
              </div>
              <ul className="flex-1 min-w-0 flex flex-col gap-2">
                {byContentType.map((d) => (
                  <li key={d.name} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: d.color }} />
                    <span className="flex-1 min-w-0 truncate text-ink-700">{d.name}</span>
                    <span className="font-semibold text-ink-900 tabular-nums">{d.value.toLocaleString()}</span>
                    <span className="w-10 text-right text-xs text-ink-500 tabular-nums">
                      {contentTotal ? Math.round((d.value / contentTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ChartCard>

          <ChartCard title="Completed vs in progress" subtitle="By item count" height={240}>
            <div className="h-full flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[300px] h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={SERIES[0]} />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={[{ value: 1 }]}
                      dataKey="value"
                      cx="50%"
                      cy="100%"
                      innerRadius="150%"
                      outerRadius="196%"
                      startAngle={180}
                      endAngle={0}
                      fill={INK.grid}
                      stroke="none"
                      isAnimationActive={false}
                    />
                    <Pie
                      data={statusSplit}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="100%"
                      innerRadius="150%"
                      outerRadius="196%"
                      cornerRadius={6}
                      startAngle={180}
                      endAngle={0}
                      stroke="none"
                      animationDuration={800}
                    >
                      <Cell fill="url(#gaugeFill)" />
                      <Cell fill="transparent" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none">
                  <span className="text-[32px] leading-none font-bold tracking-tight text-ink-900">{completionPct}%</span>
                  <span className="text-xs text-ink-500 mt-1">completed</span>
                </div>
              </div>
              <div className="flex items-center gap-6 mt-5">
                {statusSplit.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i === 0 ? SERIES[0] : INK.grid }} />
                    <span className="text-ink-600">{s.name}</span>
                    <span className="font-semibold text-ink-900 tabular-nums">{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title="Video format"
            subtitle="Short-form vs long-form, edited and re-edited videos"
            className="lg:col-span-2"
            height={videoFormats.total === 0 ? 24 : videoFormats.unspecified > 0 ? 92 : 68}
          >
            {videoFormats.total === 0 ? (
              <p className="text-sm text-ink-500">No videos in the selected range.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  className="flex h-7 w-full gap-[2px]"
                  role="img"
                  aria-label={formatParts.map((p) => `${p.label}: ${p.value} (${p.share}%)`).join(', ')}
                >
                  {formatParts
                    .filter((p) => p.value > 0)
                    .map((p) => (
                      <div
                        key={p.label}
                        title={`${p.label}: ${p.value.toLocaleString()} (${p.share}%)`}
                        className="h-full rounded flex items-center px-2 text-xs font-semibold overflow-hidden transition-all"
                        style={{ width: `${(p.value / videoFormats.total) * 100}%`, background: p.color, color: p.ink }}
                      >
                        {p.share >= 9 && <span className="whitespace-nowrap">{p.share}%</span>}
                      </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
                  {formatParts.map((p) => (
                    <span key={p.label} className="inline-flex items-center gap-2 text-[13px]">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
                      <span className="text-ink-600">{p.label}</span>
                      <span className="font-semibold text-ink-900 tabular-nums">{p.value.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
                {videoFormats.unspecified > 0 && (
                  <p className="text-xs text-ink-500">
                    "Not specified" are videos logged before short/long-form tracking, or not split by format.
                  </p>
                )}
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Production over time"
            subtitle={`${compact(overTime.reduce((s, d) => s + d.total, 0))} items across ${overTime.length} day${overTime.length === 1 ? '' : 's'}`}
            className="lg:col-span-2"
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overTime} margin={chartMargin}>
                <defs>
                  <AreaGradient id="prodArea" color={SERIES[0]} strength={0.24} />
                  <GlowFilter id="prodGlow" color={SERIES[0]} />
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...xAxisProps} tickFormatter={(d: string) => formatDate(d, 'MMM d')} />
                <YAxis {...yAxisProps} allowDecimals={false} {...niceY(maxOf(overTime, ['total']), { integer: true })} />
                <Tooltip cursor={lineCursor} content={<ChartTooltip labelFormatter={(d) => formatDate(String(d), 'EEE, MMM d')} />} />
                <Area
                  {...lineProps}
                  dataKey="total"
                  name="Items"
                  stroke={SERIES[0]}
                  fill="url(#prodArea)"
                  filter="url(#prodGlow)"
                  activeDot={activeDot(SERIES[0])}
                  animationDuration={700}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  )
}
