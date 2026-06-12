-- ============================================================
-- Smart Wires Event Connect — Supabase schema
-- Run this in the Supabase SQL editor (Project > SQL Editor)
-- ============================================================

-- ---------- PROFILES ----------
-- Mirrors auth.users with app-level fields (name, admin flag)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user can read the profile list (used for "logged by" display
-- and the admin user table)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update their own profile's full name (not is_admin)
create policy "profiles_update_own_name"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Automatically create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------- EVENTS ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events_all_authenticated"
  on public.events for all
  to authenticated
  using (true)
  with check (true);


-- ---------- INTERACTIONS ----------
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  job_title text,
  notes text,
  follow_up boolean not null default false,
  badge_photo_path text,
  audio_note_path text,
  interaction_date date default current_date,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interactions enable row level security;

-- All signed-in team members can view, add, edit, and delete interactions.
-- (Everyone shares the same workspace — adjust to `created_by = auth.uid()`
-- if you later want each person to only see their own records.)
create policy "interactions_all_authenticated"
  on public.interactions for all
  to authenticated
  using (true)
  with check (true);

create index if not exists interactions_event_id_idx on public.interactions(event_id);
create index if not exists interactions_created_by_idx on public.interactions(created_by);
create index if not exists interactions_exported_at_idx on public.interactions(exported_at);


-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Create two private buckets for badge photos and audio notes.
insert into storage.buckets (id, name, public)
values ('badge-photos', 'badge-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio-notes', 'audio-notes', false)
on conflict (id) do nothing;

-- Any signed-in team member can read/write/delete files in these buckets.
create policy "badge_photos_authenticated_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'badge-photos')
  with check (bucket_id = 'badge-photos');

create policy "audio_notes_authenticated_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'audio-notes')
  with check (bucket_id = 'audio-notes');


-- ============================================================
-- BOOTSTRAP: make yourself an admin
-- ============================================================
-- 1. Sign up the first user from the app's login screen using Supabase's
--    "invite" flow (see README), or create one in
--    Authentication > Users in the Supabase dashboard.
-- 2. Then run, substituting your email:
--
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'roberto@smartwires.com');
