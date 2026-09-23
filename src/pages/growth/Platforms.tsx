import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select } from '../../components/ui/primitives'
import { Dialog, ConfirmDialog } from '../../components/ui/dialog'
import type { Client, Platform } from '../../types/database'

const PRESET_COLORS = ['#2F6B4F', '#D97757', '#0A66C2', '#E1306C', '#FF0000', '#1877F2', '#000000', '#7C3AED']

export default function Platforms() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Platform | null>(null)
  const [toDelete, setToDelete] = useState<Platform | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => {
        const list = (data ?? []) as Client[]
        setClients(list)
        setClientId((c) => c || list[0]?.id || '')
      })
  }, [])

  function load() {
    if (!clientId) return
    setLoading(true)
    supabase
      .from('platforms')
      .select('*')
      .eq('client_id', clientId)
      .order('name')
      .then(({ data }) => {
        setPlatforms((data ?? []) as Platform[])
        setLoading(false)
      })
  }

  useEffect(load, [clientId])

  async function handleDelete() {
    if (!toDelete) return
    const { error } = await supabase.from('platforms').delete().eq('id', toDelete.id)
    if (error) {
      toast(`Couldn't delete: ${error.message}`, 'error')
    } else {
      toast('Platform deleted (its weekly data went with it).', 'success')
      setToDelete(null)
      load()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Platforms</h1>
          <p className="text-sm text-ink-500 mt-1">The channels each client is tracked on — feeds the Weekly Growth Input form.</p>
        </div>
        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <Select className="w-48" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <Button onClick={() => setShowAdd(true)} disabled={!clientId}>
            <Plus className="h-4 w-4" />
            Add Platform
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : platforms.length === 0 ? (
          <EmptyState title="No platforms yet" description="Add YouTube, Instagram, TikTok, or any channel this client is tracked on." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={p.active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(p)}
                          className="p-1.5 text-ink-500 hover:text-pine-700 hover:bg-pine-50 rounded-md"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setToDelete(p)}
                          className="p-1.5 text-ink-500 hover:text-clay-600 hover:bg-clay-50 rounded-md"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PlatformDialog open={showAdd} clientId={clientId} onClose={() => setShowAdd(false)} onSaved={load} />
      {editing && (
        <PlatformDialog open clientId={clientId} platform={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete this platform?"
        description={`${toDelete?.name ?? ''} and all of its weekly growth data will be deleted. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}

function PlatformDialog({
  open,
  clientId,
  platform,
  onClose,
  onSaved,
}: {
  open: boolean
  clientId: string
  platform?: Platform
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(platform?.name ?? '')
  const [color, setColor] = useState(platform?.color ?? PRESET_COLORS[0])
  const [active, setActive] = useState(platform?.active ?? true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(platform?.name ?? '')
      setColor(platform?.color ?? PRESET_COLORS[0])
      setActive(platform?.active ?? true)
    }
  }, [open, platform])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = platform
      ? await supabase.from('platforms').update({ name, color, active }).eq('id', platform.id)
      : await supabase.from('platforms').insert({ client_id: clientId, name, color, active })
    setSaving(false)
    if (error) {
      toast(`Couldn't save platform: ${error.message}`, 'error')
    } else {
      toast(platform ? 'Platform updated.' : 'Platform added.', 'success')
      onClose()
      onSaved()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={platform ? 'Edit Platform' : 'Add Platform'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Platform Name" required>
          <Input required placeholder="e.g. YouTube" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2"
                style={{ backgroundColor: c, borderColor: color === c ? '#111815' : 'transparent' }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Status">
          <Select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {platform ? 'Save Changes' : 'Add Platform'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
