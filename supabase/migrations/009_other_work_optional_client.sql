-- =====================================================================
-- 009: Optional client on Other Work entries
--
-- 008 made Other Work strictly client-less. Now an Other Work entry may
-- optionally be tagged to a client. Client work still requires one.
-- =====================================================================

alter table public.production_logs drop constraint if exists production_logs_client_or_other_work_check;
alter table public.production_logs add constraint production_logs_client_or_other_work_check
  check (is_other_work = true or client_id is not null);

-- Other Work tagged to a client is internal time, not deliverable production,
-- so keep it out of the public view-only client report (it would otherwise
-- show up there as a zero-count production day).
create or replace function public.get_client_report_logs(
  p_token text,
  p_date_from date,
  p_date_to date
)
returns table (
  id uuid,
  production_date date,
  videos_edited_count integer,
  videos_edited_status production_status,
  videos_reedited_count integer,
  videos_reedited_status production_status,
  carousels_edited_count integer,
  carousels_edited_status production_status,
  carousels_reedited_count integer,
  carousels_reedited_status production_status,
  text_posts_prepared_count integer,
  text_posts_prepared_status production_status,
  text_posts_reedited_count integer,
  text_posts_reedited_status production_status
)
as $$
  select
    pl.id,
    pl.production_date,
    pl.videos_edited_count, pl.videos_edited_status,
    pl.videos_reedited_count, pl.videos_reedited_status,
    pl.carousels_edited_count, pl.carousels_edited_status,
    pl.carousels_reedited_count, pl.carousels_reedited_status,
    pl.text_posts_prepared_count, pl.text_posts_prepared_status,
    pl.text_posts_reedited_count, pl.text_posts_reedited_status
  from public.production_logs pl
  where pl.client_id = (
    select l.client_id
    from public.client_share_links l
    where l.token = p_token
      and l.revoked_at is null
  )
  and pl.is_other_work = false
  and pl.production_date between p_date_from and p_date_to
  order by pl.production_date;
$$ language sql security definer stable set search_path = public;

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
  where pl.is_other_work = false
  and pl.client_id = (
    select l.client_id
    from public.client_share_links l
    where l.token = p_token
      and l.revoked_at is null
  );
$$ language sql security definer stable set search_path = public;
