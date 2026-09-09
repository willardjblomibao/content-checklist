import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useProductionLogs, deleteProductionLog, type LogFilters } from '../hooks/useProductionLogs'
import { Badge, Button, Card, EmptyState, Field, PageSpinner, Select, Input } from '../components/ui/primitives'
import { ConfirmDialog } from '../components/ui/dialog'
import { PRODUCTION_FIELDS, totalItems, type Client, type Profile } from '../types/database'
import { dayOfWeek, formatDate } from '../lib/utils'

const PAGE_SIZE = 20

export default function History() {
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [clients, setClients] = useState<Client[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [filters, setFilters] = useState<LogFilters>({
    page: 0,
    pageSize: PAGE_SIZE,
    sortBy: 'production_date',
    sortDir: 'desc',
    userId: isAdmin ? undefined : profile?.id,
  })
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  function setFilter<K extends keyof LogFilters>(key: K, value: LogFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: 0 }))
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
      Client: log.client?.name ?? '',
      ...Object.fromEntries(
        PRODUCTION_FIELDS.map((f) => [f.label, (log as any)[f.countKey]])
      ),
      'Total Items': totalItems(log),
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">History</h1>
          <p className="text-sm text-ink-500 mt-1">Search and review past production entries.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={logs.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isAdmin && (
            <Field label="Assistant">
              <Select value={filters.userId ?? ''} onChange={(e) => setFilter('userId', e.target.value || undefined)}>
                <option value="">All assistants</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Client">
            <Select value={filters.clientId ?? ''} onChange={(e) => setFilter('clientId', e.target.value || undefined)}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilter('dateFrom', e.target.value || undefined)} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilter('dateTo', e.target.value || undefined)} />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : logs.length === 0 ? (
          <EmptyState title="No records found" description="Try widening your filters, or add a new daily log." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3 whitespace-nowrap">Day</th>
                    {isAdmin && <th className="px-3 py-3 whitespace-nowrap">Assistant</th>}
                    <th className="px-3 py-3 whitespace-nowrap">Client</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Total</th>
                    <th className="px-3 py-3 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const canEdit = isAdmin || log.user_id === profile?.id
                    // Only fields that actually have items logged count toward
                    // the status — a 0-count field has no meaningful status.
                    const loggedFields = PRODUCTION_FIELDS.filter((f) => ((log as any)[f.countKey] ?? 0) > 0)
                    const anyInProgress = loggedFields.some((f) => (log as any)[f.statusKey] === 'in_progress')
                    return (
                      <tr key={log.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
                        <td className="px-5 py-3 whitespace-nowrap text-ink-800">{formatDate(log.production_date)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-ink-500">{dayOfWeek(log.production_date)}</td>
                        {isAdmin && (
                          <td className="px-3 py-3 whitespace-nowrap text-ink-700">{log.profile?.full_name ?? '—'}</td>
                        )}
                        <td className="px-3 py-3 whitespace-nowrap text-ink-700">{log.client?.name ?? '—'}</td>
                        <td className="px-3 py-3 text-right font-semibold text-ink-900">{totalItems(log)}</td>
                        <td className="px-3 py-3">
                          {loggedFields.length === 0 ? (
                            <Badge variant="neutral">No items</Badge>
                          ) : (
                            <Badge variant={anyInProgress ? 'in_progress' : 'completed'} />
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => navigate(`/daily-log?edit=${log.id}`)}
                                  className="p-1.5 text-ink-500 hover:text-pine-700 hover:bg-pine-50 rounded-md"
                                  aria-label="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setPendingDelete(log.id)}
                                  className="p-1.5 text-ink-500 hover:text-clay-600 hover:bg-clay-50 rounded-md"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-ink-100">
              <p className="text-xs text-ink-500">
                Page {currentPage + 1} of {totalPages} · {total} records
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
