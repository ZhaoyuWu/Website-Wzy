## Role
generator3

## Task
task3 (showcase likes enhancement)

## Topic
Add public likes counter to `media_items` and an atomic increment RPC.

## DDL Source
- `handover/sql/generator3-task3-media-likes.sql`

## Execution Context
- Environment: Supabase SQL Editor (project `pltveorkgsxfccyuwidk`)
- Date: 2026-04-19
- Intent: back the showcase like button with a shared, persisted counter, incremented atomically to avoid races.

## Objects Changed
- `public.media_items`
  - Added column `likes_count integer not null default 0`.
- `public.increment_media_likes(p_id bigint) returns integer` (plpgsql)
  - Atomically `update public.media_items set likes_count = likes_count + 1 where id = p_id returning likes_count`.
- `public.decrement_media_likes(p_id bigint) returns integer` (plpgsql)
  - Atomically `update public.media_items set likes_count = greatest(likes_count - 1, 0) where id = p_id returning likes_count` (never goes below 0).

## DDL Statements
```sql
alter table public.media_items
  add column if not exists likes_count integer not null default 0;

create or replace function public.increment_media_likes(p_id bigint)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  update public.media_items
     set likes_count = likes_count + 1
   where id = p_id
   returning likes_count into new_count;

  return new_count;
end;
$$;

create or replace function public.decrement_media_likes(p_id bigint)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  update public.media_items
     set likes_count = greatest(likes_count - 1, 0)
   where id = p_id
   returning likes_count into new_count;

  return new_count;
end;
$$;
```

## Backend Integration
- `GET /api/showcase/media` select columns now include `likes_count` (backend/src/index.js:490).
- `POST /api/showcase/media/:id/like` (backend/src/index.js:558) calls `/rest/v1/rpc/increment_media_likes` via service-role key and returns `{ ok, id, likesCount }`.
- `DELETE /api/showcase/media/:id/like` (backend/src/index.js:586) calls `/rest/v1/rpc/decrement_media_likes` and returns the same envelope; used by the toggle-off path.
- Non-existent ids cause either RPC to return `null`; backend translates this into `404 Media not found.`.

## Verification Queries
```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'media_items'
  and column_name = 'likes_count';
```

```sql
select proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'increment_media_likes';
```

```sql
-- Smoke test with an existing media row id (replace :id).
select public.increment_media_likes(:id);
select id, likes_count from public.media_items where id = :id;
```

## Rollback Notes
- Column drop: `alter table public.media_items drop column if exists likes_count;` (destroys accumulated counts).
- Function drops:
  - `drop function if exists public.increment_media_likes(bigint);`
  - `drop function if exists public.decrement_media_likes(bigint);`
- Prefer appending a new trace file rather than rewriting this one if the schema changes again.

## Notes
- Frontend uses `localStorage` (`nanami.showcase.likes`) as soft client-side dedup; server currently has no per-user constraint, so duplicate increments from other devices are possible by design.
- If abuse emerges later, consider: (a) IP-based rate limit in backend, (b) anonymous session token cookie, or (c) require login to like.
