-- =====================================================================
-- Multiple client assignments per employee — relaxes 003's "one
-- employee, one client" rule to "one employee, many clients". An
-- employee can now see/edit the Growth Tracker data of every client
-- assigned to them, still with no access to unassigned clients.
-- Run AFTER 004_audience_totals.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Drop the one-row-per-employee constraint; a pair should still be
--    unique (no duplicate assignment of the same client to the same
--    employee), but an employee can now have many rows.
-- ---------------------------------------------------------------------
alter table public.client_assignments drop constraint if exists client_assignments_employee_id_key;
alter table public.client_assignments add constraint client_assignments_employee_client_key unique (employee_id, client_id);

-- ---------------------------------------------------------------------
-- 2. Replace the single-client helper with a set-returning one. Old
--    call sites (client_id = public.my_client_id()) become
--    (client_id in (select public.my_client_ids())) below.
-- ---------------------------------------------------------------------
drop function if exists public.my_client_id();

create or replace function public.my_client_ids()
returns setof uuid as $$
  select client_id from public.client_assignments where employee_id = auth.uid();
$$ language sql security definer stable set search_path = public;

-- ---- platforms ----
drop policy if exists "platforms_select_assigned_client_or_admin" on public.platforms;
create policy "platforms_select_assigned_client_or_admin"
  on public.platforms for select
  using (public.is_admin() or client_id in (select public.my_client_ids()));

-- ---- weekly_metrics ----
drop policy if exists "weekly_metrics_select_assigned_client_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_select_assigned_client_or_admin"
  on public.weekly_metrics for select
  using (public.is_admin() or client_id in (select public.my_client_ids()));

drop policy if exists "weekly_metrics_insert_assigned_client_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_insert_assigned_client_or_admin"
  on public.weekly_metrics for insert
  with check (
    created_by = auth.uid()
    and (public.is_admin() or client_id in (select public.my_client_ids()))
  );

drop policy if exists "weekly_metrics_update_own_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_update_own_or_admin"
  on public.weekly_metrics for update
  using (public.is_admin() or (created_by = auth.uid() and client_id in (select public.my_client_ids())))
  with check (public.is_admin() or (created_by = auth.uid() and client_id in (select public.my_client_ids())));

drop policy if exists "weekly_metrics_delete_own_or_admin" on public.weekly_metrics;
create policy "weekly_metrics_delete_own_or_admin"
  on public.weekly_metrics for delete
  using (public.is_admin() or (created_by = auth.uid() and client_id in (select public.my_client_ids())));

-- activity_logs policies are unaffected — they already scope by
-- user_id = auth.uid(), independent of which/how many clients that
-- user is assigned to.
