import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Badge, Button, Card, CardContent, CardHeader, Field, Input } from '../components/ui/primitives'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
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
    setSavingPassword(false)
    if (error) toast(`Couldn't update password: ${error.message}`, 'error')
    else {
      toast('Password updated.', 'success')
      setNewPassword('')
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">Manage your profile and account.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-800">Profile</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="flex flex-col gap-4 mt-2">
            <Field label="Full Name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={profile?.email ?? ''} disabled />
            </Field>
            <Field label="Role">
              <div>
                <Badge variant={profile?.role === 'admin' ? 'admin' : 'assistant'} />
              </div>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-800">Password</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="flex flex-col gap-4 mt-2">
            <Field label="New Password" hint="At least 6 characters.">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={savingPassword}>
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
