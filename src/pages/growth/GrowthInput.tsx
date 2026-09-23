import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Trash2, ClipboardPaste, UploadCloud, AlertTriangle } from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button, Card, CardContent, CardHeader, EmptyState, Field, Input, PageSpinner, Select, Textarea } from '../../components/ui/primitives'
import { ConfirmDialog } from '../../components/ui/dialog'
import type { Client, Platform, WeeklyMetric } from '../../types/database'
import { formatDate, mondayOfISO, todayISO, weekMeta, detectAnomalies, cn } from '../../lib/utils'

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

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Weekly Growth Input</h1>
        <p className="text-sm text-ink-500 mt-1">One row per platform, one entry per week — saving again for the same week updates it.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Card>
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold text-ink-800">Client &amp; Week</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <Field label="Client" required>
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
            <Field label="Week Start (Monday)" required hint={`${meta.month} ${meta.year} · Week ${meta.week} · ${meta.quarter}`}>
              <Input
                type="date"
                required
                value={weekStart}
                onChange={(e) => setWeekStart(mondayOfISO(e.target.value))}
              />
            </Field>
            <Field label="Total (this entry)">
              <div className="h-9 flex items-center px-3 text-sm text-ink-700 bg-ink-50 border border-ink-100 rounded-md">
                {totals.views.toLocaleString()} views · {totals.audience.toLocaleString()} new
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-ink-800">Platforms</h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowBulk((v) => !v)}>
                <ClipboardPaste className="h-3.5 w-3.5" />
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
                <span className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-medium bg-white text-ink-800 border border-ink-200 hover:bg-pine-50 cursor-pointer">
                  <UploadCloud className="h-3.5 w-3.5" />
                  Import CSV
                </span>
              </label>
            </div>
          </CardHeader>
          {showBulk && (
            <CardContent className="pt-0">
              <div className="mt-3 flex flex-col gap-2 bg-ink-50 border border-ink-100 rounded-md p-3">
                <p className="text-xs text-ink-500">
                  Paste rows copied from Excel/Sheets: one platform per line, <code>Platform&#9;Views&#9;New Audience</code> (tab or comma separated).
                </p>
                <Textarea
                  rows={4}
                  placeholder={'YouTube\t4488\t105\nInstagram\t4707\t-47'}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => { setBulkText(''); setShowBulk(false) }}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={applyBulkPaste}>
                    Apply to Form
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
          <CardContent className="mt-4">
            {loadingPlatforms ? (
              <PageSpinner />
            ) : platforms.length === 0 ? (
              <EmptyState
                title="No platforms for this client"
                description="Add platforms from Growth → Platforms first."
              />
            ) : (
              <div className="flex flex-col divide-y divide-ink-100">
                {platforms.map((p) => {
                  const totalVal = values[p.id]?.total_audience
                  const prevTotal = previousTotals[p.id]
                  const change = totalVal && prevTotal != null ? parseInt(totalVal, 10) - prevTotal : null
                  return (
                    <div key={p.id} className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 items-end first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-ink-800 col-span-2 sm:col-span-1">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </div>
                      <Field label="Views">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="0"
                          value={values[p.id]?.views ?? ''}
                          onChange={(e) => updateValue(p.id, 'views', e.target.value)}
                        />
                      </Field>
                      <Field label="New Audience">
                        <Input
                          type="number"
                          step={1}
                          placeholder="0"
                          value={values[p.id]?.new_audience ?? ''}
                          onChange={(e) => updateValue(p.id, 'new_audience', e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Total Audience"
                        hint={change !== null ? `${change >= 0 ? '+' : ''}${change.toLocaleString()} vs last entry` : 'optional — all-time follower count'}
                      >
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="—"
                          value={totalVal ?? ''}
                          onChange={(e) => updateValue(p.id, 'total_audience', e.target.value)}
                        />
                      </Field>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={platforms.length === 0}>
            Save Weekly Data
          </Button>
        </div>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-ink-700 mb-3">Recent Entries</h2>
        <Card className="overflow-hidden">
          {loadingRecent ? (
            <PageSpinner />
          ) : recent.length === 0 ? (
            <EmptyState title="No entries yet" description="Weekly data you save will show up here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Week</th>
                    <th className="px-3 py-3">Platform</th>
                    <th className="px-3 py-3 text-right">Views</th>
                    <th className="px-3 py-3 text-right">New Audience</th>
                    <th className="px-3 py-3 text-right">Total Audience</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => {
                    const flags = anomalies.get(r.id)
                    return (
                      <tr key={r.id} className="border-b border-ink-50 last:border-0">
                        <td className="px-5 py-3 text-ink-700 whitespace-nowrap">{formatDate(r.week_start)}</td>
                        <td className="px-3 py-3 text-ink-700">{r.platform?.name ?? '—'}</td>
                        <td className="px-3 py-3 text-right text-ink-600">{r.views.toLocaleString()}</td>
                        <td className={cn('px-3 py-3 text-right', r.new_audience < 0 ? 'text-clay-600 font-medium' : 'text-ink-600')}>
                          {r.new_audience.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-ink-500">{r.total_audience != null ? r.total_audience.toLocaleString() : '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {flags && flags.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"
                                title={flags.join(', ')}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {flags[0]}
                              </span>
                            )}
                            <button
                              onClick={() => setToDelete(r)}
                              className="p-1.5 text-ink-500 hover:text-clay-600 hover:bg-clay-50 rounded-md"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
