import { FormEvent, useEffect, useState } from 'react'
import { Plus, Pencil, UserX, UserCheck } from 'lucide-react'
import { supabase, createIsolatedAuthClient } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { Badge, Button, Card, EmptyState, Field, Input, PageSpinner, Select } from '../components/ui/primitives'
import { Dialog, ConfirmDialog } from '../components/ui/dialog'
import type { Profile, UserRole } from '../types/database'
import { formatDate } from '../lib/utils'

type MemberTotals = Record<string, number>

export default function Team() {
  const { toast } = useToast()
  const [members, setMembers] = useState<Profile[]>([])
  const [totals, setTotals] = useState<MemberTotals>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toggling, setToggling] = useState<Profile | null>(null)

  async function load() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')
    setMembers((profiles ?? []) as Profile[])

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Team</h1>
          <p className="text-sm text-ink-500 mt-1">Manage assistants and admins.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageSpinner />
        ) : members.length === 0 ? (
          <EmptyState title="No team members yet" description="Add your first content assistant to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium text-ink-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Date Joined</th>
                  <th className="px-3 py-3 text-right">Total Items</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink-900 whitespace-nowrap">{m.full_name}</td>
                    <td className="px-3 py-3 text-ink-600 whitespace-nowrap">{m.email}</td>
                    <td className="px-3 py-3">
                      <Badge variant={m.role === 'admin' ? 'admin' : 'assistant'} />
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={m.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-500 whitespace-nowrap">{formatDate(m.created_at)}</td>
                    <td className="px-3 py-3 text-right font-medium text-ink-800">{totals[m.id] ?? 0}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(m)}
                          className="p-1.5 text-ink-500 hover:text-pine-700 hover:bg-pine-50 rounded-md"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setToggling(m)}
                          className="p-1.5 text-ink-500 hover:text-clay-600 hover:bg-clay-50 rounded-md"
                          aria-label={m.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {m.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
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

      <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />
      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} onSaved={load} />}

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
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, role })
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
        <Field label="Temporary Password" required hint="They can change this after logging in.">
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
