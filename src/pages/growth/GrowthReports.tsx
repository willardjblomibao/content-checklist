import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Card, EmptyState, Field, Input, PageSpinner, Select } from '../../components/ui/primitives'
import type { Client, Platform, WeeklyMetric } from '../../types/database'
import { formatDate, startOfMonthISO, todayISO } from '../../lib/utils'

type Row = WeeklyMetric & { platform: Pick<Platform, 'id' | 'name'> | null }

export default function GrowthReports() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

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
      .select('*, platform:platforms(id, name)')
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Growth Reports</h1>
        <p className="text-sm text-ink-500 mt-1">
          {isAdmin ? 'Export any client’s growth data as CSV, Excel or PDF.' : 'Export your assigned client’s growth data.'}
        </p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <Field label="Client">
            {isAdmin ? (
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : assignedClients.length > 1 ? (
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {assignedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="h-9 flex items-center px-3 text-sm text-ink-700 bg-ink-50 border border-ink-100 rounded-md">
                {assignedClients[0]?.name ?? 'No client assigned'}
              </div>
            )}
          </Field>
          <Field label="From">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              <FileDown className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="secondary" onClick={exportExcel} disabled={rows.length === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" onClick={exportPdf} disabled={rows.length === 0}>
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageSpinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No data in this range" description="Widen the date range or add weekly growth data first." />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-ink-800">{rows.length} entries</h2>
            <p className="text-xs text-ink-500">
              {totalViews.toLocaleString()} total views · {totalAudience.toLocaleString()} new audience
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                  <th className="px-5 py-3">Week</th>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3 text-right">Views</th>
                  <th className="px-5 py-3 text-right">New Audience</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3 text-ink-700 whitespace-nowrap">{formatDate(r.week_start)}</td>
                    <td className="px-3 py-3 text-ink-700">{r.platform?.name ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-ink-600">{r.views.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-ink-600">{r.new_audience.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
