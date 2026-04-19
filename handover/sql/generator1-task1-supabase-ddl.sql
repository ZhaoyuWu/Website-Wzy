-- Role: generator1
-- Task: task1
-- Date: 2026-04-18
-- Purpose: Initialize minimum public schema for Nanami project on Supabase.
-- Scope: profiles, media_items, site_settings.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  role text not null default 'Viewer' check (role in ('Admin', 'Publisher', 'Viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_items (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  media_type text not null check (media_type in ('image', 'video')),
  public_url text not null,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  setting_key text primary key,
  profile_name text not null default 'Nanami',
  hero_tagline text not null default 'Nanami, the sunshine of every walk.',
  about_text text not null default 'This page shares Nanami''s personality and daily life.',
  contact_email text not null default '',
  show_contact_email boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (setting_key)
values ('site')
on conflict (setting_key) do nothing;

-- Example: promote one existing auth user to Admin.
-- Replace with real user email before execution.
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"Admin"}'::jsonb
-- where email = 'your-admin@example.com';

-- Optional profile sync for the same user.
-- insert into public.profiles (id, email, username, role)
-- select id, email, split_part(email, '@', 1), 'Admin'
-- from auth.users
-- where email = 'your-admin@example.com'
-- on conflict (id) do update set role = excluded.role, email = excluded.email;
