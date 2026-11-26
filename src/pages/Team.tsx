import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil, UserX, UserCheck, Link2, Search } from 'lucide-react'
import { supabase, createIsolatedAuthClient } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { usePresence } from '../contexts/PresenceContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select, PageHeader, StatCard, Segmented } from '../components/ui/primitives'
import { Dialog, ConfirmDialog } from '../components/ui/dialog'
import type { Client, ClientAssignment, Profile, UserRole } from '../types/database'
import { cn, formatDate, initials } from '../lib/utils'

const AVATAR_COLORS = ['bg-pine-600', 'bg-violet-500', 'bg-clay-500', 'bg-amber-500', 'bg-pine-400', 'bg-coral-500']
function avatarColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

type MemberTotals = Record<string, number>

export default function Team() {
  const { toast } = useToast()
  const { onlineUserIds } = usePresence()
  const [members, setMembers] = useState<Profile[]>([])
  const [totals, setTotals] = useState<MemberTotals>({})
  const [clients, setClients] = useState<Client[]>([])
  const [assignments, setAssignments] = useState<Record<string, ClientAssignment[]>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toggling, setToggling] = useState<Profile | null>(null)
  const [assigning, setAssigning] = useState<Profile | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'assistant' | 'admin' | 'inactive'>('all')

  async function load() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')
    setMembers((profiles ?? []) as Profile[])

    const { data: clientRows } = await supabase.from('clients').select('*').eq('status', 'active').order('name')
    setClients((clientRows ?? []) as Client[])

    const { data: assignmentRows } = await supabase.from('client_assignments').select('*')
    const byEmployee: Record<string, ClientAssignment[]> = {}
    for (const a of (assignmentRows ?? []) as ClientAssignment[]) {
      byEmployee[a.employee_id] = [...(byEmployee[a.employee_id] ?? []), a]
    }
    setAssignments(byEmployee)

    const { data: logs } = await supabase.from('production_logs').select('user_id, videos_edited_count, videos_reedited_count, carousels_edited_count, carousels_reedited_count, text_posts_prepared_count, text_posts_reedited_count')
    const t: MemberTotals = {}
    for (const log of logs ?? []) {
      const sum =
        (log as any).videos_edited_count +
        (log as any).videos_reedited_count +
        (log as any).carousels_edited_count +
        (log as any).carousels_reedited_count +
        (log as any).text_posts_prepared_count +
        (log as any).text_posts_reedited_count
      t[(log as any).user_id] = (t[(log as any).user_id] ?? 0) + sum
    }
    setTotals(t)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleStatus() {
    if (!toggling) return
    const next = toggling.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', toggling.id)
    setToggling(null)
    if (error) {
      toast(`Couldn't update status: ${error.message}`, 'error')
    } else {
      toast(`${toggling.full_name} is now ${next}.`, 'success')
      load()
    }
  }

  const q = search.trim().toLowerCase()
  const shown = members.filter(
    (m) =>
      (roleFilter === 'all' || (roleFilter === 'inactive' ? m.status === 'inactive' : m.role === roleFilter && m.status === 'active')) &&
      (!q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  )
  const onlineCount = members.filter((m) => onlineUserIds.has(m.id)).length
  const activeAssistants = members.filter((m) => m.role === 'assistant' && m.status === 'active')
  const unassigned = activeAssistants.filter((m) => (assignments[m.id]?.length ?? 0) === 0).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Manage assistants and admins, and who works on which client."
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add member
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Team members" value={members.filter((m) => m.status === 'active').length} sub={`${members.filter((m) => m.status === 'inactive').length} inactive`} />
        <StatCard label="Active assistants" value={activeAssistants.length} highlight />
        <StatCard
          label="Online now"
          value={
            <span className="inline-flex items-center gap-2">
              {onlineCount}
              <span className="relative flex h-2.5 w-2.5">
                {onlineCount > 0 && <span className="absolute inline-flex h-full w-full rounded-full bg-pine-400 opacity-60 animate-ping" />}
                <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', onlineCount > 0 ? 'bg-pine-500' : 'bg-ink-300')} />
              </span>
            </span>
          }
        />
        <StatCard
          label="Unassigned assistants"
          value={unassigned}
          sub={unassigned > 0 ? 'Assign them a client' : 'Everyone has a client'}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Segmented
          ariaLabel="Filter members"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'assistant', label: 'Assistants' },
            { value: 'admin', label: 'Admins' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="h-4 w-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search team" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : members.length === 0 ? (
          <EmptyState title="No team members yet" description="Add your first content assistant to get started." />
        ) : shown.length === 0 ? (
          <EmptyState title="No one matches" description="Try a different filter or search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Clients</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 whitespace-nowrap">Joined</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Total items</th>
                  <th className="px-5 py-3 w-[120px]" />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => {
                  const online = onlineUserIds.has(m.id)
                  return (
                    <tr key={m.id} className={cn('border-b border-ink-100/70 last:border-0 hover:bg-ink-50/60', m.status === 'inactive' && 'opacity-60')}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="relative shrink-0">
                            <span className={cn('h-9 w-9 rounded-full text-white flex items-center justify-center text-xs font-semibold', avatarColor(m.id))}>
                              {initials(m.full_name)}
                            </span>
                            <span
                              className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white', online ? 'bg-pine-500' : 'bg-ink-200')}
                              title={online ? 'Online' : 'Offline'}
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink-900 truncate">{m.full_name}</span>
                            <span className="block text-xs text-ink-500 truncate">{m.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={m.role === 'admin' ? 'admin' : 'assistant'} />
                      </td>
                      <td className="px-3 py-3 text-ink-600">
                        {m.role === 'admin' ? (
                          <span className="text-ink-300">—</span>
                        ) : (assignments[m.id]?.length ?? 0) === 0 ? (
                          <button
                            onClick={() => setAssigning(m)}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600 hover:bg-amber-200"
                          >
                            <Plus className="h-3 w-3" /> Assign
                          </button>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignments[m.id]!.map((a) => {
                              const name = clients.find((c) => c.id === a.client_id)?.name
                              return name ? (
                                <span key={a.id} className="inline-flex items-center gap-1 text-xs font-medium bg-ink-100/70 text-ink-700 px-2 py-0.5 rounded-md whitespace-nowrap">
                                  <span className="h-1.5 w-1.5 rounded-full bg-pine-500" />
                                  {name}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={m.status} />
                      </td>
                      <td className="px-3 py-3 text-ink-500 whitespace-nowrap">{formatDate(m.created_at, 'MMM d, yyyy')}</td>
                      <td className="px-3 py-3 text-right font-bold text-ink-900 tabular-nums">{(totals[m.id] ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-0.5">
                          {m.role !== 'admin' && (
                            <button
                              onClick={() => setAssigning(m)}
                              className="p-1.5 text-ink-400 hover:text-pine-700 hover:bg-pine-50 rounded-lg"
                              aria-label="Assign clients"
                              title="Assign clients"
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditing(m)}
                            className="p-1.5 text-ink-400 hover:text-pine-700 hover:bg-pine-50 rounded-lg"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setToggling(m)}
                            className="p-1.5 text-ink-400 hover:text-clay-600 hover:bg-clay-50 rounded-lg"
                            aria-label={m.status === 'active' ? 'Deactivate' : 'Activate'}
                            title={m.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {m.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
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

      <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />
      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {assigning && (
        <AssignClientDialog
          member={assigning}
          clients={clients}
          currentAssignments={assignments[assigning.id] ?? []}
          onClose={() => setAssigning(null)}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={toggleStatus}
        confirmLabel={toggling?.status === 'active' ? 'Deactivate' : 'Activate'}
        title={toggling?.status === 'active' ? 'Deactivate member?' : 'Activate member?'}
        description={
          toggling?.status === 'active'
            ? `${toggling?.full_name} will no longer be able to log in. Their historical records are kept.`
            : `${toggling?.full_name} will regain access.`
        }
      />
    </div>
  )
}

function AddMemberDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('assistant')
  const [saving, setSaving] = useState(false)

  // Stays mounted while only `open` toggles, so reset fields every time it
  // opens (covers both "cancelled last time" and "just added someone").
  useEffect(() => {
    if (open) {
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('assistant')
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    // Admin-created accounts: sign the user up on a throwaway, non-persisting
    // client (see createIsolatedAuthClient) so this doesn't swap out the
    // admin's own session for the new member's — then set their profile role
    // with the admin's still-active session.
    // Note: this uses the public signUp flow, which requires "Confirm email"
    // to be disabled in Supabase Auth settings for instant access, OR the
    // assistant confirms via the email Supabase sends.

    // Belt-and-suspenders: snapshot the admin's own session up front so we
    // can force-restore it on the shared client afterward, no matter what.
    const {
      data: { session: adminSession },
    } = await supabase.auth.getSession()

    const authClient = createIsolatedAuthClient()
    const { data, error } = await authClient.auth.signUp({ email, password })
    if (error || !data.user) {
      toast(`Couldn't create account: ${error?.message ?? 'unknown error'}`, 'error')
      setSaving(false)
      return
    }
    // Immediately drop the throwaway session now that the account exists —
    // we only needed it to run signUp without touching the admin's session.
    if (data.session) {
      await authClient.auth.signOut()
    }

    // Force-restore the admin's session on the shared client. If nothing
    // ever touched it, this is a harmless no-op; if anything did, this
    // guarantees the admin ends up back in their own account.
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, role, must_change_password: true })
      .eq('id', data.user.id)

    setSaving(false)
    if (profileError) {
      toast(`Account created, but profile update failed: ${profileError.message}`, 'error')
    } else {
      toast(`${fullName} added to the team.`, 'success')
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('assistant')
      onClose()
      onSaved()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Team Member">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full Name" required>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email" required>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Temporary Password" required hint="They'll be prompted to change this as soon as they log in.">
          <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="assistant">Content Assistant</option>
            <option value="admin">Admin / Manager</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add Member
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function EditMemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Profile
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState(member.full_name)
  const [role, setRole] = useState<UserRole>(member.role)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName, role }).eq('id', member.id)
    setSaving(false)
    if (error) {
      toast(`Couldn't save changes: ${error.message}`, 'error')
    } else {
      toast('Member updated.', 'success')
      onClose()
      onSaved()
    }
  }

  return (
    <Dialog open onClose={onClose} title="Edit Team Member">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full Name" required>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={member.email} disabled />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="assistant">Content Assistant</option>
            <option value="admin">Admin / Manager</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function AssignClientDialog({
  member,
  clients,
  currentAssignments,
  onClose,
  onSaved,
}: {
  member: Profile
  clients: Client[]
  currentAssignments: ClientAssignment[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>(currentAssignments.map((a) => a.client_id))
  const [saving, setSaving] = useState(false)

  function toggle(clientId: string) {
    setSelected((s) => (s.includes(clientId) ? s.filter((id) => id !== clientId) : [...s, clientId]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    const before = new Set(currentAssignments.map((a) => a.client_id))
    const after = new Set(selected)
    const toAdd = selected.filter((id) => !before.has(id))
    const toRemove = currentAssignments.filter((a) => !after.has(a.client_id))

    let error: string | null = null
    if (toAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('client_assignments')
        .insert(toAdd.map((client_id) => ({ employee_id: member.id, client_id })))
      if (insertError) error = insertError.message
    }
    if (!error && toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('client_assignments')
        .delete()
        .in('id', toRemove.map((a) => a.id))
      if (deleteError) error = deleteError.message
    }

    setSaving(false)
    if (error) {
      toast(`Couldn't update assignments: ${error}`, 'error')
    } else {
      toast(`${member.full_name}'s assigned clients were updated.`, 'success')
      onClose()
      onSaved()
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Assign Clients — ${member.full_name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-ink-500">
          {member.full_name} will only see and edit Growth Tracker data for the clients checked below — pick as many as apply.
        </p>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border border-ink-100 rounded-md p-2">
          {clients.length === 0 && <p className="text-sm text-ink-400 px-2 py-1.5">No active clients yet.</p>}
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-ink-50 cursor-pointer text-sm text-ink-800">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="h-4 w-4 rounded border-ink-300 text-pine-700 focus:ring-pine-500"
              />
              {c.name}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Assignments
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
