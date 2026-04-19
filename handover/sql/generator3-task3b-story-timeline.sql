-- Role: generator3
-- Task: task3b (story timeline: text posts + future comments)
-- Date: 2026-04-19
-- Purpose: Add story_posts (text entries on the timeline) with like RPCs,
--          and a forward-compatible story_comments table that can attach to
--          either media_items or story_posts. Comments table is built now but
--          no API/UI consumes it yet.
-- Scope: public.story_posts, public.story_comments,
--        public.increment_story_post_likes(bigint),
--        public.decrement_story_post_likes(bigint).

create table if not exists public.story_posts (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  author_id uuid references public.profiles(id) on delete set null,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_posts_created_at_desc_idx
  on public.story_posts (created_at desc);

create or replace function public.increment_story_post_likes(p_id bigint)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  update public.story_posts
     set likes_count = likes_count + 1
   where id = p_id
   returning likes_count into new_count;

  return new_count;
end;
$$;

create or replace function public.decrement_story_post_likes(p_id bigint)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  update public.story_posts
     set likes_count = greatest(likes_count - 1, 0)
   where id = p_id
   returning likes_count into new_count;

  return new_count;
end;
$$;

-- Forward-compatible comments. No backend/UI consumer yet.
-- entry_type selects which parent table entry_id points at.
create table if not exists public.story_comments (
  id bigint generated always as identity primary key,
  entry_type text not null check (entry_type in ('media', 'text')),
  entry_id bigint not null,
  author_name text not null,
  author_email text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists story_comments_entry_idx
  on public.story_comments (entry_type, entry_id, created_at desc);
