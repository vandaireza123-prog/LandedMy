-- LandedMY — accounts, saved shipments, rate-change alerts

-- Profile row per auth user (company name + logo for branded quotes)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  company_name text,
  logo_url text,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Saved shipments: the whole app state snapshot + the computed result at save time
alter table shipments add column if not exists snapshot_json jsonb;
alter table shipments add column if not exists alert_on_rate_change boolean not null default false;
alter table shipments add column if not exists landed_total numeric(14,2);
alter table shipments add column if not exists rate_version text;

-- A version stamp for the rate tables. Bump when rates change (admin or deploy script).
create table if not exists rate_versions (
  id bigserial primary key,
  version text not null unique,
  note text,
  created_at timestamptz not null default now()
);
alter table rate_versions enable row level security;
create policy "public read rate versions" on rate_versions for select using (true);
insert into rate_versions (version, note) values ('2025-11-01-budget2026', 'Excise +10% from 1 Nov 2025') on conflict do nothing;

-- Notifications shown in-app (and emailed when Resend is configured)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shipment_id uuid references shipments(id) on delete cascade,
  kind text not null,              -- 'rate_change'
  title text not null,
  body text not null,
  old_total numeric(14,2),
  new_total numeric(14,2),
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "own notifications" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role (scheduled function) needs to read all alert-enabled shipments; RLS does not apply to service role.
