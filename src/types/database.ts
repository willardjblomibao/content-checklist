export type UserRole = 'admin' | 'assistant'
export type MemberStatus = 'active' | 'inactive'
export type ClientStatus = 'active' | 'inactive'
export type ProductionStatus = 'completed' | 'in_progress'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  status: MemberStatus
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  status: ClientStatus
  created_at: string
  updated_at: string
}

export interface ProductionLog {
  id: string
  user_id: string
  client_id: string
  production_date: string
  videos_edited_count: number
  videos_edited_status: ProductionStatus
  videos_reedited_count: number
  videos_reedited_status: ProductionStatus
  carousels_edited_count: number
  carousels_edited_status: ProductionStatus
  carousels_reedited_count: number
  carousels_reedited_status: ProductionStatus
  text_posts_prepared_count: number
  text_posts_prepared_status: ProductionStatus
  text_posts_reedited_count: number
  text_posts_reedited_status: ProductionStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// Joined shape used throughout the UI (log + client name + assistant name)
export interface ProductionLogWithRelations extends ProductionLog {
  client: Pick<Client, 'id' | 'name' | 'status'> | null
  profile: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

export const PRODUCTION_FIELDS = [
  { countKey: 'videos_edited_count', statusKey: 'videos_edited_status', label: 'Videos Edited' },
  { countKey: 'videos_reedited_count', statusKey: 'videos_reedited_status', label: 'Videos Re-edited' },
  { countKey: 'carousels_edited_count', statusKey: 'carousels_edited_status', label: 'Carousels Edited' },
  { countKey: 'carousels_reedited_count', statusKey: 'carousels_reedited_status', label: 'Carousels Re-edited' },
  { countKey: 'text_posts_prepared_count', statusKey: 'text_posts_prepared_status', label: 'Text Posts Prepared' },
  { countKey: 'text_posts_reedited_count', statusKey: 'text_posts_reedited_status', label: 'Text Posts Re-edited' },
] as const

export function totalItems(log: Pick<ProductionLog,
  'videos_edited_count' | 'videos_reedited_count' | 'carousels_edited_count' |
  'carousels_reedited_count' | 'text_posts_prepared_count' | 'text_posts_reedited_count'>): number {
  return (
    log.videos_edited_count +
    log.videos_reedited_count +
    log.carousels_edited_count +
    log.carousels_reedited_count +
    log.text_posts_prepared_count +
    log.text_posts_reedited_count
  )
}

// Minimal Database type for the Supabase client generic.
// Regenerate with `supabase gen types typescript` once your project is live for full type safety.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; full_name: string; email: string }
        Update: Partial<Profile>
      }
      clients: {
        Row: Client
        Insert: Partial<Client> & { name: string }
        Update: Partial<Client>
      }
      production_logs: {
        Row: ProductionLog
        Insert: Partial<ProductionLog> & {
          user_id: string
          client_id: string
          production_date: string
        }
        Update: Partial<ProductionLog>
      }
    }
  }
}
