-- VERSI BARU: menggantikan skema lama yang bergantung ke auth.users (Supabase
-- Auth). Sekarang login pakai tabel users sendiri, jadi aman dijalankan ulang
-- dari nol — device lama (kalau ada) akan ikut terhapus karena skema lama
-- tidak pernah benar-benar dipakai sampai login berhasil.
--
-- Jalankan SEKALI di Supabase Dashboard -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

drop table if exists public.devices cascade;
drop table if exists public.users cascade;

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table public.devices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
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

-- RLS diaktifkan tapi SENGAJA tanpa policy sama sekali. Satu-satunya akses
-- yang diizinkan adalah lewat service_role key di serverless function kita
-- (api/_lib.js), yang otomatis melewati RLS. Kalau suatu saat ada kode lain
-- yang coba akses langsung dari browser, database menolaknya duluan sebelum
-- sempat menyentuh baris mana pun. Otorisasi "user cuma lihat device sendiri"
-- sekarang ditegakkan di kode /api/devices.js (WHERE user_id = ...), bukan
-- lagi lewat auth.uid() seperti skema lama.
alter table public.users enable row level security;
alter table public.devices enable row level security;

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

create index if not exists devices_user_id_idx on public.devices(user_id);
create index if not exists users_username_idx on public.users(username);
