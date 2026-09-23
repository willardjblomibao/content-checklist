-- =====================================================================
-- Growth Tracker module — adds on top of supabase/schema.sql
-- Run this in the Supabase SQL editor AFTER schema.sql has been applied.
-- Safe to re-run.
--
-- Reuses the existing profiles / clients / is_admin() from schema.sql.
-- Follows the same permission model already used for production_logs:
-- admins manage everything, any active assistant can read/write growth
-- data for any *active* client (there is no per-employee client lock in
-- this codebase today — see README note in the app for details).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- platforms: the channels a client is tracked on (YouTube, Instagram, ...)
create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  icon text not null default 'Globe',
  color text not null default '#2F6B4F',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

-- weekly_metrics: one row per client + platform + week
create table if not exists public.weekly_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  week_start date not null,
  year integer not null,
  month text not null,
  week integer not null,
  views integer not null default 0 check (views >= 0),
  new_audience integer not null default 0 check (new_audience >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, platform_id, week_start)
);

-- activity_logs: lightweight audit trail for growth-module actions
-- (the app already has no generic activity log; this one is scoped to
-- the growth module so it doesn't touch production_logs behaviour)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_platforms_client on public.platforms (client_id);
create index if not exists idx_weekly_metrics_client on public.weekly_metrics (client_id);
create index if not exists idx_weekly_metrics_platform on public.weekly_metrics (platform_id);
create index if not exists idx_weekly_metrics_week_start on public.weekly_metrics (week_start);
create index if not exists idx_activity_logs_user on public.activity_logs (user_id);
create index if not exists idx_activity_logs_client on public.activity_logs (client_id);

-- ---------------------------------------------------------------------
-- 3. updated_at triggers (reuses public.set_updated_at() from schema.sql)
-- ---------------------------------------------------------------------
drop trigger if exists trg_platforms_updated_at on public.platforms;
create trigger trg_platforms_updated_at before update on public.platforms
  for each row execute function public.set_updated_at();

drop trigger if exists trg_weekly_metrics_updated_at on public.weekly_metrics;
create trigger trg_weekly_metrics_updated_at before update on public.weekly_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Row Level Security (reuses public.is_admin() from schema.sql)
-- ---------------------------------------------------------------------
alter table public.platforms enable row level security;
alter table public.weekly_metrics enable row level security;
alter table public.activity_logs enable row level security;

-- ---- platforms policies ----
drop policy if exists "platforms_select_active_client_or_admin" on public.platforms;
create policy "platforms_select_active_client_or_admin"
  on public.platforms for select
  using (
    public.is_admin()
    or exists (select 1 from public.clients c where c.id = client_id and c.status = 'active')
  );

drop policy if exists "platforms_admin_manage" on public.platforms;
create policy "platforms_admin_manage"
  on public.platforms for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- weekly_metrics policies ----
drop policy if exists "weekly_metrics_select_active_client_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_select_active_client_or_admin"
  on public.weekly_metrics for select
  using (
    public.is_admin()
    or exists (select 1 from public.clients c where c.id = client_id and c.status = 'active')
  );

drop policy if exists "weekly_metrics_insert_active_client_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_insert_active_client_or_admin"
  on public.weekly_metrics for insert
  with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.clients c where c.id = client_id and c.status = 'active')
    )
  );

drop policy if exists "weekly_metrics_update_own_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_update_own_or_admin"
  on public.weekly_metrics for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "weekly_metrics_delete_own_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_delete_own_or_admin"
  on public.weekly_metrics for delete
  using (created_by = auth.uid() or public.is_admin());

-- ---- activity_logs policies ----
drop policy if exists "activity_logs_select_own_or_admin" on public.activity_logs;
create policy "activity_logs_select_own_or_admin"
  on public.activity_logs for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own"
  on public.activity_logs for insert
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Seed default platforms for every existing active client
--    (safe no-op on clients that already have platforms with these names)
-- ---------------------------------------------------------------------
insert into public.platforms (client_id, name, icon, color)
select c.id, p.name, p.icon, p.color
from public.clients c
cross join (values
  ('YouTube', 'Youtube', '#FF0000'),
  ('Instagram', 'Instagram', '#E1306C'),
  ('TikTok', 'Music2', '#000000'),
  ('Facebook', 'Facebook', '#1877F2'),
  ('LinkedIn', 'Linkedin', '#0A66C2'),
  ('Threads', 'AtSign', '#000000')
) as p(name, icon, color)
on conflict (client_id, name) do nothing;
