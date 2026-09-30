-- =====================================================================
-- 008: Other-work daily logs
--
-- Lets an assistant log a day where they did work that wasn't
-- client-production (internal tasks, training, admin, etc.) so the day
-- still shows up on the heatmap and doesn't break their streak, without
-- forcing them to pick a client or invent a production count.
-- =====================================================================

alter table public.production_logs alter column client_id drop not null;
alter table public.production_logs add column if not exists is_other_work boolean not null default false;

-- Every row is either normal client production (has a client) or an
-- other-work entry (flagged, with no client) — never neither, never both.
alter table public.production_logs drop constraint if exists production_logs_client_or_other_work_check;
alter table public.production_logs add constraint production_logs_client_or_other_work_check
  check (
    (is_other_work = false and client_id is not null) or
    (is_other_work = true and client_id is null)
  );

-- An other-work entry has to say what the work was — reuses the existing
-- `notes` column rather than adding a second free-text field.
alter table public.production_logs drop constraint if exists production_logs_other_work_needs_notes_check;
alter table public.production_logs add constraint production_logs_other_work_needs_notes_check
  check (is_other_work = false or (notes is not null and length(trim(notes)) > 0));

create index if not exists idx_production_logs_other_work on public.production_logs (is_other_work);
