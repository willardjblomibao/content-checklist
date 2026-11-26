import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Trash2, ClipboardPaste, UploadCloud, AlertTriangle, FileSpreadsheet, FileUp, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button, Card, EmptyState, Field, Input, PageSpinner, Select, Textarea, PageHeader, SectionTitle } from '../../components/ui/primitives'
import { ConfirmDialog } from '../../components/ui/dialog'
import type { Client, Platform, WeeklyMetric } from '../../types/database'
import { formatDate, mondayOfISO, todayISO, weekMeta, detectAnomalies, cn, parseMonthlyWideReport } from '../../lib/utils'

type Row = WeeklyMetric & { platform: Pick<Platform, 'id' | 'name' | 'color'> | null }

export default function GrowthInput() {
  const { profile, isAdmin, assignedClients } = useAuth()
  const { toast } = useToast()

  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [weekStart, setWeekStart] = useState(mondayOfISO(todayISO()))
  const [values, setValues] = useState<Record<string, { views: string; new_audience: string; total_audience: string }>>({})
  const [existing, setExisting] = useState<Record<string, WeeklyMetric>>({})
  const [previousTotals, setPreviousTotals] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [loadingPlatforms, setLoadingPlatforms] = useState(true)
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [showMonthlyImport, setShowMonthlyImport] = useState(false)
  const [monthlyImportText, setMonthlyImportText] = useState('')
  const [monthlyImportYear, setMonthlyImportYear] = useState(new Date().getFullYear())
  const [monthlyImporting, setMonthlyImporting] = useState(false)
  const [monthlyFileSheets, setMonthlyFileSheets] = useState<string[]>([])
  const [monthlyFileWorkbook, setMonthlyFileWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [monthlyFileName, setMonthlyFileName] = useState('')

  const [recent, setRecent] = useState<Row[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [toDelete, setToDelete] = useState<Row | null>(null)

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
    if (!clientId) return
    setLoadingPlatforms(true)
    supabase
      .from('platforms')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        setPlatforms((data ?? []) as Platform[])
        setLoadingPlatforms(false)
      })
  }, [clientId])

  function loadRecent() {
    if (!clientId) return
    setLoadingRecent(true)
    supabase
      .from('weekly_metrics')
      .select('*, platform:platforms(id, name, color)')
      .eq('client_id', clientId)
      .order('week_start', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setRecent((data ?? []) as unknown as Row[])
        setLoadingRecent(false)
      })
  }

  useEffect(loadRecent, [clientId])

  // Pre-fill the form with whatever's already saved for this client + week,
  // and look up each platform's most recent prior total_audience (for the
  // "Change" hint — same idea as AUDIENCE TOTALS' Change column).
  useEffect(() => {
    if (!clientId || platforms.length === 0) return
    supabase
      .from('weekly_metrics')
      .select('*')
      .eq('client_id', clientId)
      .eq('week_start', weekStart)
      .then(({ data }) => {
        const rows = (data ?? []) as WeeklyMetric[]
        const byPlatform: Record<string, WeeklyMetric> = {}
        const nextValues: Record<string, { views: string; new_audience: string; total_audience: string }> = {}
        for (const p of platforms) {
          const row = rows.find((r) => r.platform_id === p.id)
          if (row) byPlatform[p.id] = row
          nextValues[p.id] = {
            views: row ? String(row.views) : '',
            new_audience: row ? String(row.new_audience) : '',
            total_audience: row?.total_audience != null ? String(row.total_audience) : '',
          }
        }
        setExisting(byPlatform)
        setValues(nextValues)
      })

    supabase
      .from('weekly_metrics')
      .select('platform_id, total_audience')
      .eq('client_id', clientId)
      .lt('week_start', weekStart)
      .not('total_audience', 'is', null)
      .order('week_start', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as { platform_id: string; total_audience: number }[]
        const latest: Record<string, number> = {}
        for (const r of rows) {
          if (!(r.platform_id in latest)) latest[r.platform_id] = r.total_audience
        }
        setPreviousTotals(latest)
      })
  }, [clientId, weekStart, platforms])

  const meta = useMemo(() => weekMeta(weekStart), [weekStart])
  const anomalies = useMemo(() => detectAnomalies(recent), [recent])

  const totals = useMemo(() => {
    let views = 0
    let audience = 0
    for (const v of Object.values(values)) {
      views += parseInt(v.views || '0', 10) || 0
      audience += parseInt(v.new_audience || '0', 10) || 0
    }
    return { views, audience }
  }, [values])

  function updateValue(platformId: string, field: 'views' | 'new_audience' | 'total_audience', raw: string) {
    setValues((v) => ({ ...v, [platformId]: { ...v[platformId], [field]: raw } }))
  }

  function matchPlatform(name: string): Platform | undefined {
    const clean = name.trim().toLowerCase()
    return platforms.find((p) => p.name.toLowerCase() === clean) ?? platforms.find((p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()))
  }

  /** Parses "Platform<TAB or ,>Views<TAB or ,>New Audience<TAB or ,>Total Audience(optional)" pasted straight out of a spreadsheet. */
  function applyBulkPaste() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    let matched = 0
    let skipped = 0
    const next = { ...values }
    for (const line of lines) {
      const parts = line.split(/\t|,/).map((p) => p.trim())
      if (parts.length < 2) {
        skipped++
        continue
      }
      const [name, viewsRaw, audienceRaw, totalRaw] = parts
      const platform = matchPlatform(name)
      if (!platform) {
        skipped++
        continue
      }
      next[platform.id] = {
        views: String(parseInt(viewsRaw || '0', 10) || 0),
        new_audience: String(parseInt(audienceRaw || '0', 10) || 0),
        total_audience: totalRaw?.trim() ? String(parseInt(totalRaw, 10) || 0) : (next[platform.id]?.total_audience ?? ''),
      }
      matched++
    }
    setValues(next)
    setBulkText('')
    setShowBulk(false)
    if (matched === 0) {
      toast('No rows matched a platform for this client — check the names.', 'error')
    } else {
      toast(`Filled in ${matched} platform${matched > 1 ? 's' : ''} from your paste${skipped ? ` (${skipped} row(s) skipped)` : ''}.`, 'success')
    }
  }

  /** Imports a CSV with headers: platform,views,new_audience,total_audience (last one optional, case-insensitive). */
  function handleCsvImport(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const next = { ...values }
        let matched = 0
        for (const row of results.data) {
          const nameKey = Object.keys(row).find((k) => k.toLowerCase().trim() === 'platform')
          const viewsKey = Object.keys(row).find((k) => k.toLowerCase().trim() === 'views')
          const audienceKey = Object.keys(row).find((k) => k.toLowerCase().replace(/\s|_/g, '') === 'newaudience')
          const totalKey = Object.keys(row).find((k) => k.toLowerCase().replace(/\s|_/g, '') === 'totalaudience')
          if (!nameKey) continue
          const platform = matchPlatform(row[nameKey] ?? '')
          if (!platform) continue
          next[platform.id] = {
            views: String(parseInt((viewsKey ? row[viewsKey] : '0') || '0', 10) || 0),
            new_audience: String(parseInt((audienceKey ? row[audienceKey] : '0') || '0', 10) || 0),
            total_audience:
              totalKey && row[totalKey]?.trim() ? String(parseInt(row[totalKey], 10) || 0) : next[platform.id]?.total_audience ?? '',
          }
          matched++
        }
        setValues(next)
        if (matched === 0) {
          toast('No rows matched a platform for this client. Expected columns: platform, views, new_audience.', 'error')
        } else {
          toast(`Imported ${matched} platform${matched > 1 ? 's' : ''} from CSV.`, 'success')
        }
      },
      error: () => toast('Could not parse that CSV file.', 'error'),
    })
  }

  /** Turns a worksheet into the same tab-separated text the paste box expects, and pre-fills the year from a "20XX Growth"-style sheet name. */
  function loadSheetIntoImport(wb: XLSX.WorkBook, sheetName: string) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return
    const tsv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', blankrows: false })
    setMonthlyImportText(tsv)
    const yearMatch = sheetName.match(/\d{4}/)
    if (yearMatch) setMonthlyImportYear(Number(yearMatch[0]))
    setShowMonthlyImport(true)
  }

  function handleMonthlySheetPick(sheetName: string) {
    if (!monthlyFileWorkbook) return
    loadSheetIntoImport(monthlyFileWorkbook, sheetName)
  }

  async function handleMonthlyFile(file: File) {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheetNames = wb.SheetNames
      setMonthlyFileWorkbook(wb)
      setMonthlyFileSheets(sheetNames)
      setMonthlyFileName(file.name)

      // Prefer a "20XX Growth"-style sheet over things like "The Model" or "SHORTS".
      const growthSheets = sheetNames.filter((n) => /growth/i.test(n))
      const best =
        growthSheets.find((n) => n.includes(String(monthlyImportYear))) ??
        growthSheets[growthSheets.length - 1] ??
        sheetNames[0]

      if (best) loadSheetIntoImport(wb, best)
      toast(`Loaded "${file.name}" — check the sheet and year below, then Import.`, 'success')
    } catch {
      toast('Could not read that file. Make sure it\'s a .xlsx or .xls file.', 'error')
    }
  }

  async function handleMonthlyImport() {
    if (!profile || !clientId) return
    setMonthlyImporting(true)
    const { rows, unmatchedColumns, matchedPlatforms, monthsFound, monthLabelsSeen } = parseMonthlyWideReport(monthlyImportText, {
      clientId,
      createdBy: profile.id,
      year: monthlyImportYear,
      platforms: platforms.map((p) => ({ id: p.id, name: p.name })),
    })

    if (rows.length === 0) {
      setMonthlyImporting(false)
      if (monthLabelsSeen === 0) {
        toast(
          "No month rows recognized — make sure you included both header rows and at least one \"<Month> Total\" row.",
          'error'
        )
      } else if (matchedPlatforms.length === 0) {
        toast(
          unmatchedColumns.length > 0
            ? `Found ${monthLabelsSeen} month row(s), but none of these columns match a platform for this client: ${unmatchedColumns.join(', ')}. Add them from the Platforms page first, or rename to match.`
            : `Found ${monthLabelsSeen} month row(s), but no platforms are set up for this client yet — add them from the Platforms page first.`,
          'error'
        )
      } else {
        toast(`Found ${monthLabelsSeen} month row(s) and matched your platforms, but every value was 0 — double check you copied the right rows.`, 'error')
      }
      return
    }

    const { error } = await supabase.from('weekly_metrics').upsert(rows, { onConflict: 'client_id,platform_id,week_start' })
    setMonthlyImporting(false)

    if (error) {
      toast(`Couldn't import: ${error.message}`, 'error')
      return
    }

    await supabase.from('activity_logs').insert({
      user_id: profile.id,
      client_id: clientId,
      action: `Imported monthly report (${monthsFound} month${monthsFound > 1 ? 's' : ''})`,
      target: `Year ${monthlyImportYear}`,
    })

    const monthWord = monthsFound === 1 ? 'month' : 'months'
    if (unmatchedColumns.length > 0) {
      toast(`Imported ${monthsFound} ${monthWord}. Skipped (no matching platform): ${unmatchedColumns.join(', ')}.`, 'error')
    } else {
      toast(`Imported ${monthsFound} ${monthWord} across ${new Set(rows.map((r) => r.platform_id)).size} platform(s).`, 'success')
    }
    setMonthlyImportText('')
    setShowMonthlyImport(false)
    setMonthlyFileSheets([])
    setMonthlyFileWorkbook(null)
    setMonthlyFileName('')
    loadRecent()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || !clientId) return
    if (platforms.length === 0) {
      toast('This client has no platforms yet — add one first.', 'error')
      return
    }

    setSaving(true)
    const payload = platforms
      .map((p) => {
        const v = values[p.id]
        const views = parseInt(v?.views || '0', 10) || 0
        const new_audience = parseInt(v?.new_audience || '0', 10) || 0
        const total_audience = v?.total_audience?.trim() ? parseInt(v.total_audience, 10) || 0 : null
        if (!v?.views && !v?.new_audience && !v?.total_audience) return null // skip untouched platforms
        return {
          client_id: clientId,
          platform_id: p.id,
          week_start: weekStart,
          year: meta.year,
          month: meta.month,
          week: meta.week,
          views,
          new_audience,
          total_audience,
          created_by: existing[p.id]?.created_by ?? profile.id,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (payload.length === 0) {
      toast('Enter at least one number before saving.', 'error')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('weekly_metrics')
      .upsert(payload, { onConflict: 'client_id,platform_id,week_start' })

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: profile.id,
        client_id: clientId,
        action: `Saved weekly growth data (${payload.length} platform${payload.length > 1 ? 's' : ''})`,
        target: `Week of ${formatDate(weekStart)}`,
      })
    }

    setSaving(false)
    if (error) {
      toast(`Couldn't save: ${error.message}`, 'error')
      return
    }
    toast('Weekly growth data saved.', 'success')
    loadRecent()
  }

  async function handleDelete() {
    if (!toDelete) return
    const { error } = await supabase.from('weekly_metrics').delete().eq('id', toDelete.id)
    if (error) {
      toast(`Couldn't delete: ${error.message}`, 'error')
    } else {
      toast('Entry deleted.', 'success')
      setToDelete(null)
      loadRecent()
    }
  }

  const savedThisWeek = Object.keys(existing).length > 0
  const shiftWeek = (days: number) => setWeekStart(mondayOfISO(format(addDays(parseISO(weekStart), days), 'yyyy-MM-dd')))
  const clientOptions = isAdmin ? clients : assignedClients

  const uploadBtn =
    'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 cursor-pointer transition-colors'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Weekly growth input"
        description="Enter this week's numbers per platform. Saving again for the same week updates it."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowBulk((v) => !v)}>
              <ClipboardPaste className="h-4 w-4" />
              Paste from Excel
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCsvImport(file)
                  e.target.value = ''
                }}
              />
              <span className={uploadBtn}>
                <UploadCloud className="h-4 w-4" />
                Import CSV
              </span>
            </label>
            <Button type="button" variant="secondary" onClick={() => setShowMonthlyImport((v) => !v)}>
              <FileSpreadsheet className="h-4 w-4" />
              Monthly report
            </Button>
          </>
        }
      />

      {showMonthlyImport && (
        <Card>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900">Import a monthly report</h2>
                <p className="text-xs text-ink-500 mt-0.5 max-w-xl">
                  Upload a "20XX Growth"-style workbook, or paste the header rows through your last "Month Total" row.
                  Platform names must already exist (add them on the Platforms page); anything else is skipped and listed
                  after import.
                </p>
              </div>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleMonthlyFile(file)
                    e.target.value = ''
                  }}
                />
                <span className={uploadBtn}>
                  <FileUp className="h-4 w-4" />
                  Upload Excel file
                </span>
              </label>
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <Field label="Year for these rows">
                <Input
                  type="number"
                  className="w-28"
                  value={monthlyImportYear}
                  onChange={(e) => setMonthlyImportYear(Number(e.target.value) || monthlyImportYear)}
                />
              </Field>
              {monthlyFileSheets.length > 1 && (
                <Field label={`Sheet (from ${monthlyFileName})`}>
                  <Select className="w-56" onChange={(e) => handleMonthlySheetPick(e.target.value)} defaultValue="">
                    <option value="" disabled>
                      Choose a sheet…
                    </option>
                    {monthlyFileSheets.map((sh) => (
                      <option key={sh} value={sh}>
                        {sh}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <Textarea
              rows={6}
              className="font-mono text-xs"
              placeholder={'Week or Month\tTotals\t\tAverages\t...\nWeek or Month\tViews\tFollowers\t...\nJanuary Total\t179155\t1256\t...'}
              value={monthlyImportText}
              onChange={(e) => setMonthlyImportText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMonthlyImportText('')
                  setShowMonthlyImport(false)
                  setMonthlyFileSheets([])
                  setMonthlyFileWorkbook(null)
                  setMonthlyFileName('')
                }}
              >
                Cancel
              </Button>
              <Button type="button" loading={monthlyImporting} onClick={handleMonthlyImport}>
                Import
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showBulk && (
        <Card>
          <div className="p-5 flex flex-col gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Paste from Excel or Sheets</h2>
              <p className="text-xs text-ink-500 mt-0.5">
                One platform per line: <code className="bg-ink-100 rounded px-1">Platform&#9;Views&#9;New Audience</code> (tab or comma separated).
              </p>
            </div>
            <Textarea
              rows={4}
              className="font-mono text-xs"
              placeholder={'YouTube\t4488\t105\nInstagram\t4707\t-47'}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { setBulkText(''); setShowBulk(false) }}>
                Cancel
              </Button>
              <Button type="button" onClick={applyBulkPaste}>
                Apply to table
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-6 items-start">
        {/* ---------- Entry table ---------- */}
        <form onSubmit={handleSubmit} className="min-w-0">
          <Card className="overflow-hidden">
            <div className="p-5 flex flex-wrap items-end gap-3 border-b border-ink-100">
              <div className="flex-1 min-w-[180px]">
                <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Client</label>
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
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Week starting (Monday)</label>
                <div className="flex items-center h-10 rounded-lg border border-ink-200 bg-white overflow-hidden">
                  <button type="button" onClick={() => shiftWeek(-7)} aria-label="Previous week" className="h-full px-2.5 text-ink-500 hover:bg-ink-50">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="date"
                    required
                    aria-label="Week start"
                    value={weekStart}
                    onChange={(e) => e.target.value && setWeekStart(mondayOfISO(e.target.value))}
                    className="flex-1 min-w-0 h-full text-center text-sm font-semibold text-ink-900 outline-none bg-transparent"
                  />
                  <button type="button" onClick={() => shiftWeek(7)} aria-label="Next week" className="h-full px-2.5 text-ink-500 hover:bg-ink-50">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold mb-2 whitespace-nowrap',
                  savedThisWeek ? 'bg-pine-100 text-pine-800' : 'bg-amber-100 text-amber-600'
                )}
              >
                {savedThisWeek ? 'Saved · editing' : 'Not saved yet'}
              </span>
              <p className="w-full text-xs text-ink-500 -mt-1">
                {meta.month} {meta.year} · Week {meta.week} · {meta.quarter}
              </p>
            </div>

            {loadingPlatforms ? (
              <PageSpinner />
            ) : platforms.length === 0 ? (
              <EmptyState title="No platforms for this client" description="Add platforms from Growth → Platforms first." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                      <th className="px-5 py-3">Platform</th>
                      <th className="px-2 py-3 text-right">Views</th>
                      <th className="px-2 py-3 text-right">New audience</th>
                      <th className="px-2 py-3 text-right">Total audience</th>
                      <th className="px-5 py-3 text-right">vs last entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platforms.map((p) => {
                      const totalVal = values[p.id]?.total_audience
                      const prevTotal = previousTotals[p.id]
                      const change = totalVal && prevTotal != null ? parseInt(totalVal, 10) - prevTotal : null
                      const cellInput =
                        'no-spin w-full max-w-[128px] ml-auto block h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-right text-sm font-semibold tabular-nums text-ink-900 placeholder:text-ink-300 placeholder:font-normal focus:border-pine-500 focus:ring-2 focus:ring-pine-500/15 outline-none'
                      return (
                        <tr key={p.id} className="border-b border-ink-100/70 last:border-0">
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center gap-2.5">
                              <span
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: p.color }}
                              >
                                {p.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="font-semibold text-ink-900">{p.name}</span>
                              {existing[p.id] && <Check className="h-3.5 w-3.5 text-pine-600" aria-label="Saved" />}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`${p.name} views`}
                              placeholder="0"
                              className={cellInput}
                              value={values[p.id]?.views ?? ''}
                              onChange={(e) => updateValue(p.id, 'views', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              step={1}
                              inputMode="numeric"
                              aria-label={`${p.name} new audience`}
                              placeholder="0"
                              className={cn(cellInput, Number(values[p.id]?.new_audience) < 0 && 'text-clay-600')}
                              value={values[p.id]?.new_audience ?? ''}
                              onChange={(e) => updateValue(p.id, 'new_audience', e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`${p.name} total audience`}
                              placeholder="optional"
                              className={cellInput}
                              value={totalVal ?? ''}
                              onChange={(e) => updateValue(p.id, 'total_audience', e.target.value)}
                            />
                          </td>
                          <td className="px-5 py-2.5 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                            {change === null ? (
                              <span className="text-ink-300">—</span>
                            ) : (
                              <span className={change >= 0 ? 'text-pine-600' : 'text-clay-600'}>
                                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-ink-50/70 font-bold text-ink-900">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-2 py-3 text-right tabular-nums pr-4">{totals.views.toLocaleString()}</td>
                      <td className="px-2 py-3 text-right tabular-nums pr-4">
                        {totals.audience >= 0 ? '+' : ''}
                        {totals.audience.toLocaleString()}
                      </td>
                      <td className="px-2 py-3" />
                      <td className="px-5 py-3" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-t border-ink-100">
              <p className="text-xs text-ink-500">Total audience is optional: the all-time follower count on that date.</p>
              <Button type="submit" loading={saving} disabled={platforms.length === 0}>
                <Check className="h-4 w-4" />
                {savedThisWeek ? 'Update week' : 'Save week'}
              </Button>
            </div>
          </Card>
        </form>

        {/* ---------- Recent entries ---------- */}
        <section className="min-w-0">
          <SectionTitle aside={clientOptions.find((c) => c.id === clientId)?.name}>Recent entries</SectionTitle>
          <Card className="overflow-hidden">
            {loadingRecent ? (
              <PageSpinner />
            ) : recent.length === 0 ? (
              <EmptyState title="No entries yet" description="Weekly data you save will show up here." />
            ) : (
              <div className="divide-y divide-ink-100 max-h-[560px] overflow-y-auto scrollbar-thin">
                {recent.map((r) => {
                  const flags = anomalies.get(r.id)
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 group">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.platform?.color ?? '#B9BCB4' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-900 truncate">{r.platform?.name ?? '—'}</p>
                        <p className="text-xs text-ink-500">
                          Week of {formatDate(r.week_start, 'MMM d')}
                          {flags && flags.length > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 font-medium" title={flags.join(', ')}>
                              <AlertTriangle className="h-3 w-3" />
                              {flags[0]}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-ink-900 tabular-nums">{r.views.toLocaleString()}</p>
                        <p className={cn('text-[11px] tabular-nums', r.new_audience < 0 ? 'text-clay-600 font-semibold' : 'text-ink-500')}>
                          {r.new_audience >= 0 ? '+' : ''}
                          {r.new_audience.toLocaleString()} audience
                        </p>
                      </div>
                      <button
                        onClick={() => setToDelete(r)}
                        className="p-1.5 text-ink-300 hover:text-clay-600 hover:bg-clay-50 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this entry?"
        description={toDelete ? `${toDelete.platform?.name ?? 'This platform'} · Week of ${formatDate(toDelete.week_start)}. This can't be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
