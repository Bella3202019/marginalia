-- Marginalia · 批注 — database setup.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.

-- Words you tapped while reading (one row per user per word)
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  zh text not null default '',
  src text not null default '',
  when_label text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Enlightening sentences (Moments · 悟)
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quote text not null,
  book text not null default '',
  ch text not null default '',
  when_label text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, quote)
);

-- One row per API request, for the per-user daily cap.
-- No RLS policies on purpose: only the server (service role) touches it.
create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists usage_log_user_day on public.usage_log (user_id, created_at);

-- Row-level security: each person sees only their own rows.
alter table public.words enable row level security;
alter table public.moments enable row level security;
alter table public.usage_log enable row level security;

create policy "own words select" on public.words for select using (auth.uid() = user_id);
create policy "own words insert" on public.words for insert with check (auth.uid() = user_id);
create policy "own words update" on public.words for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own words delete" on public.words for delete using (auth.uid() = user_id);

create policy "own moments select" on public.moments for select using (auth.uid() = user_id);
create policy "own moments insert" on public.moments for insert with check (auth.uid() = user_id);
create policy "own moments update" on public.moments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own moments delete" on public.moments for delete using (auth.uid() = user_id);
