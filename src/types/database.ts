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

// =====================================================================
// Growth Tracker module (platforms, weekly_metrics, activity_logs)
// Converts the growth.xlsx workbook (WEEKLY INPUT / DASHBOARD / MONTHLY
// SUMMARY sheets) into first-class, multi-client data. Reuses the
// existing profiles/clients tables above rather than duplicating them.
// =====================================================================

export interface Platform {
  id: string
  client_id: string
  name: string
  icon: string
  color: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface WeeklyMetric {
  id: string
  client_id: string
  platform_id: string
  week_start: string
  year: number
  month: string
  week: number
  views: number
  new_audience: number
  /** Optional running follower count for this platform as of week_start (AUDIENCE TOTALS sheet). */
  total_audience: number | null
  created_by: string
  created_at: string
  updated_at: string
}

// Joined shape used throughout the Growth Tracker UI
export interface WeeklyMetricWithRelations extends WeeklyMetric {
  platform: Pick<Platform, 'id' | 'name' | 'icon' | 'color'> | null
  client: Pick<Client, 'id' | 'name'> | null
  profile: Pick<Profile, 'id' | 'full_name'> | null
}

export interface ActivityLog {
  id: string
  user_id: string
  client_id: string | null
  action: string
  target: string
  created_at: string
}

export interface ActivityLogWithRelations extends ActivityLog {
  profile: Pick<Profile, 'id' | 'full_name'> | null
  client: Pick<Client, 'id' | 'name'> | null
}

export interface ClientAssignment {
  id: string
  employee_id: string
  client_id: string
  created_at: string
  updated_at: string
}

export interface ClientAssignmentWithRelations extends ClientAssignment {
  employee: Pick<Profile, 'id' | 'full_name' | 'email'> | null
  client: Pick<Client, 'id' | 'name'> | null
}

/** Monday-start ISO week label helper input, used by the weekly input form. */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

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
      platforms: {
        Row: Platform
        Insert: Partial<Platform> & { client_id: string; name: string }
        Update: Partial<Platform>
      }
      weekly_metrics: {
        Row: WeeklyMetric
        Insert: Partial<WeeklyMetric> & {
          client_id: string
          platform_id: string
          week_start: string
          year: number
          month: string
          week: number
          created_by: string
        }
        Update: Partial<WeeklyMetric>
      }
      activity_logs: {
        Row: ActivityLog
        Insert: Partial<ActivityLog> & { user_id: string; action: string; target: string }
        Update: Partial<ActivityLog>
      }
      client_assignments: {
        Row: ClientAssignment
        Insert: Partial<ClientAssignment> & { employee_id: string; client_id: string }
        Update: Partial<ClientAssignment>
      }
    }
  }
}
