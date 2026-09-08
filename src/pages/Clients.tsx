import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select } from '../components/ui/primitives'
import { Dialog } from '../components/ui/dialog'
import type { Client, ClientStatus } from '../types/database'
import { formatDate } from '../lib/utils'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients((data ?? []) as Client[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Clients</h1>
          <p className="text-sm text-ink-500 mt-1">Only active clients appear in the daily log dropdown.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : clients.length === 0 ? (
          <EmptyState title="No clients yet" description="Add your first client to start logging production against them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                  <th className="px-5 py-3">Client Name</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Date Added</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink-900">{c.name}</td>
                    <td className="px-3 py-3">
                      <Badge variant={c.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEditing(c)}
                          className="p-1.5 text-ink-500 hover:text-pine-700 hover:bg-pine-50 rounded-md"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
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

      <ClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={load}
      />
      {editing && (
        <ClientDialog
          open
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function ClientDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean
  client?: Client
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(client?.name ?? '')
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? 'active')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = client
      ? await supabase.from('clients').update({ name, status }).eq('id', client.id)
      : await supabase.from('clients').insert({ name, status })
    setSaving(false)
    if (error) {
      toast(`Couldn't save client: ${error.message}`, 'error')
    } else {
      toast(client ? 'Client updated.' : 'Client added.', 'success')
      onClose()
      onSaved()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={client ? 'Edit Client' : 'Add Client'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Client Name" required>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {client ? 'Save Changes' : 'Add Client'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
