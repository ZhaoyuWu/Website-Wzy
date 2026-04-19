-- Role: generator4
-- Task: task4 (T-004 Media Management — edit + update time display)
-- Date: 2026-04-19
-- Purpose: Add updated_at tracking to public.media_items so that the
--          media management page can display the last-edited time.
-- Scope: public.media_items

-- 1. Add column nullable first so the ALTER never blocks on existing rows.
alter table public.media_items
  add column if not exists updated_at timestamptz;

-- 2. Seed existing rows so they do not show a NULL update time.
--    Treat prior uploads as "never edited" by mirroring created_at.
update public.media_items
  set updated_at = created_at
  where updated_at is null;

-- 3. Enforce the final contract: non-null with now() default for new inserts.
alter table public.media_items
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Notes:
-- - Backend explicitly sets updated_at on PATCH /api/admin/media/:id so the
--   value changes on every metadata edit regardless of DB triggers.
-- - The frontend treats updated_at == created_at as "never edited" and hides
--   the "Updated: ..." line until the row has actually been modified.
