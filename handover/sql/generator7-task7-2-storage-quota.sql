-- Role: generator7
-- Task: T-007-2 Storage quota visibility
-- Date: 2026-04-19
-- Purpose: Track byte size of each uploaded media file so the backend can
--          compute total storage usage and warn before hitting the Supabase
--          Free tier 1 GB ceiling.
-- Scope: public.media_items.file_size

-- Nullable add keeps the ALTER non-blocking and lets historical rows skip
-- the quota calculation (their real on-disk size is unknown at migration
-- time). New uploads persist the declared file size via the backend.
alter table public.media_items
  add column if not exists file_size bigint;

-- Notes:
-- - Backend POST /api/admin/media stamps file_size = declaredFileSize.
-- - GET /api/admin/storage/usage aggregates coalesce(sum(file_size), 0).
-- - Soft limit (STORAGE_SOFT_LIMIT_BYTES, default 800 MB) triggers a UI
--   warning; hard limit (STORAGE_HARD_LIMIT_BYTES, default 1024 MB) mirrors
--   the Supabase Free quota for context only — backend does not block
--   uploads, Supabase itself enforces the real ceiling.
