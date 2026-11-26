import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Card, EmptyState, Field, Input, PageSpinner, Select, PageHeader, StatCard } from '../../components/ui/primitives'
import { format, startOfQuarter, startOfYear, subDays } from 'date-fns'
import type { Client, Platform, WeeklyMetric } from '../../types/database'
import { cn, formatDate, startOfMonthISO, todayISO } from '../../lib/utils'

type Row = WeeklyMetric & { platform: Pick<Platform, 'id' | 'name' | 'color'> | null }

export default function GrowthReports() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<'4w' | 'month' | 'quarter' | 'ytd' | 'custom'>('month')

  useEffect(() => {
    if (isAdmin) {
      supabase
        .from('clients')
        .select('*')
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
      .select('*, platform:platforms(id, name, color)')
      .eq('client_id', clientId)
      .gte('week_start', dateFrom)
      .lte('week_start', dateTo)
      .order('week_start')
      .then(({ data }) => {
        setRows((data ?? []) as unknown as Row[])
        setLoading(false)
      })
  }, [clientId, dateFrom, dateTo])

  const clientName = isAdmin
    ? clients.find((c) => c.id === clientId)?.name ?? 'client'
    : assignedClients.find((c) => c.id === clientId)?.name ?? 'client'

  const tableRows = useMemo(
    () =>
      rows.map((r) => ({
        'Week Start': formatDate(r.week_start),
        Year: r.year,
        Month: r.month,
        Week: r.week,
        Platform: r.platform?.name ?? '—',
        Views: r.views,
        'New Audience': r.new_audience,
      })),
    [rows]
  )

  function exportCsv() {
    const header = Object.keys(tableRows[0] ?? {})
    const csv = [header, ...tableRows.map((r) => header.map((h) => (r as any)[h]))]
      .map((line) => line.join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `growth-${clientName}-${dateFrom}-to-${dateTo}.csv`)
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(tableRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Growth')
    XLSX.writeFile(wb, `growth-${clientName}-${dateFrom}-to-${dateTo}.xlsx`)
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(`Growth Report — ${clientName}`, 14, 16)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`${formatDate(dateFrom)} – ${formatDate(dateTo)}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [Object.keys(tableRows[0] ?? {})],
      body: tableRows.map((r) => Object.values(r)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [47, 107, 79] },
    })
    doc.save(`growth-${clientName}-${dateFrom}-to-${dateTo}.pdf`)
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const totalAudience = rows.reduce((s, r) => s + r.new_audience, 0)

  const platformCount = new Set(rows.map((r) => r.platform?.name).filter(Boolean)).size
  const clientOptions = isAdmin ? clients : assignedClients

  function applyPreset(p: typeof preset) {
    setPreset(p)
    const today = new Date()
    const iso = (d: Date) => format(d, 'yyyy-MM-dd')
    if (p === '4w') {
      setDateFrom(iso(subDays(today, 27)))
      setDateTo(iso(today))
    } else if (p === 'month') {
      setDateFrom(startOfMonthISO())
      setDateTo(todayISO())
    } else if (p === 'quarter') {
      setDateFrom(iso(startOfQuarter(today)))
      setDateTo(iso(today))
    } else if (p === 'ytd') {
      setDateFrom(iso(startOfYear(today)))
      setDateTo(iso(today))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Growth reports"
        description={isAdmin ? 'Export any client’s growth data as CSV, Excel or PDF.' : 'Export your assigned client’s growth data.'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
        <Card className="lg:sticky lg:top-[132px]">
          <div className="p-5 flex flex-col gap-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Report settings</h2>
            <Field label="Client">
              {clientOptions.length > 1 ? (
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="h-10 flex items-center px-3 text-sm font-medium text-ink-800 bg-ink-50 border border-ink-100 rounded-lg">
                  {clientOptions[0]?.name ?? 'No client assigned'}
                </div>
              )}
            </Field>
            <div>
              <p className="text-sm font-medium text-ink-700 mb-1.5">Date range</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['4w', 'Last 4 wks'],
                    ['month', 'This month'],
                    ['quarter', 'Quarter'],
                    ['ytd', 'Year to date'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyPreset(k)}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors',
                      preset === k ? 'border-pine-500 bg-pine-50 text-pine-800' : 'border-ink-200 text-ink-600 hover:border-ink-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Field label="From">
                  <Input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setPreset('custom')
                    }}
                  />
                </Field>
                <Field label="To">
                  <Input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setPreset('custom')
                    }}
                  />
                </Field>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-4 border-t border-ink-100">
              <Button type="button" onClick={exportPdf} disabled={rows.length === 0} className="w-full">
                <FileText className="h-4 w-4" />
                Download PDF
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="secondary" onClick={exportExcel} disabled={rows.length === 0}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button type="button" variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
                  <FileDown className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-5 min-w-0">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard highlight label="Total views" value={totalViews.toLocaleString()} />
            <StatCard label="New audience" value={`${totalAudience >= 0 ? '+' : ''}${totalAudience.toLocaleString()}`} />
            <StatCard label="Entries" value={rows.length} />
            <StatCard label="Platforms" value={platformCount} />
          </div>

          {loading ? (
            <PageSpinner />
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState title="No data in this range" description="Widen the date range or add weekly growth data first." />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-[15px] font-semibold text-ink-900">What's in the report</h2>
                <p className="text-xs text-ink-500">
                  {formatDate(dateFrom, 'MMM d, yyyy')} – {formatDate(dateTo, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-[1]">
                    <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs font-semibold text-ink-500">
                      <th className="px-5 py-3">Week</th>
                      <th className="px-3 py-3">Platform</th>
                      <th className="px-3 py-3 text-right">Views</th>
                      <th className="px-5 py-3 text-right">New audience</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-ink-100/70 last:border-0 hover:bg-ink-50/60">
                        <td className="px-5 py-2.5 text-ink-700 whitespace-nowrap">{formatDate(r.week_start, 'MMM d, yyyy')}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium text-ink-800">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.platform?.color ?? '#B9BCB4' }} />
                            {r.platform?.name ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-ink-900 tabular-nums">{r.views.toLocaleString()}</td>
                        <td className={cn('px-5 py-2.5 text-right tabular-nums', r.new_audience < 0 ? 'text-clay-600 font-semibold' : 'text-ink-600')}>
                          {r.new_audience.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
