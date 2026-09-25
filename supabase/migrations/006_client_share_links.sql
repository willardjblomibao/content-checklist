-- =====================================================================
-- 006: Client share links
--
-- Adds a token-based, view-only report link per client — no client-facing
-- login required. The token grants read access to ONE client's production
-- logs only, scoped through security-definer RPCs (never direct table
-- access), and can be revoked at any time.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
create table if not exists public.client_share_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_client_share_links_client on public.client_share_links (client_id);
create index if not exists idx_client_share_links_token on public.client_share_links (token);

-- ---------------------------------------------------------------------
-- 2. RLS — admins manage links directly; nobody else gets table access.
--    The public report is served exclusively through the RPCs below.
-- ---------------------------------------------------------------------
alter table public.client_share_links enable row level security;

drop policy if exists "share_links_admin_manage" on public.client_share_links;
create policy "share_links_admin_manage"
  on public.client_share_links for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Token validation + client info (safe to call with no session)
--    Returns zero rows for an invalid/revoked token — callers should
--    treat "no rows" as "this link doesn't work," without distinguishing
--    why, so a bad token can't be used to probe which links exist.
-- ---------------------------------------------------------------------
create or replace function public.get_client_report_info(p_token text)
returns table (client_id uuid, client_name text)
as $$
  select c.id, c.name
  from public.client_share_links l
  join public.clients c on c.id = l.client_id
  where l.token = p_token
    and l.revoked_at is null;
$$ language sql security definer stable set search_path = public;

revoke all on function public.get_client_report_info(text) from public;
grant execute on function public.get_client_report_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Report rows for a valid token, scoped to that client and a date
--    range. Deliberately leaves out `notes` (internal shorthand) and
--    assistant identity (`user_id` / profile) — the client sees what was
--    produced, not who on the team did it or internal comments.
-- ---------------------------------------------------------------------
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
  and pl.production_date between p_date_from and p_date_to
  order by pl.production_date;
$$ language sql security definer stable set search_path = public;

revoke all on function public.get_client_report_logs(text, date, date) from public;
grant execute on function public.get_client_report_logs(text, date, date) to anon, authenticated;
