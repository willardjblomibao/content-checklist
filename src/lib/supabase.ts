import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project URL and anon key.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

/**
 * Creates a throwaway Supabase client for one-off auth operations (e.g. an
 * admin creating a new team member's account via `auth.signUp`).
 *
 * `supabase.auth.signUp` always signs the *calling client* in as the newly
 * created user. Calling it on the shared `supabase` client above would swap
 * out the admin's active session for the brand-new member's session — the
 * "why did I just get logged into their account" bug.
 *
 * This client has `persistSession`/`autoRefreshToken` off and never touches
 * localStorage, so the session it creates only lives in this disposable
 * instance and the admin's real session (held by the shared client) is
 * completely unaffected. Use it, then let it be garbage collected.
 */
export function createIsolatedAuthClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
