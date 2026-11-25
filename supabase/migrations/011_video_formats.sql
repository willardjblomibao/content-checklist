-- =====================================================================
-- 011: Short-form vs long-form videos
--
-- Splits the two video counts into short-form and long-form parts.
--
--   videos_edited_count / videos_reedited_count stay the TOTAL, so every
--   existing report, export, streak and client-report function keeps
--   working unchanged. The new columns say how that total divides up:
--
--     videos_edited_short_count + videos_edited_long_count <= videos_edited_count
--
--   The app saves total = short + long for new logs. Logs saved before this
--   migration have short = long = 0, so their videos show as "not specified"
--   until someone edits them and assigns a format.
--
-- Safe to run more than once.
-- =====================================================================

alter table public.production_logs
  add column if not exists videos_edited_short_count integer not null default 0,
  add column if not exists videos_edited_long_count integer not null default 0,
  add column if not exists videos_reedited_short_count integer not null default 0,
  add column if not exists videos_reedited_long_count integer not null default 0;

alter table public.production_logs drop constraint if exists production_logs_video_format_counts_check;
alter table public.production_logs add constraint production_logs_video_format_counts_check
  check (
    videos_edited_short_count >= 0
    and videos_edited_long_count >= 0
    and videos_reedited_short_count >= 0
    and videos_reedited_long_count >= 0
    and videos_edited_short_count + videos_edited_long_count <= videos_edited_count
    and videos_reedited_short_count + videos_reedited_long_count <= videos_reedited_count
  );
