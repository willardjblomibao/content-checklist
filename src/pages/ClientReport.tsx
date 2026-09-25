import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Papa from 'papaparse'
import { Download, Printer, FileWarning } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Field, PageSpinner, Select, Input } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, type ClientReportLog } from '../types/database'
import { formatDate, startOfMonthISO, todayISO } from '../lib/utils'

type StatusFilter = '' | 'completed' | 'in_progress'

/**
 * Standalone, unauthenticated page: rendered outside <ProtectedRoute> and
 * <AppLayout> so it has no admin nav, no login gate, and works for anyone
 * holding the link. Access is entirely governed by the token — see
 * supabase/migrations/006_client_share_links.sql. Nothing here ever touches
 * the production_logs table directly; both loads go through security-definer
 * RPCs scoped to this one token's client.
 */
export default function ClientReport() {
  const { token } = useParams<{ token: string }>()

  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [clientName, setClientName] = useState('')
  const [logs, setLogs] = useState<ClientReportLog[]>([])

  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [filterContentType, setFilterContentType] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')

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
        } else {
          setClientName(row.client_name)
          setStatus('ready')
        }
      })
  }, [token])

  useEffect(() => {
    if (status !== 'ready' || !token) return
    supabase
      .rpc('get_client_report_logs', { p_token: token, p_date_from: dateFrom, p_date_to: dateTo })
      .then(({ data }) => setLogs((data ?? []) as ClientReportLog[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, dateFrom, dateTo])

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterContentType && ((l as any)[filterContentType] ?? 0) === 0) return false
      if (filterStatus) {
        const loggedFields = PRODUCTION_FIELDS.filter((f) => ((l as any)[f.countKey] ?? 0) > 0)
        if (loggedFields.length === 0) return false
        const anyInProgress = loggedFields.some((f) => (l as any)[f.statusKey] === 'in_progress')
        if (filterStatus === 'in_progress' && !anyInProgress) return false
        if (filterStatus === 'completed' && anyInProgress) return false
      }
      return true
    })
  }, [logs, filterContentType, filterStatus])

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const f of PRODUCTION_FIELDS) t[f.countKey] = 0
    for (const l of filteredLogs) {
      for (const f of PRODUCTION_FIELDS) t[f.countKey] += (l as any)[f.countKey] ?? 0
    }
    return t
  }, [filteredLogs])

  const grandTotal = filteredLogs.reduce((sum, l) => sum + totalItems(l as any), 0)

  function handlePrint() {
    window.print()
  }

  function handleExportCsv() {
    const rows = filteredLogs.map((l) => {
      const row: Record<string, string | number> = { Date: l.production_date }
      for (const f of PRODUCTION_FIELDS) {
        row[f.label] = (l as any)[f.countKey]
        row[`${f.label} Status`] = (l as any)[f.statusKey]
      }
      return row
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientName.replace(/\s+/g, '-').toLowerCase()}-report-${dateFrom}-to-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
            <h1 className="text-xl font-semibold text-ink-900">{clientName} — Production Report</h1>
            <p className="text-sm text-ink-500 mt-1">
              {formatDate(dateFrom)} – {formatDate(dateTo)} · view-only
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        <Card className="p-4 print:hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="From">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Field>
            <Field label="Content Type">
              <Select value={filterContentType} onChange={(e) => setFilterContentType(e.target.value)}>
                <option value="">All types</option>
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
          </div>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRODUCTION_FIELDS.map((f) => (
            <Card key={f.countKey} className="p-4">
              <p className="text-xs text-ink-500">{f.label}</p>
              <p className="text-xl font-semibold text-ink-900 mt-1">{totals[f.countKey]}</p>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-ink-500 p-6 text-center">No production logged for this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Date</th>
                    {PRODUCTION_FIELDS.map((f) => (
                      <th key={f.countKey} className="px-3 py-3 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-3 whitespace-nowrap text-ink-900">{formatDate(l.production_date)}</td>
                      {PRODUCTION_FIELDS.map((f) => {
                        const count = (l as any)[f.countKey] as number
                        const st = (l as any)[f.statusKey] as string
                        return (
                          <td key={f.countKey} className="px-3 py-3 text-ink-700">
                            {count > 0 ? (
                              <span className={st === 'in_progress' ? 'text-amber-600' : ''}>{count}</span>
                            ) : (
                              <span className="text-ink-300">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-right font-medium text-ink-900">{totalItems(l as any)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-sm text-ink-500 text-right">
          Grand total: <span className="font-semibold text-ink-900">{grandTotal}</span> items
        </p>
      </div>
    </div>
  )
}
