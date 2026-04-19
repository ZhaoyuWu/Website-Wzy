-- Role: generator3
-- Task: task3 follow-up (showcase anonymous comments)
-- Date: 2026-04-19
-- Purpose: Back the legacy /api/showcase/comments endpoints with a real table
--          so they stop 500-ing in fresh deployments. story-timeline comments
--          use the separate public.story_comments table.
-- Scope: public.showcase_comments

create table if not exists public.showcase_comments (
  id bigint generated always as identity primary key,
  author_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists showcase_comments_created_at_desc_idx
  on public.showcase_comments (created_at desc);

-- Notes:
-- - Backend POST /api/showcase/comments validates author_name and message
--   lengths before insert, so no DB-level CHECK constraints are added here.
-- - Rows are anonymous; no profiles FK. If later abuse occurs, add an
--   ip_hash column in a follow-up migration.
