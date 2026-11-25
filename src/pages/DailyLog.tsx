import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import {
  Briefcase,
  CalendarDays,
  Check,
  Clapperboard,
  Clock,
  FileText,
  GalleryHorizontal,
  Minus,
  Plus,
  Repeat,
  Video,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Button, Card, Field, Input, Select, Textarea, PageSpinner, PageHeader, Segmented } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, logClientLabel, type Client, type ProductionLogWithRelations, type ProductionStatus } from '../types/database'
import { formatDate, todayISO, cn } from '../lib/utils'

const FIELD_ICONS = [Video, Repeat, GalleryHorizontal, Repeat, FileText, Repeat]

type FormState = {
  production_date: string
  client_id: string // '' = none, OTHER_CLIENT = typed name, otherwise a client uuid
  other_client_name: string
  is_other_work: boolean
  videos_edited_count: number
  videos_edited_status: ProductionStatus
  videos_reedited_count: number
  videos_reedited_status: ProductionStatus
  carousels_edited_count: number
  carousels_edited_status: ProductionStatus
  carousels_reedited_count: number
  carousels_reedited_status: ProductionStatus
  text_posts_prepared_count: number
  text_posts_prepared_status: ProductionStatus
  text_posts_reedited_count: number
  text_posts_reedited_status: ProductionStatus
  notes: string
}

// Sentinel option in the Other Work client dropdown: client isn't in the list, type their name instead.
const OTHER_CLIENT = '__other__'

const emptyForm: FormState = {
  production_date: todayISO(),
  client_id: '',
  other_client_name: '',
  is_other_work: false,
  videos_edited_count: 0,
  videos_edited_status: 'completed',
  videos_reedited_count: 0,
  videos_reedited_status: 'completed',
  carousels_edited_count: 0,
  carousels_edited_status: 'completed',
  carousels_reedited_count: 0,
  carousels_reedited_status: 'completed',
  text_posts_prepared_count: 0,
  text_posts_prepared_status: 'completed',
  text_posts_reedited_count: 0,
  text_posts_reedited_status: 'completed',
  notes: '',
}

