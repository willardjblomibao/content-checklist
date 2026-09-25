-- =====================================================================
-- 007: Client growth report RPCs
--
-- The client share link (see 006_client_share_links.sql) now serves the
-- Growth Tracker module instead of the raw production log: platforms,
-- weekly views/audience metrics, monthly summaries, platform-vs-platform
-- comparison, and the content-vs-growth correlation view — all read-only,
-- all scoped to the one client the token belongs to.
--
-- Each function re-validates the token itself (never trusts a client_id
-- passed in from the browser), so a bad or revoked token simply returns
-- zero rows from every one of these, exactly like 006's functions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Platforms for this client (needed to label/color weekly_metrics rows
--    and to power the Platform vs Platform picker).
-- ---------------------------------------------------------------------
create or replace function public.get_client_growth_platforms(p_token text)
returns table (id uuid, name text, icon text, color text, active boolean)
as $$
  select p.id, p.name, p.icon, p.color, p.active
  from public.platforms p
  where p.client_id = (
    select l.client_id
    from public.client_share_links l
    where l.token = p_token
      and l.revoked_at is null
  )
  order by p.name;
$$ language sql security definer stable set search_path = public;

revoke all on function public.get_client_growth_platforms(text) from public;
grant execute on function public.get_client_growth_platforms(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Every weekly_metrics row for this client, across all years — the
--    client-side dashboard/monthly/comparison views filter by year
--    themselves, same as the admin pages do, rather than round-tripping
--    per year.
-- ---------------------------------------------------------------------
create or replace function public.get_client_growth_weekly_metrics(p_token text)
returns table (
  id uuid,
  platform_id uuid,
  platform_name text,
  platform_color text,
  week_start date,
  year integer,
  month text,
  week integer,
  views integer,
  new_audience integer,
  total_audience integer
)
as $$
  select
    wm.id, wm.platform_id, p.name, p.color,
    wm.week_start, wm.year, wm.month, wm.week,
    wm.views, wm.new_audience, wm.total_audience
  from public.weekly_metrics wm
  join public.platforms p on p.id = wm.platform_id
  where wm.client_id = (
    select l.client_id
    from public.client_share_links l
    where l.token = p_token
      and l.revoked_at is null
  )
  order by wm.week_start;
$$ language sql security definer stable set search_path = public;

revoke all on function public.get_client_growth_weekly_metrics(text) from public;
grant execute on function public.get_client_growth_weekly_metrics(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Production counts per day for this client, for the Content Impact
--    (correlation) view only — same privacy trim as 006: no notes, no
--    assistant identity, just the counts needed to bucket by week.
-- ---------------------------------------------------------------------
create or replace function public.get_client_growth_production_summary(p_token text)
returns table (
  production_date date,
  videos_edited_count integer,
  videos_reedited_count integer,
  carousels_edited_count integer,
  carousels_reedited_count integer,
  text_posts_prepared_count integer,
  text_posts_reedited_count integer
)
as $$
  select
    pl.production_date,
    pl.videos_edited_count, pl.videos_reedited_count,
    pl.carousels_edited_count, pl.carousels_reedited_count,
    pl.text_posts_prepared_count, pl.text_posts_reedited_count
  from public.production_logs pl
  where pl.client_id = (
    select l.client_id
    from public.client_share_links l
    where l.token = p_token
      and l.revoked_at is null
  );
$$ language sql security definer stable set search_path = public;

revoke all on function public.get_client_growth_production_summary(text) from public;
grant execute on function public.get_client_growth_production_summary(text) to anon, authenticated;
