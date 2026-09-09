import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Download, Upload } from 'lucide-react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Button, Card, Field, Input, PageSpinner, Select } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, type Client, type Profile, type ProductionLogWithRelations } from '../types/database'
import { startOfMonthISO, todayISO } from '../lib/utils'

const COLORS = ['#177566', '#D2920F', '#3DA491', '#B5790A', '#7BC2B4', '#0F4F44']

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
      if (filterClient && l.client_id !== filterClient) return false
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
      const name = l.client?.name ?? 'Unknown'
      map.set(name, (map.get(name) ?? 0) + totalItems(l))
    }
    return Array.from(map, ([name, total]) => ({ name, total }))
  }, [filteredLogs])

  const byContentType = useMemo(() => {
    return PRODUCTION_FIELDS.map((f) => ({
      name: f.label,
      value: filteredLogs.reduce((sum, l) => sum + ((l as any)[f.countKey] ?? 0), 0),
    })).filter((d) => d.value > 0)
  }, [filteredLogs])

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
      Client: l.client?.name ?? '',
      ...Object.fromEntries(PRODUCTION_FIELDS.map((f) => [f.label, (l as any)[f.countKey]])),
      'Total Items': totalItems(l),
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

          await supabase.from('production_logs').insert({
            user_id: assistant.id,
            client_id: clientId,
            production_date: dateRaw,
            videos_edited_count: parseCount(row['Videos Edited']),
            videos_edited_status: parseStatus(row['Videos Edited Checked']),
            videos_reedited_count: parseCount(row['Videos Re-edited']),
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
          <h1 className="text-xl font-semibold text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500 mt-1">Production breakdowns for the selected period.</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium rounded-md border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 cursor-pointer">
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
          <ChartCard title="Production by Assistant">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byAssistant}>
                <defs>
                  <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3DA491" />
                    <stop offset="100%" stopColor="#0F4F44" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#EFF8F6' }} />
                <Bar dataKey="total" fill="url(#barGreen)" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Production by Client">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byClient}>
                <defs>
                  <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D2920F" />
                    <stop offset="100%" stopColor="#B5790A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#FDF5E7' }} />
                <Bar dataKey="total" fill="url(#barAmber)" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Production by Content Type">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={byContentType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  cornerRadius={6}
                >
                  {byContentType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Completed vs In Progress">
            <div className="relative flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusSplit}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="90%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={3}
                    cornerRadius={8}
                    startAngle={180}
                    endAngle={0}
                  >
                    <Cell fill="#177566" stroke="none" />
                    <Cell fill="#DBDDD7" stroke="none" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-x-0 bottom-6 flex flex-col items-center pointer-events-none">
                <span className="text-2xl font-semibold text-ink-900">{completionPct}%</span>
                <span className="text-xs text-ink-500">Completed</span>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Production Over Time" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={overTime}>
                <defs>
                  <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#177566" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#177566" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFEA" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#177566"
                  strokeWidth={2.5}
                  fill="url(#areaGreen)"
                  dot={{ r: 3, fill: '#177566', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#177566', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="p-5">
        <h3 className="text-sm font-semibold text-ink-800 mb-3">{title}</h3>
        {children}
      </div>
    </Card>
  )
}
