import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select, PageHeader } from '../../components/ui/primitives'
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Platforms"
        description="The channels each client is tracked on. They become the rows in Weekly input."
        actions={
          <>
            {clients.length > 0 && (
              <Select className="w-auto min-w-[180px]" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client">
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Button onClick={() => setShowAdd(true)} disabled={!clientId}>
              <Plus className="h-4 w-4" />
              Add platform
            </Button>
          </>
        }
      />

      {loading ? (
        <PageSpinner />
      ) : platforms.length === 0 ? (
        <Card>
          <EmptyState title="No platforms yet" description="Add YouTube, Instagram, TikTok, or any channel this client is tracked on." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {platforms.map((p) => (
            <Card key={p.id} className={cn('p-5 relative overflow-hidden group', !p.active && 'opacity-70')}>
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: p.color }} />
              <div className="flex items-start gap-3">
                <span
                  className="h-11 w-11 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0 shadow-soft"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900 truncate">{p.name}</p>
                  <div className="mt-1">
                    <Badge variant={p.active ? 'active' : 'inactive'} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 pt-3 border-t border-ink-100">
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto text-clay-600 hover:bg-clay-50" onClick={() => setToDelete(p)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={!clientId}
            className="rounded-2xl border-2 border-dashed border-ink-200 p-5 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-ink-500 hover:border-pine-400 hover:text-pine-700 hover:bg-pine-50/50 transition-colors min-h-[148px]"
          >
            <Plus className="h-5 w-5" />
            Add platform
          </button>
        </div>
      )}

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