export default function DailyLog() {
  const { profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')

  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [sameDayLogs, setSameDayLogs] = useState<ProductionLogWithRelations[]>([])
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Other entries already saved for this person on the selected date, so
  // nobody double-logs the same work by accident.
  useEffect(() => {
    const uid = ownerId ?? profile?.id
    if (!uid || loading) return
    let q = supabase
      .from('production_logs')
      .select('*, client:clients(id, name, status)')
      .eq('user_id', uid)
      .eq('production_date', form.production_date)
      .order('created_at', { ascending: true })
    if (editId) q = q.neq('id', editId)
    q.then(({ data }) => setSameDayLogs((data ?? []) as unknown as ProductionLogWithRelations[]))
  }, [form.production_date, ownerId, profile?.id, editId, loading])

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => setClients((data ?? []) as Client[]))
  }, [])

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    supabase
      .from('production_logs')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setForm({
            production_date: data.production_date,
            client_id: data.client_id ?? (data.other_client_name ? OTHER_CLIENT : ''),
            other_client_name: data.other_client_name ?? '',
            is_other_work: data.is_other_work ?? false,
            videos_edited_count: data.videos_edited_count,
            videos_edited_status: data.videos_edited_status,
            videos_reedited_count: data.videos_reedited_count,
            videos_reedited_status: data.videos_reedited_status,
            carousels_edited_count: data.carousels_edited_count,
            carousels_edited_status: data.carousels_edited_status,
            carousels_reedited_count: data.carousels_reedited_count,
            carousels_reedited_status: data.carousels_reedited_status,
            text_posts_prepared_count: data.text_posts_prepared_count,
            text_posts_prepared_status: data.text_posts_prepared_status,
            text_posts_reedited_count: data.text_posts_reedited_count,
            text_posts_reedited_status: data.text_posts_reedited_status,
            notes: data.notes ?? '',
          })
          setOwnerId(data.user_id)
        } else if (error) {
          toast('Could not load that log entry.', 'error')
        }
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const runningTotal = totalItems(form)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return

    if (form.is_other_work) {
      if (!form.notes.trim()) {
        toast('Say what you worked on — it\'s required for an Other Work entry.', 'error')
        return
      }
      if (form.client_id === OTHER_CLIENT && !form.other_client_name.trim()) {
        toast('Type the client\'s name, or choose "No client".', 'error')
        return
      }
    } else if (!form.client_id) {
      toast('Please select a client.', 'error')
      return
    }
    for (const f of PRODUCTION_FIELDS) {
      if (form[f.countKey] < 0 || !Number.isInteger(form[f.countKey])) {
        toast('Counts must be whole numbers, zero or greater.', 'error')
        return
      }
    }

    setSaving(true)
    const { client_id, other_client_name, ...rest } = form
    // Other Work: client is optional — a listed client, a typed name, or neither.
    // Client Work: always a listed client.
    const payload = {
      ...rest,
      client_id: client_id && client_id !== OTHER_CLIENT ? client_id : null,
      other_client_name:
        form.is_other_work && client_id === OTHER_CLIENT ? other_client_name.trim() : null,
      notes: form.notes.trim() || null,
      user_id: ownerId ?? profile.id,
    }

    const { error } = editId
      ? await supabase.from('production_logs').update(payload).eq('id', editId)
      : await supabase.from('production_logs').insert(payload)

    setSaving(false)

    if (error) {
      toast(`Couldn't save: ${error.message}`, 'error')
      return
    }

    toast(editId ? 'Daily log updated.' : 'Daily log saved.', 'success')
    navigate(isAdmin ? '/history' : '/')
  }

  /**
   * Turn what's typed in this client entry's Notes into its own Other Work
   * entry (same date, tagged to the same client, no items), then clear the
   * notes here. The new entry is created first so the text is never lost if
   * something fails.
   */
  async function moveNotesToOtherWork() {
    if (!profile) return
    const text = form.notes.trim()
    if (!text) {
      toast('Write something in Notes first.', 'error')
      return
    }
    setMoving(true)
    const { error: insertError } = await supabase.from('production_logs').insert({
      user_id: ownerId ?? profile.id,
      production_date: form.production_date,
      client_id: form.client_id || null,
      is_other_work: true,
      notes: text,
    })
    if (insertError) {
      setMoving(false)
      toast(`Couldn't move it: ${insertError.message}`, 'error')
      return
    }
    if (editId) {
      const { error: clearError } = await supabase.from('production_logs').update({ notes: null }).eq('id', editId)
      if (clearError) {
        setMoving(false)
        updateField('notes', '')
        toast('Added to Other Work, but couldn\'t clear the note here — save this log to finish.', 'error')
        return
      }
    }
    setMoving(false)
    updateField('notes', '')
    toast('Moved to Other Work.', 'success')
  }

  if (loading) return <PageSpinner />

  const selectedClientName =
    form.client_id === OTHER_CLIENT
      ? form.other_client_name.trim() || 'Other client'
      : clients.find((c) => c.id === form.client_id)?.name
  const inProgressCount = PRODUCTION_FIELDS.filter(
    (f) => form[f.countKey] > 0 && form[f.statusKey] === 'in_progress'
  ).length
  const completedCount = PRODUCTION_FIELDS.filter(
    (f) => form[f.countKey] > 0 && form[f.statusKey] === 'completed'
  ).length
  const today = todayISO()
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const dateChoice = form.production_date === today ? 'today' : form.production_date === yesterday ? 'yesterday' : 'other'

  // Client picker: chips while the list is short, a dropdown once it isn't.
  const clientOptions: { value: string; label: string }[] = [
    ...(form.is_other_work ? [{ value: '', label: 'No client' }] : []),
    ...clients.map((c) => ({ value: c.id, label: c.name })),
    ...(form.is_other_work ? [{ value: OTHER_CLIENT, label: '+ Not in list' }] : []),
  ]
  const useChips = clients.length <= 8

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1">
      <PageHeader
        title={editId ? 'Edit log' : "Log today's work"}
        description={`${formatDate(form.production_date, 'EEEE, MMMM d, yyyy')}${
          editId ? '' : ' · log what you completed for a client, or other work'
        }`}
        actions={
          <Segmented
            ariaLabel="Date"
            value={dateChoice}
            onChange={(v) => {
              if (v === 'today') updateField('production_date', today)
              else if (v === 'yesterday') updateField('production_date', yesterday)
              else dateInputRef.current?.showPicker?.()
            }}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              {
                value: 'other',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dateChoice === 'other' ? formatDate(form.production_date, 'MMM d') : 'Pick date'}
                  </span>
                ),
              },
            ]}
          />
        }
      />
      {/* Real date field behind "Pick date" (opened with showPicker; still focusable for keyboard users). */}
      <label className="sr-only" htmlFor="production_date">Production date</label>
      <input
        ref={dateInputRef}
        id="production_date"
        type="date"
        required
        max={today}
        value={form.production_date}
        onChange={(e) => e.target.value && updateField('production_date', e.target.value)}
        className="sr-only"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5 mt-6 items-start">
        {/* ---------- Left column ---------- */}
        <div className="flex flex-col gap-5 min-w-0">
          <Card>
            <div className="p-5">
              <h2 className="text-[15px] font-semibold text-ink-900">What kind of day was this?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3" role="radiogroup" aria-label="Type of work">
                {[
                  { other: false, icon: Clapperboard, title: 'Client production', sub: 'Videos, carousels, text posts' },
                  { other: true, icon: Briefcase, title: 'Other work', sub: 'Meetings, admin, training…' },
                ].map((opt) => {
                  const active = form.is_other_work === opt.other
                  return (
                    <button
                      key={opt.title}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        opt.other
                          ? updateField('is_other_work', true)
                          : setForm((f) => ({ ...f, is_other_work: false, client_id: f.client_id === OTHER_CLIENT ? '' : f.client_id }))
                      }
                      className={cn(
                        'flex items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left transition-colors',
                        active ? 'border-pine-500 bg-pine-50/70' : 'border-ink-200 hover:border-ink-300 bg-white'
                      )}
                    >
                      <span
                        className={cn(
                          'h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0',
                          active ? (opt.other ? 'bg-amber-100 text-amber-600' : 'bg-white text-pine-700 shadow-card') : 'bg-ink-100/70 text-ink-500'
                        )}
                      >
                        <opt.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-900">{opt.title}</span>
                        <span className="block text-xs text-ink-500 mt-0.5">{opt.sub}</span>
                      </span>
                      <span
                        className={cn(
                          'h-[18px] w-[18px] rounded-full shrink-0 transition-all',
                          active ? 'border-[5px] border-pine-600' : 'border-2 border-ink-200'
                        )}
                      />
                    </button>
                  )
                })}
              </div>
              {form.is_other_work && (
                <p className="text-xs text-ink-500 mt-3 leading-relaxed">
                  For days without client production: internal tasks, training, admin, etc. Picking a client and item
                  counts are optional, and it still counts toward your streak as long as you say what you worked on.
                </p>
              )}

              <div className="mt-5">
                <p className="text-sm font-semibold text-ink-700 mb-2">
                  {form.is_other_work ? 'Client (optional)' : 'Client'}
                  {!form.is_other_work && <span className="text-clay-600 ml-0.5">*</span>}
                </p>
                {useChips ? (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Client">
                    {clientOptions.map((o) => {
                      const active = form.client_id === o.value
                      return (
                        <button
                          key={o.value || 'none'}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => updateField('client_id', o.value)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                            active
                              ? 'border-pine-500 bg-pine-50 text-pine-800 font-semibold'
                              : 'border-ink-200 bg-white text-ink-700 font-medium hover:border-ink-300'
                          )}
                        >
                          {o.value && o.value !== OTHER_CLIENT && (
                            <span className={cn('h-2 w-2 rounded-full', active ? 'bg-pine-600' : 'bg-ink-300')} />
                          )}
                          {o.label}
                        </button>
                      )
                    })}
                    {clients.length === 0 && !form.is_other_work && (
                      <p className="text-sm text-ink-500">No active clients yet. Ask an admin to add one.</p>
                    )}
                  </div>
                ) : (
                  <Select
                    id="client_id"
                    required={!form.is_other_work}
                    value={form.client_id}
                    onChange={(e) => updateField('client_id', e.target.value)}
                  >
                    <option value="">{form.is_other_work ? 'No client' : 'Select a client…'}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    {form.is_other_work && <option value={OTHER_CLIENT}>Other, not in list (type name)…</option>}
                  </Select>
                )}
                {form.is_other_work && form.client_id === OTHER_CLIENT && (
                  <div className="mt-3 max-w-sm">
                    <Field label="Client name" htmlFor="other_client_name" required>
                      <Input
                        id="other_client_name"
                        required
                        maxLength={120}
                        placeholder="Who asked for this?"
                        value={form.other_client_name}
                        onChange={(e) => updateField('other_client_name', e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="px-5 pt-5 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-[15px] font-semibold text-ink-900">
                Production{form.is_other_work && <span className="font-normal text-ink-500"> (optional)</span>}
              </h2>
              <span className="text-xs text-ink-500">Use – / + or type a number · set a status for each</span>
            </div>
            <div className="px-5 pb-2 mt-2 divide-y divide-ink-100">
              {PRODUCTION_FIELDS.map((f, i) => {
                const count = form[f.countKey]
                const hasCount = count > 0
                const Icon = FIELD_ICONS[i]
                return (
                  <div key={f.countKey} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 py-3.5">
                    <span
                      className={cn(
                        'h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0',
                        hasCount ? 'bg-pine-50 text-pine-700' : 'bg-ink-100/60 text-ink-400'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <label
                      htmlFor={f.countKey}
                      className={cn('flex-1 min-w-[120px] text-sm', hasCount ? 'font-semibold text-ink-900' : 'font-medium text-ink-500')}
                    >
                      {f.label}
                    </label>
                    <div className="order-last sm:order-none w-full sm:w-auto pl-14 sm:pl-0">
                      <Segmented
                        size="sm"
                        ariaLabel={`${f.label} status`}
                        disabled={!hasCount}
                        value={form[f.statusKey]}
                        onChange={(v) => updateField(f.statusKey, v)}
                        options={[
                          { value: 'completed', label: <><Check className="h-3 w-3" /> Completed</> },
                          { value: 'in_progress', label: <><Clock className="h-3 w-3" /> In progress</> },
                        ]}
                      />
                    </div>
                    <div className="flex items-center rounded-[10px] border border-ink-200 bg-white overflow-hidden shrink-0">
                      <button
                        type="button"
                        aria-label={`Decrease ${f.label}`}
                        disabled={!hasCount}
                        onClick={() => updateField(f.countKey, Math.max(0, count - 1))}
                        className="h-9 w-9 flex items-center justify-center text-ink-500 bg-ink-50/70 hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-ink-50/70"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        id={f.countKey}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={count}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateField(f.countKey, Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                        className={cn(
                          'no-spin h-9 w-12 text-center text-base font-bold tabular-nums bg-white outline-none focus:bg-pine-50',
                          hasCount ? 'text-ink-900' : 'text-ink-300'
                        )}
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${f.label}`}
                        onClick={() => updateField(f.countKey, count + 1)}
                        className="h-9 w-9 flex items-center justify-center text-ink-600 bg-ink-50/70 hover:bg-pine-50 hover:text-pine-700"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ---------- Right column ---------- */}
        <div className="flex flex-col gap-5 min-w-0 lg:sticky lg:top-[84px]">
          <Card>
            <div className="p-5">
              <h2 className="text-[15px] font-semibold text-ink-900">
                {form.is_other_work ? 'What did you work on?' : 'Notes'}
                {form.is_other_work && <span className="text-clay-600 ml-0.5">*</span>}
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                {form.is_other_work
                  ? 'A short description of the non-client work you did.'
                  : 'Optional. Anything worth flagging for this entry.'}
              </p>
              <Textarea
                rows={4}
                className="mt-3"
                required={form.is_other_work}
                placeholder={
                  form.is_other_work
                    ? 'e.g. team training on the new editing workflow, onboarding paperwork…'
                    : 'e.g. client requested a re-cut on the intro, waiting on raw footage for Thursday…'
                }
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
              {!form.is_other_work && form.notes.trim() && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
                  <p className="text-xs text-amber-800">
                    Was this actually non-production work? Move it to its own Other Work entry for this date
                    {form.client_id ? ' (kept under the same client)' : ''}.
                  </p>
                  <Button type="button" variant="secondary" size="sm" className="mt-2" loading={moving} onClick={moveNotesToOtherWork}>
                    Move to Other Work
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <div className="rounded-2xl border border-pine-100 bg-pine-50/70 p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">This entry</h2>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-[40px] leading-none font-bold tracking-tight text-pine-800 tabular-nums">{runningTotal}</span>
              <span className="text-sm text-ink-500 truncate">
                item{runningTotal === 1 ? '' : 's'}
                {selectedClientName ? ` · ${selectedClientName}` : ''}
              </span>
            </div>
            {runningTotal > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-pine-600" /> {completedCount} type{completedCount === 1 ? '' : 's'} completed</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> {inProgressCount} in progress</span>
              </div>
            ) : (
              <p className="text-xs text-ink-500 mt-3">
                {form.is_other_work ? 'Item counts are optional for other work.' : 'Tap + on a content type to start counting.'}
              </p>
            )}
          </div>

          {sameDayLogs.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink-900">Already logged that day</h2>
                <span className="text-xs text-ink-500">{sameDayLogs.length}</span>
              </div>
              <div className="divide-y divide-ink-100">
                {sameDayLogs.map((log) => (
                  <Link
                    key={log.id}
                    to={`/daily-log?edit=${log.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50/70 text-sm"
                  >
                    <span className="flex-1 min-w-0 truncate font-medium text-ink-800">
                      {logClientLabel(log as any, log.is_other_work ? 'Other work' : 'Unknown client')}
                    </span>
                    {!log.is_other_work && <span className="text-xs text-ink-500 shrink-0">{totalItems(log)} items</span>}
                    <span className="text-xs font-semibold text-pine-700">Edit</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-20 mt-6 -mx-4 sm:-mx-6 lg:-mx-8 bg-white/95 backdrop-blur border-t border-ink-100 shadow-bar px-4 sm:px-6 lg:px-8 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-900">
            {runningTotal} item{runningTotal === 1 ? '' : 's'}
            {form.is_other_work && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600 align-middle">Other work</span>}
          </p>
          <p className="text-xs text-ink-500 truncate">
            {selectedClientName ?? (form.is_other_work ? 'No client' : 'No client selected')} ·{' '}
            {formatDate(form.production_date, 'EEE, MMM d')}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="secondary" className="hidden sm:inline-flex" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Check className="h-4 w-4" />
            {editId ? 'Save changes' : 'Save log'}
          </Button>
        </div>
      </div>
    </form>
  )
}
