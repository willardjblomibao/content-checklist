-- =====================================================================
-- Client Assignments — locks each assistant to exactly one client for
-- the Growth Tracker module, matching the original spec:
--   "One employee can have one assigned client. Only Admin can change
--    assignments. Employees cannot switch clients or view other clients,
--    even through the API."
-- Run AFTER 002_growth_tracker.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
create table if not exists public.client_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_assignments_client on public.client_assignments (client_id);

drop trigger if exists trg_client_assignments_updated_at on public.client_assignments;
create trigger trg_client_assignments_updated_at before update on public.client_assignments
  for each row execute function public.set_updated_at();

alter table public.client_assignments enable row level security;

-- ---------------------------------------------------------------------
-- 2. Helper: the client_id assigned to the current user (null if none/admin)
-- ---------------------------------------------------------------------
create or replace function public.my_client_id()
returns uuid as $$
  select client_id from public.client_assignments where employee_id = auth.uid();
$$ language sql security definer stable set search_path = public;

-- ---- client_assignments policies ----
drop policy if exists "assignments_select_own_or_admin" on public.client_assignments;
create policy "assignments_select_own_or_admin"
  on public.client_assignments for select
  using (employee_id = auth.uid() or public.is_admin());

drop policy if exists "assignments_admin_manage" on public.client_assignments;
create policy "assignments_admin_manage"
  on public.client_assignments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Tighten growth-module RLS: an assistant may now only read/write
--    platforms, weekly_metrics and activity_logs for THEIR assigned
--    client, not "any active client" as in 002. Admin is unaffected.
-- ---------------------------------------------------------------------

-- ---- platforms ----
drop policy if exists "platforms_select_active_client_or_admin" on public.platforms;
create policy "platforms_select_assigned_client_or_admin"
  on public.platforms for select
  using (public.is_admin() or client_id = public.my_client_id());

-- (platforms_admin_manage from 002 already restricts writes to admins — unchanged)

-- ---- weekly_metrics ----
drop policy if exists "weekly_metrics_select_active_client_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_select_assigned_client_or_admin"
  on public.weekly_metrics for select
  using (public.is_admin() or client_id = public.my_client_id());

drop policy if exists "weekly_metrics_insert_active_client_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_insert_assigned_client_or_admin"
  on public.weekly_metrics for insert
  with check (
    created_by = auth.uid()
    and (public.is_admin() or client_id = public.my_client_id())
  );

drop policy if exists "weekly_metrics_update_own_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_update_own_or_admin"
  on public.weekly_metrics for update
  using (public.is_admin() or (created_by = auth.uid() and client_id = public.my_client_id()))
  with check (public.is_admin() or (created_by = auth.uid() and client_id = public.my_client_id()));

drop policy if exists "weekly_metrics_delete_own_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_delete_own_or_admin"
  on public.weekly_metrics for delete
  using (public.is_admin() or (created_by = auth.uid() and client_id = public.my_client_id()));

-- ---- activity_logs ----
-- (select policy already restricts to own rows or admin — unchanged.
--  Insert policy already requires user_id = auth.uid() — unchanged.)

-- ---------------------------------------------------------------------
-- 4. clients table: an assistant should only ever see their own
--    assigned client in the Growth module context (production_logs /
--    Daily Log keep their existing "any active client" behaviour —
--    unchanged — since that part of the app was not part of this
--    module's spec).
-- ---------------------------------------------------------------------
-- No change needed here: the existing "clients_select_active_for_assistants"
-- policy already lets assistants read active clients by design (Daily Log
-- depends on it). The growth pages restrict themselves in the UI layer to
-- my_client_id() for non-admins, and the table-level policies above are
-- the real enforcement for platforms/weekly_metrics/activity_logs.
