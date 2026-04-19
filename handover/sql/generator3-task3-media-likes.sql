-- Role: generator3
-- Task: task3 enhancement (showcase likes)
-- Date: 2026-04-19
-- Purpose: Add public likes counter to media_items plus atomic increment/decrement RPCs.
-- Scope: media_items.likes_count, public.increment_media_likes(bigint), public.decrement_media_likes(bigint).

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
