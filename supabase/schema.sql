-- =====================================================================
-- Content Team Production Tracker — Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- on a fresh project. Safe to re-run: uses IF NOT EXISTS / OR REPLACE
-- where possible, but DROP POLICY blocks assume a clean first run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'assistant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type production_status as enum ('completed', 'in_progress');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------

-- profiles: one row per auth.users user, created automatically on signup
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role user_role not null default 'assistant',
  status member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- production_logs
create table if not exists public.production_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  production_date date not null,

  videos_edited_count integer not null default 0 check (videos_edited_count >= 0),
  videos_edited_status production_status not null default 'completed',

  videos_reedited_count integer not null default 0 check (videos_reedited_count >= 0),
  videos_reedited_status production_status not null default 'completed',

  carousels_edited_count integer not null default 0 check (carousels_edited_count >= 0),
  carousels_edited_status production_status not null default 'completed',

  carousels_reedited_count integer not null default 0 check (carousels_reedited_count >= 0),
  carousels_reedited_status production_status not null default 'completed',

  text_posts_prepared_count integer not null default 0 check (text_posts_prepared_count >= 0),
  text_posts_prepared_status production_status not null default 'completed',

  text_posts_reedited_count integer not null default 0 check (text_posts_reedited_count >= 0),
  text_posts_reedited_status production_status not null default 'completed',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_production_logs_date on public.production_logs (production_date);
create index if not exists idx_production_logs_user on public.production_logs (user_id);
create index if not exists idx_production_logs_client on public.production_logs (client_id);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_clients_status on public.clients (status);

-- ---------------------------------------------------------------------
-- 5. updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_production_logs_updated_at on public.production_logs;
create trigger trg_production_logs_updated_at before update on public.production_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Auto-create a profile row whenever a new auth user signs up
--    The first user ever created becomes admin; everyone after is
--    an assistant by default (promote via the Team page or SQL).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from public.profiles;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when existing_count = 0 then 'admin' else 'assistant' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.production_logs enable row level security;

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

-- ---- profiles policies ----
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_limited" on public.profiles;
create policy "profiles_update_own_limited"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- clients policies ----
drop policy if exists "clients_select_active_for_assistants" on public.clients;
create policy "clients_select_active_for_assistants"
  on public.clients for select
  using (status = 'active' or public.is_admin());

drop policy if exists "clients_admin_manage" on public.clients;
create policy "clients_admin_manage"
  on public.clients for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- production_logs policies ----
drop policy if exists "logs_select_own_or_admin" on public.production_logs;
create policy "logs_select_own_or_admin"
  on public.production_logs for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "logs_insert_own_or_admin" on public.production_logs;
create policy "logs_insert_own_or_admin"
  on public.production_logs for insert
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "logs_update_own_or_admin" on public.production_logs;
create policy "logs_update_own_or_admin"
  on public.production_logs for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "logs_delete_own_or_admin" on public.production_logs;
create policy "logs_delete_own_or_admin"
  on public.production_logs for delete
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 8. Seed data (optional) — matches the original spreadsheet's assistants.
--    Comment this block out if you'd rather add people via the Team page.
--    NOTE: this only seeds clients; team members must sign up (or be
--    added via the app's "Add Member" dialog) since they need real
--    auth.users accounts with passwords.
-- ---------------------------------------------------------------------
insert into public.clients (name, status)
values
  ('Client A', 'active'),
  ('Client B', 'active')
on conflict (name) do nothing;
