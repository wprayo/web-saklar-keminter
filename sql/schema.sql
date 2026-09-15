-- Jalankan seluruh file ini SEKALI di Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Aman dijalankan ulang (pakai "if not exists" / "or replace") kalau perlu diulang.

create extension if not exists pgcrypto;

create table if not exists public.devices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,
  device_code      text not null,
  secret_token     text not null,
  use_default      boolean not null default true,
  host             text not null default '',
  protocol         text not null default 'wss',
  port             integer not null default 8084,
  path             text not null default '/mqtt',
  use_auth         boolean not null default false,
  broker_user      text not null default '',
  broker_pass      text not null default '',
  active_switches  integer not null default 4,
  switch_names     jsonb not null default '["Saklar 1","Saklar 2","Saklar 3","Saklar 4"]',
  switch_states    jsonb not null default '{"s1":false,"s2":false,"s3":false,"s4":false}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Row Level Security: setiap user cuma bisa melihat & mengubah device miliknya sendiri.
alter table public.devices enable row level security;

drop policy if exists "devices_select_own" on public.devices;
create policy "devices_select_own" on public.devices
  for select using (auth.uid() = user_id);

drop policy if exists "devices_insert_own" on public.devices;
create policy "devices_insert_own" on public.devices
  for insert with check (auth.uid() = user_id);

drop policy if exists "devices_update_own" on public.devices;
create policy "devices_update_own" on public.devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "devices_delete_own" on public.devices;
create policy "devices_delete_own" on public.devices
  for delete using (auth.uid() = user_id);

-- Otomatis perbarui updated_at setiap kali baris diubah.
create or replace function public.devices_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists devices_touch_updated_at on public.devices;
create trigger devices_touch_updated_at
  before update on public.devices
  for each row execute function public.devices_set_updated_at();

-- Index untuk mempercepat query "punya device siapa saja".
create index if not exists devices_user_id_idx on public.devices(user_id);
