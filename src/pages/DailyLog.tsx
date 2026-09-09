import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Button, Card, CardContent, CardHeader, Field, Input, Select, PageSpinner } from '../components/ui/primitives'
import { PRODUCTION_FIELDS, totalItems, type Client, type ProductionStatus } from '../types/database'
import { dayOfWeek, todayISO } from '../lib/utils'

type FormState = {
  production_date: string
  client_id: string
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
}

const emptyForm: FormState = {
  production_date: todayISO(),
  client_id: '',
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
            client_id: data.client_id,
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
    if (!form.client_id) {
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
    const payload = { ...form, user_id: ownerId ?? profile.id }

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

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-ink-900">{editId ? 'Edit Daily Log' : 'Add Daily Log'}</h1>
      <p className="text-sm text-ink-500 mt-1">Log what you completed for a client today.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
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
            <Field label="Client" htmlFor="client_id" required>
              <Select
                id="client_id"
                required
                value={form.client_id}
                onChange={(e) => updateField('client_id', e.target.value)}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-800">Production</h2>
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
