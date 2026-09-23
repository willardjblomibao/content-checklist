-- =====================================================================
-- Audience Totals — adds the running (all-time) follower count per
-- platform per week, replacing the AUDIENCE TOTALS sheet. Kept on the
-- same weekly_metrics row (not a separate table) since it's entered
-- alongside views/new_audience for the same client+platform+week.
--
-- "Change" and "Change %" (AUDIENCE TOTALS!D/E) are NOT stored — they
-- are derived in the app from this week's total_audience minus the
-- previous week's, same as the anomaly Check column from WEEKLY INPUT.
-- Run AFTER 003_client_assignments.sql. Safe to re-run.
-- =====================================================================

alter table public.weekly_metrics
  add column if not exists total_audience integer check (total_audience is null or total_audience >= 0);

comment on column public.weekly_metrics.total_audience is
  'Optional running follower count for this platform as of week_start — the AUDIENCE TOTALS sheet''s "Total Audience" column. Null if not tracked for this row.';

-- ---------------------------------------------------------------------
-- new_audience must allow negative values (net unfollows/unsubscribes
-- happen — the original workbook itself flags a -947 Facebook week as
-- a legitimate, if noteworthy, entry). 002_growth_tracker.sql wrongly
-- constrained it to >= 0; relax that here.
-- ---------------------------------------------------------------------
alter table public.weekly_metrics drop constraint if exists weekly_metrics_new_audience_check;
