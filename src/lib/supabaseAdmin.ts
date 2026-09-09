import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// A second, isolated Supabase client used ONLY when an admin creates a new
// team member from the Team page.
//
// Why this exists: supabase-js's auth.signUp() automatically signs the
// current client in as whichever account it just created, and persists that
// session to storage. If we called signUp() on the same client the admin is
// logged in with, adding a team member would silently swap the admin's
// session for the brand-new member's — logging the admin out.
//
// This client has persistSession/autoRefreshToken/detectSessionInUrl all
// disabled, so calling signUp() here creates the account server-side but
// never writes a session anywhere. The admin's session on the main
// `supabase` client (src/lib/supabase.ts) is completely unaffected.
export const supabaseSignupClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
