-- Role: generator4
-- Task: task4 (T-004 Media Management — user-authored display date + unified timeline ordering)
-- Date: 2026-04-19
-- Purpose: Let Admin/Publisher tag each media item and story text post with a
--          user-authored "display date" (day precision). The public timeline
--          and the management list order entries by this date so the feed
--          reflects when the moment happened rather than when it was uploaded.
-- Scope: public.media_items, public.story_posts
-- Note:   Run generator4-task4-media-updated-at.sql first if it has not been
--         applied. This file assumes `media_items.updated_at` already exists.

-- -----------------------------------------------------------------------------
-- media_items.display_date
-- -----------------------------------------------------------------------------

-- 1. Nullable add so the ALTER does not block on large tables.
alter table public.media_items
  add column if not exists display_date date;

-- 2. Seed existing rows from created_at so the timeline does not reorder.
update public.media_items
  set display_date = created_at::date
  where display_date is null;

-- 3. Enforce non-null and a safe default for new inserts that forget it.
alter table public.media_items
  alter column display_date set default current_date,
  alter column display_date set not null;

create index if not exists media_items_display_date_desc_idx
  on public.media_items (display_date desc, created_at desc);

-- -----------------------------------------------------------------------------
-- story_posts.display_date  (generator3's table, shared ownership for timeline)
-- -----------------------------------------------------------------------------

alter table public.story_posts
  add column if not exists display_date date;

update public.story_posts
  set display_date = created_at::date
  where display_date is null;

alter table public.story_posts
  alter column display_date set default current_date,
  alter column display_date set not null;

create index if not exists story_posts_display_date_desc_idx
  on public.story_posts (display_date desc, created_at desc);

-- Notes:
-- - Backend validates `YYYY-MM-DD` from the API and forwards it to Supabase.
-- - Timeline sorts by display_date DESC tiebroken by created_at DESC.
-- - The unified management list on /manage-media shows `Date: <display_date>`
--   and `Updated: <updated_at>` only (upload/published time is hidden).
