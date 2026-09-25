import { useEffect, useMemo, useState } from 'react'
import { GitCompare, FileDown, FileSpreadsheet, FileText, Crown } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Card, EmptyState, PageSpinner, Select } from '../../components/ui/primitives'
import type { Client, Platform, WeeklyMetric } from '../../types/database'
import { cn } from '../../lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_IN_MONTH = (year: number, monthIndex1: number) => new Date(year, monthIndex1, 0).getDate()

interface MonthRow {
  month: string
  monthIndex: number
  aViews: number
  aFollowers: number
  bViews: number
  bFollowers: number
}

export default function PlatformComparison() {
  const { isAdmin, assignedClients } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [platformA, setPlatformA] = useState('')
  const [platformB, setPlatformB] = useState('')
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [rows, setRows] = useState<WeeklyMetric[]>([])
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
      setPlatforms([])
      return
    }
    supabase
      .from('platforms')
      .select('*')
      .eq('client_id', clientId)
      .order('name')
      .then(({ data }) => {
        const list = (data ?? []) as Platform[]
        setPlatforms(list)
        setPlatformA((a) => (a && list.some((p) => p.id === a) ? a : list[0]?.id ?? '')
        )
        setPlatformB((b) => (b && list.some((p) => p.id === b) ? b : list[1]?.id ?? list[0]?.id ?? ''))
      })
  }, [clientId])

  useEffect(() => {
    if (!clientId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase.from('weekly_metrics').select('*').eq('client_id', clientId)
    if (year !== 'all') query = query.eq('year', Number(year))
    query.then(({ data }) => {
      setRows((data ?? []) as WeeklyMetric[])
      setLoading(false)
    })
  }, [clientId, year])

  const platformAName = platforms.find((p) => p.id === platformA)?.name ?? 'Platform A'
  const platformBName = platforms.find((p) => p.id === platformB)?.name ?? 'Platform B'

  const monthly: MonthRow[] = useMemo(() => {
    return MONTHS.map((month, i) => {
      const monthIndex = i + 1
      const monthRows = rows.filter((r) => Number(r.week_start.slice(5, 7)) === monthIndex)
      const sum = (platformId: string, key: 'views' | 'new_audience') =>
        monthRows.filter((r) => r.platform_id === platformId).reduce((s, r) => s + r[key], 0)
      return {
        month,
        monthIndex,
        aViews: sum(platformA, 'views'),
        aFollowers: sum(platformA, 'new_audience'),
        bViews: sum(platformB, 'views'),
        bFollowers: sum(platformB, 'new_audience'),
      }
    })
  }, [rows, platformA, platformB])

  const monthsWithData = monthly.filter((m) => m.aViews || m.aFollowers || m.bViews || m.bFollowers)

  const totals = useMemo(() => {
    const sumOf = (key: keyof MonthRow) => monthly.reduce((s, m) => s + (m[key] as number), 0)
    const aViews = sumOf('aViews')
    const aFollowers = sumOf('aFollowers')
    const bViews = sumOf('bViews')
    const bFollowers = sumOf('bFollowers')
    // "All years" spans multiple calendar years, so days-in-month is only ever an
    // approximation there — fall back to the current year's calendar for that case.
    const dayCountYear = year === 'all' ? new Date().getFullYear() : Number(year)
    const activeDays = monthsWithData.reduce((s, m) => s + DAYS_IN_MONTH(dayCountYear, m.monthIndex), 0) || 1
    return {
      aViews,
      aFollowers,
      bViews,
      bFollowers,
      aVpf: aFollowers > 0 ? aViews / aFollowers : null,
      bVpf: bFollowers > 0 ? bViews / bFollowers : null,
      aFpd: aFollowers / activeDays,
      bFpd: bFollowers / activeDays,
    }
  }, [monthly, monthsWithData, year])

  const chartData = monthly.map((m) => ({
    month: m.month.slice(0, 3),
    [platformAName]: m.aViews,
    [platformBName]: m.bViews,
  }))

  function winner(a: number | null, b: number | null) {
    if (a === null || b === null || a === b) return null
    return a > b ? 'a' : 'b'
  }

  const rowsForExport = monthsWithData.map((m) => {
    const daysA = DAYS_IN_MONTH(year === 'all' ? new Date().getFullYear() : Number(year), m.monthIndex)
    return {
      Month: m.month,
      [`${platformAName} Views`]: m.aViews,
      [`${platformAName} Followers`]: m.aFollowers,
      [`${platformAName} VPF`]: m.aFollowers > 0 ? Number((m.aViews / m.aFollowers).toFixed(2)) : '',
      [`${platformAName} FPD`]: Number((m.aFollowers / daysA).toFixed(2)),
      [`${platformBName} Views`]: m.bViews,
      [`${platformBName} Followers`]: m.bFollowers,
      [`${platformBName} VPF`]: m.bFollowers > 0 ? Number((m.bViews / m.bFollowers).toFixed(2)) : '',
      [`${platformBName} FPD`]: Number((m.bFollowers / daysA).toFixed(2)),
    }
  })

  const clientName = isAdmin
    ? clients.find((c) => c.id === clientId)?.name ?? 'client'
    : assignedClients.find((c) => c.id === clientId)?.name ?? 'client'

  function exportCsv() {
    const header = Object.keys(rowsForExport[0] ?? {})
    const csv = [header, ...rowsForExport.map((r) => header.map((h) => (r as any)[h]))].map((l) => l.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${platformAName}-vs-${platformBName}-${clientName}-${year === 'all' ? 'all-years' : year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(rowsForExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${platformAName} vs ${platformBName}`)
    XLSX.writeFile(wb, `${platformAName}-vs-${platformBName}-${clientName}-${year === 'all' ? 'all-years' : year}.xlsx`)
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(`${platformAName} vs ${platformBName} — ${clientName}`, 14, 16)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`${year === 'all' ? 'All Years' : year}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [Object.keys(rowsForExport[0] ?? {})],
      body: rowsForExport.map((r) => Object.values(r)),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [47, 107, 79] },
    })
    doc.save(`${platformAName}-vs-${platformBName}-${clientName}-${year === 'all' ? 'all-years' : year}.pdf`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-pine-700" />
            Platform vs Platform
          </h1>
          <p className="text-sm text-ink-500 mt-1">Views, Followers, Views-per-Follower and Followers-per-Day, side by side, by month.</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          {isAdmin && clients.length > 0 && (
            <FilterField label="Client">
              <Select className="w-44" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          {!isAdmin && assignedClients.length > 1 && (
            <FilterField label="Client">
              <Select className="w-44" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {assignedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          <FilterField label="Year">
            <Select className="w-24" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="all">ALL</option>
              {[Number(year) || new Date().getFullYear(), Number(year) - 1, Number(year) - 2]
                .filter((v, i, a) => !Number.isNaN(v) && a.indexOf(v) === i)
                .map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
            </Select>
          </FilterField>
          <FilterField label="Platform A">
            <Select className="w-40" value={platformA} onChange={(e) => setPlatformA(e.target.value)}>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Platform B">
            <Select className="w-40" value={platformB} onChange={(e) => setPlatformB(e.target.value)}>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="secondary" onClick={exportCsv} disabled={monthsWithData.length === 0}>
              <FileDown className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="secondary" onClick={exportExcel} disabled={monthsWithData.length === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" onClick={exportPdf} disabled={monthsWithData.length === 0}>
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageSpinner />
      ) : !clientId ? (
        <EmptyState
          title={isAdmin ? 'No client selected' : 'No client assigned yet'}
          description={isAdmin ? 'Pick a client above.' : 'Ask an admin to assign you to a client from the Team page.'}
        />
      ) : platforms.length < 2 ? (
        <EmptyState title="Need at least 2 platforms" description="Add another platform for this client from the Platforms page to compare." />
      ) : monthsWithData.length === 0 ? (
        <EmptyState title={`No data for ${year === 'all' ? 'any year' : year} yet`} description="Add weekly growth data first from the Weekly Growth page." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ComparisonCard
              name={platformAName}
              views={totals.aViews}
              followers={totals.aFollowers}
              vpf={totals.aVpf}
              fpd={totals.aFpd}
              isViewsWinner={winner(totals.aViews, totals.bViews) === 'a'}
              isFollowersWinner={winner(totals.aFollowers, totals.bFollowers) === 'a'}
            />
            <ComparisonCard
              name={platformBName}
              views={totals.bViews}
              followers={totals.bFollowers}
              vpf={totals.bVpf}
              fpd={totals.bFpd}
              isViewsWinner={winner(totals.aViews, totals.bViews) === 'b'}
              isFollowersWinner={winner(totals.aFollowers, totals.bFollowers) === 'b'}
            />
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-800 mb-4">Monthly Views — {platformAName} vs {platformBName}</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF0EE" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={platformAName} stroke="#2F6B4F" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey={platformBName} stroke="#D97757" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100">
              <h2 className="text-sm font-semibold text-ink-800">Monthly Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Month</th>
                    <th className="px-3 py-3 text-right">{platformAName} Views</th>
                    <th className="px-3 py-3 text-right">{platformAName} Followers</th>
                    <th className="px-3 py-3 text-right">{platformBName} Views</th>
                    <th className="px-5 py-3 text-right">{platformBName} Followers</th>
                  </tr>
                </thead>
                <tbody>
                  {monthsWithData.map((m) => (
                    <tr key={m.month} className="border-b border-ink-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-ink-900">{m.month}</td>
                      <td className={cn('px-3 py-3 text-right', m.aViews >= m.bViews ? 'text-pine-700 font-medium' : 'text-ink-600')}>
                        {m.aViews.toLocaleString()}
                      </td>
                      <td className={cn('px-3 py-3 text-right', m.aFollowers >= m.bFollowers ? 'text-pine-700 font-medium' : 'text-ink-600')}>
                        {m.aFollowers.toLocaleString()}
                      </td>
                      <td className={cn('px-3 py-3 text-right', m.bViews >= m.aViews ? 'text-clay-600 font-medium' : 'text-ink-600')}>
                        {m.bViews.toLocaleString()}
                      </td>
                      <td className={cn('px-5 py-3 text-right', m.bFollowers >= m.aFollowers ? 'text-clay-600 font-medium' : 'text-ink-600')}>
                        {m.bFollowers.toLocaleString()}
                      </td>
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  )
}

function ComparisonCard({
  name,
  views,
  followers,
  vpf,
  fpd,
  isViewsWinner,
  isFollowersWinner,
}: {
  name: string
  views: number
  followers: number
  vpf: number | null
  fpd: number
  isViewsWinner: boolean
  isFollowersWinner: boolean
}) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-ink-900 mb-3">{name}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Views" value={views.toLocaleString()} winner={isViewsWinner} />
        <Stat label="Followers Gained" value={followers.toLocaleString()} winner={isFollowersWinner} />
        <Stat label="Views per Follower" value={vpf === null ? '—' : vpf.toFixed(1)} />
        <Stat label="Followers per Day" value={fpd.toFixed(2)} />
      </div>
    </Card>
  )
}

function Stat({ label, value, winner }: { label: string; value: string; winner?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-500 flex items-center gap-1">
        {label}
        {winner && <Crown className="h-3 w-3 text-amber-500" />}
      </p>
      <p className="text-lg font-semibold text-ink-900 mt-0.5">{value}</p>
    </div>
  )
}
