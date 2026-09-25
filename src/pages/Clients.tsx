import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil, Link2, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select } from '../components/ui/primitives'
import { Dialog } from '../components/ui/dialog'
import type { Client, ClientShareLink, ClientStatus } from '../types/database'
import { formatDate } from '../lib/utils'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [sharing, setSharing] = useState<Client | null>(null)

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
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setSharing(c)}
                          className="p-1.5 text-ink-500 hover:text-pine-700 hover:bg-pine-50 rounded-md"
                          aria-label="Share link"
                          title="Client view-only report link"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
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
      {sharing && <ShareLinkDialog client={sharing} onClose={() => setSharing(null)} />}
    </div>
  )
}

/**
 * Manages the view-only report link for one client: generate, copy, or
 * revoke. No client-facing login involved — the link's token is the only
 * credential, validated by the get_client_report_* RPCs (see migration
 * 006_client_share_links.sql). Revoking here breaks the link immediately;
 * generating again issues a fresh token so any previously shared link
 * stops working.
 */
function ShareLinkDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { toast } = useToast()
  const [link, setLink] = useState<ClientShareLink | null | undefined>(undefined) // undefined = loading
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('client_share_links')
      .select('*')
      .eq('client_id', client.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
    setLink(((data ?? [])[0] as ClientShareLink) ?? null)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  const url = link ? `${window.location.origin}/client-report/${link.token}` : ''

  async function handleGenerate() {
    setBusy(true)
    // A client only ever has one *active* link in this UI — revoke the old
    // one (if any) so a previously shared link can't keep working alongside
    // a new one.
    if (link) {
      await supabase.from('client_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', link.id)
    }
    const { data, error } = await supabase
      .from('client_share_links')
      .insert({ client_id: client.id, created_by: (await supabase.auth.getUser()).data.user?.id })
      .select()
      .single()
    setBusy(false)
    if (error) {
      toast(`Couldn't create link: ${error.message}`, 'error')
    } else {
      setLink(data as ClientShareLink)
      toast('Link generated.', 'success')
    }
  }

  async function handleRevoke() {
    if (!link) return
    setBusy(true)
    const { error } = await supabase
      .from('client_share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', link.id)
    setBusy(false)
    if (error) {
      toast(`Couldn't revoke link: ${error.message}`, 'error')
    } else {
      setLink(null)
      toast('Link revoked. It will no longer open.', 'success')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open onClose={onClose} title={`Share link — ${client.name}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-500">
          Anyone with this link can view (and filter, print, or export) {client.name}'s production report — no
          account needed. It never shows other clients' data or internal notes.
        </p>

        {link === undefined ? (
          <PageSpinner />
        ) : link ? (
          <>
            <div className="flex items-center gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="danger" size="sm" onClick={handleRevoke} disabled={busy}>
                Revoke Link
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleGenerate} disabled={busy}>
                Generate New Link
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={handleGenerate} loading={busy}>
              Generate Link
            </Button>
          </div>
        )}
      </div>
    </Dialog>
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

  // This dialog stays mounted (only `open` toggles) for the "Add Client"
  // case, so without this its fields would keep whatever was last typed —
  // including after a successful add or a cancel. Re-sync to fresh
  // defaults (or the client being edited) every time it's opened.
  useEffect(() => {
    if (open) {
      setName(client?.name ?? '')
      setStatus(client?.status ?? 'active')
    }
  }, [open, client])

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
