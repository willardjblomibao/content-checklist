import { FormEvent, useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Badge, Button, Card, Field, Input, PageHeader } from '../components/ui/primitives'
import { cn, initials } from '../lib/utils'

export default function Settings() {
  const { profile, refreshProfile, assignedClients } = useAuth()
  const { toast } = useToast()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSavingProfile(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
    setSavingProfile(false)
    if (error) toast(`Couldn't save: ${error.message}`, 'error')
    else {
      toast('Profile updated.', 'success')
      refreshProfile()
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast('Password must be at least 6 characters.', 'error')
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error && profile?.must_change_password) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id)
    }
    setSavingPassword(false)
    if (error) toast(`Couldn't update password: ${error.message}`, 'error')
    else {
      toast('Password updated.', 'success')
      setNewPassword('')
      refreshProfile()
    }
  }

  const isAdminRole = profile?.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your profile and password." />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-start">
        <Card>
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center text-xl font-bold shadow-soft">
                {profile ? initials(profile.full_name) : '?'}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-ink-900 truncate">{profile?.full_name}</p>
                <p className="text-sm text-ink-500 truncate">{profile?.email}</p>
                <div className="mt-1.5">
                  <Badge variant={isAdminRole ? 'admin' : 'assistant'}>{isAdminRole ? 'Admin' : 'Content assistant'}</Badge>
                </div>
              </div>
            </div>

            <form onSubmit={saveProfile} className="mt-6 pt-5 border-t border-ink-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" htmlFor="full_name">
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Email" hint="Ask an admin to change your email.">
                <Input value={profile?.email ?? ''} disabled />
              </Field>
              {!isAdminRole && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-ink-700 mb-1.5">Assigned clients</p>
                  {assignedClients.length === 0 ? (
                    <p className="text-sm text-ink-500">None yet. An admin assigns clients from the Team page.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedClients.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1.5 rounded-lg bg-pine-50 border border-pine-100 px-2.5 py-1 text-xs font-semibold text-pine-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-pine-500" />
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" loading={savingProfile} disabled={!fullName.trim() || fullName === profile?.full_name}>
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </Card>

        <Card>
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-ink-100/70 text-ink-600 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900">Password</h2>
                <p className="text-xs text-ink-500">Use at least 6 characters.</p>
              </div>
            </div>
            {profile?.must_change_password && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
                <span>You're still using the temporary password an admin set for you. Please set your own now.</span>
              </div>
            )}
            <form onSubmit={changePassword} className="flex flex-col gap-4 mt-5">
              <Field label="New password" htmlFor="new_password">
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      newPassword.length === 0 ? 'w-0' : newPassword.length < 6 ? 'w-1/3 bg-clay-500' : newPassword.length < 10 ? 'w-2/3 bg-amber-500' : 'w-full bg-pine-500'
                    )}
                  />
                </div>
                <span className="text-xs text-ink-500 w-16 text-right">
                  {newPassword.length === 0 ? '' : newPassword.length < 6 ? 'Too short' : newPassword.length < 10 ? 'OK' : 'Strong'}
                </span>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant={profile?.must_change_password ? 'primary' : 'secondary'} loading={savingPassword} disabled={newPassword.length === 0}>
                  Update password
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
