import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil, Link2, Copy, Check, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select, PageHeader, StatCard, Segmented } from '../components/ui/primitives'
import { Dialog } from '../components/ui/dialog'
import type { Client, ClientShareLink, ClientStatus } from '../types/database'
import { cn, formatDate } from '../lib/utils'

const CLIENT_COLORS = ['bg-pine-600', 'bg-violet-500', 'bg-coral-500', 'bg-amber-500', 'bg-clay-500', 'bg-pine-400']
function clientColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CLIENT_COLORS[h % CLIENT_COLORS.length]
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [sharing, setSharing] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients((data ?? []) as Client[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const q = search.trim().toLowerCase()
  const shown = clients.filter((c) => (statusFilter === 'all' || c.status === statusFilter) && (!q || c.name.toLowerCase().includes(q)))
  const activeCount = clients.filter((c) => c.status === 'active').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Only active clients appear in the Daily Log. Share a view-only report link with any client."
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add client
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 max-w-2xl">
        <StatCard label="Active" value={activeCount} highlight />
        <StatCard label="Inactive" value={clients.length - activeCount} />
        <StatCard label="Total" value={clients.length} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Segmented
          ariaLabel="Filter clients"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="h-4 w-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="pl-9" aria-label="Search clients" />
        </div>
      </div>

      {loading ? (
        <PageSpinner />
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState title="No clients yet" description="Add your first client to start logging production against them." />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState title="No clients match" description="Try a different filter or search." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((c) => (
            <Card key={c.id} className={cn('p-5 flex flex-col gap-4 transition-shadow hover:shadow-soft', c.status === 'inactive' && 'opacity-70')}>
              <div className="flex items-start gap-3">
                <span className={cn('h-11 w-11 rounded-xl text-white flex items-center justify-center text-base font-bold shrink-0', clientColor(c.id))}>
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900 truncate">{c.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">Added {formatDate(c.created_at, 'MMM d, yyyy')}</p>
                </div>
                <Badge variant={c.status} />
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-ink-100">
                <Button variant="secondary" size="sm" onClick={() => setSharing(c)} className="flex-1">
                  <Link2 className="h-3.5 w-3.5" />
                  Share report
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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
          Anyone with this link can view (and filter, print, or export) {client.name}'s Growth Tracker report —
          dashboard, monthly summary, content impact, and platform comparison — no account needed. It never shows
          other clients' data, the raw production log, or internal notes.
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
