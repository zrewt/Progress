-- ------------------------------------------------------------------
-- Vitality Tree — Supabase schema
-- Run this once in Supabase → SQL Editor. It is safe to run again.
-- ------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  identity text,
  goal text,
  time_budget text,
  level integer not null default 1,
  xp integer not null default 0,
  streak integer not null default 0,
  last_completed_date date,
  season_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrate a profile table created by the earlier fitness-only build.
alter table public.profiles add column if not exists identity text;
alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists season_started_at timestamptz not null default now();

create table if not exists public.nodes (
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  pillar text not null check (pillar in ('body', 'mind', 'craft', 'connection')),
  tier integer not null check (tier between 0 and 3),
  title text not null,
  duration text,
  description text,
  instructions jsonb not null default '[]'::jsonb,
  status text not null default 'locked' check (status in ('locked', 'active', 'completed')),
  completed_at timestamptz,
  primary key (user_id, node_id)
);

create index if not exists nodes_user_id_idx on public.nodes (user_id);

-- The tree moved from four fitness pillars to four life branches. Drop rows
-- from the old tree (a new 16-action season is generated on next launch) so
-- the new constraint can be applied. Profile XP and streak are preserved.
alter table public.nodes drop constraint if exists nodes_pillar_check;
delete from public.nodes
where pillar not in ('body', 'mind', 'craft', 'connection');
alter table public.nodes
  add constraint nodes_pillar_check
  check (pillar in ('body', 'mind', 'craft', 'connection'));

-- Keep updated_at fresh on profile updates.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security: each user can only touch their own rows.
-- ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.nodes enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "nodes_owner_all" on public.nodes;
create policy "nodes_owner_all"
on public.nodes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Make the new columns visible to PostgREST immediately.
notify pgrst, 'reload schema';
