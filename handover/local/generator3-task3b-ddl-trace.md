## Role
generator3

## Task
task3b (story timeline: text posts + forward-compatible comments)

## Topic
Add `story_posts` for pure-text timeline entries plus a comments table laid down now for future use.

## DDL Source
- `handover/sql/generator3-task3b-story-timeline.sql`

## Execution Context
- Environment: Supabase SQL Editor (project `pltveorkgsxfccyuwidk`)
- Date: 2026-04-19
- Intent: remove the showcase page, move timeline into home, and let admins/publishers publish pure-text stories alongside media.

## Objects Created
- `public.story_posts` — timeline text entries authored by admins/publishers.
- `public.story_posts_created_at_desc_idx` — index for newest-first pagination.
- `public.increment_story_post_likes(bigint)` — atomic like increment.
- `public.decrement_story_post_likes(bigint)` — atomic like decrement with `greatest(..., 0)` floor.
- `public.story_comments` — polymorphic comments table (`entry_type` in `media|text`, `entry_id` references either `media_items.id` or `story_posts.id`). No backend/UI consumer yet; laid down so adding comments later is additive.
- `public.story_comments_entry_idx` — composite index for comment lookup per entry.

## Schema Summary
```
story_posts(id pk, title text, body text, author_id uuid -> profiles(id), likes_count int,
            created_at timestamptz, updated_at timestamptz)

story_comments(id pk, entry_type text check in ('media','text'), entry_id bigint,
               author_name text, author_email text, body text, created_at timestamptz)
```

## Verification Queries
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('story_posts', 'story_comments');

select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('increment_story_post_likes', 'decrement_story_post_likes');
```

```sql
-- Insert a seed text post (after Supabase returns a profile row for admin).
insert into public.story_posts (title, body, author_id)
select 'First Text Entry', 'Nanami looked outside and waited for the morning sun.', id
from public.profiles
where role = 'Admin'
limit 1;

select id, title, likes_count, created_at from public.story_posts order by created_at desc;
```

## Rollback Notes
- `drop function if exists public.increment_story_post_likes(bigint);`
- `drop function if exists public.decrement_story_post_likes(bigint);`
- `drop table if exists public.story_comments;`
- `drop table if exists public.story_posts;`

## Notes on Comments (Deferred)
- Polymorphic FK is intentional: keeps writes simple and avoids an extra "entries" registry.
- DB-level referential integrity is not enforced across `entry_id` to either parent; backend will validate `(entry_type, entry_id)` pairs when we later expose a comments API.
- If abuse becomes a real concern, add rate-limit + moderation fields (`is_hidden`, `ip_hash`) in a follow-up migration rather than changing this one.
