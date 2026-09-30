import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Button, Card, CardContent, CardHeader, Field, Input, Select, Textarea, PageSpinner } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, type Client, type ProductionStatus } from '../types/database'
import { dayOfWeek, todayISO, cn } from '../lib/utils'

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

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-900">{editId ? 'Edit Daily Log' : 'Add Daily Log'}</h1>
      <p className="text-sm text-ink-500 mt-1">Log what you completed for a client — or other work — today.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <Card>
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold text-ink-800">What kind of day was this?</h2>
          </CardHeader>
          <CardContent className="mt-4 flex flex-col gap-4">
            <div className="inline-flex rounded-md border border-ink-200 p-1 bg-ink-50 self-start">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, is_other_work: false, client_id: f.client_id === OTHER_CLIENT ? '' : f.client_id }))
                }
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-colors',
                  !form.is_other_work ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
                )}
              >
                Client Work
              </button>
              <button
                type="button"
                onClick={() => updateField('is_other_work', true)}
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-colors',
                  form.is_other_work ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
                )}
              >
                Other Work
              </button>
            </div>
            {form.is_other_work && (
              <p className="text-xs text-ink-500">
                For days without client production — internal tasks, training, admin, etc. Picking a client is
                optional (you can type a name if they're not in the list), item counts are optional too, and it still
                counts toward your streak as long as you say what you worked on below.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold text-ink-800">Details</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Date" htmlFor="production_date" required>
              <Input
                id="production_date"
                type="date"
                required
                value={form.production_date}
                onChange={(e) => updateField('production_date', e.target.value)}
              />
            </Field>
            <Field label="Day">
              <Input value={dayOfWeek(form.production_date)} disabled />
            </Field>
            <Field
              label={form.is_other_work ? 'Client (optional)' : 'Client'}
              htmlFor="client_id"
              required={!form.is_other_work}
            >
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
                {form.is_other_work && <option value={OTHER_CLIENT}>Other — not in list (type name)…</option>}
              </Select>
            </Field>
            {form.is_other_work && form.client_id === OTHER_CLIENT && (
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
            )}
          </CardContent>
        </Card>

        <>
            <Card>
              <CardHeader className="pb-0 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink-800">
                  Production{form.is_other_work && <span className="font-normal text-ink-500"> (optional)</span>}
                </h2>
              </CardHeader>
              <CardContent className="mt-4 flex flex-col divide-y divide-ink-100">
                {PRODUCTION_FIELDS.map((f) => {
                  const hasCount = form[f.countKey] > 0
                  return (
                    <div key={f.countKey} className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-3 items-end first:pt-0 last:pb-0">
                      <Field label={f.label}>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={form[f.countKey]}
                          onChange={(e) => updateField(f.countKey, Math.max(0, parseInt(e.target.value || '0', 10)))}
                        />
                      </Field>
                      <Field label="Status" htmlFor={f.statusKey}>
                        {hasCount ? (
                          <Select
                            id={f.statusKey}
                            value={form[f.statusKey]}
                            onChange={(e) => updateField(f.statusKey, e.target.value as ProductionStatus)}
                          >
                            <option value="completed">Completed</option>
                            <option value="in_progress">In Progress</option>
                          </Select>
                        ) : (
                          <div
                            id={f.statusKey}
                            className="h-9 flex items-center px-3 text-sm text-ink-400 bg-ink-50 border border-ink-100 rounded-md"
                          >
                            No status
                          </div>
                        )}
                      </Field>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between bg-white border border-ink-100 rounded-card shadow-card px-5 py-4">
              <span className="text-sm font-medium text-ink-600">Total Items</span>
              <span className="text-2xl font-semibold text-ink-900">{runningTotal}</span>
            </div>
        </>

        <Card>
          <CardHeader className="pb-0">
            <h2 className="text-sm font-semibold text-ink-800">{form.is_other_work ? 'What did you work on?' : 'Notes'}</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {form.is_other_work
                ? 'Required — a short description of the non-client work you did today.'
                : 'Optional — anything worth flagging for this entry.'}
            </p>
          </CardHeader>
          <CardContent className="mt-3">
            <Textarea
              rows={3}
              required={form.is_other_work}
              placeholder={
                form.is_other_work
                  ? 'e.g. team training on the new editing workflow, onboarding paperwork, helped debug the upload script…'
                  : 'e.g. client requested a re-cut on the intro, waiting on raw footage for Thursday…'
              }
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
            {!form.is_other_work && form.notes.trim() && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-500">
                  Was this actually non-production work? Move it to its own Other Work entry for this date
                  {form.client_id ? ' (kept under the same client)' : ''}.
                </p>
                <Button type="button" variant="secondary" size="sm" loading={moving} onClick={moveNotesToOtherWork}>
                  Move to Other Work
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Daily Log
          </Button>
        </div>
      </form>
    </div>
  )
}
