-- LandedMY schema — Sprint 0
-- Every rate table is effective-dated and never overwritten: a change is a new row.

create extension if not exists "pgcrypto";

create type rate_type as enum ('ad_valorem', 'per_litre', 'per_litre_pure_alcohol');
create type incoterm as enum ('EXW', 'FOB', 'CIF');
create type allocation_basis as enum ('volume', 'value', 'units');

-- ---------- Rate tables (public read, admin write) ----------

create table tariff_lines (
  id uuid primary key default gen_random_uuid(),
  hs_code text not null,
  description text not null,
  unit text not null default 'l',
  duty_type rate_type not null,
  duty_value numeric(12,4) not null,
  effective_from date not null,
  effective_to date,
  source_doc text not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index on tariff_lines (hs_code, effective_from desc);

create table excise_lines (
  id uuid primary key default gen_random_uuid(),
  hs_code text not null,
  description text not null,
  excise_type rate_type not null,
  excise_value numeric(12,4) not null,
  effective_from date not null,
  effective_to date,
  source_doc text not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index on excise_lines (hs_code, effective_from desc);

create table sst_rates (
  id uuid primary key default gen_random_uuid(),
  hs_code text not null,
  description text not null,
  rate_pct numeric(5,2) not null,
  effective_from date not null,
  effective_to date,
  source_doc text not null,
  source_url text not null,
  created_at timestamptz not null default now()
);
create index on sst_rates (hs_code, effective_from desc);

create table fta_rates (
  id uuid primary key default gen_random_uuid(),
  hs_code text not null,
  origin_iso char(2) not null,
  agreement text not null,
  duty_type rate_type not null,
  duty_value numeric(12,4) not null,
  effective_from date not null,
  effective_to date,
  source_doc text not null,
  source_url text not null,
  created_at timestamptz not null default now()
);
create index on fta_rates (hs_code, origin_iso, effective_from desc);

create table fx_customs (
  id uuid primary key default gen_random_uuid(),
  currency char(3) not null,
  rate_to_myr numeric(14,6) not null,
  week_start date not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (currency, week_start)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category text not null,
  volume_ml integer not null,
  abv numeric(5,2) not null,
  hs_code text not null,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on products using gin (to_tsvector('simple', name || ' ' || coalesce(brand, '')));

create table logistics_benchmarks (
  id uuid primary key default gen_random_uuid(),
  origin_port text not null,
  dest_port text not null,
  equipment text not null, -- LCL_pallet, 20DC, 40HC, 20RF
  freight_median numeric(12,2) not null,
  freight_currency char(3) not null,
  local_charges_json jsonb not null default '{}',
  sample_size integer not null default 1,
  as_of date not null,
  source text,
  created_at timestamptz not null default now()
);

-- ---------- User data (RLS) ----------

create table shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_token text,                        -- anonymous users keep a token in localStorage
  name text,
  shipment_date date not null,
  origin_iso char(2) not null,
  dest_port text not null,
  currency char(3) not null,
  fx_rate numeric(14,6) not null,
  incoterm incoterm not null,
  freight numeric(14,2) not null default 0,
  insurance_json jsonb not null default '{"pct_of_goods": 0.3}',
  local_charges_json jsonb not null default '{}',
  allocation allocation_basis not null default 'volume',
  result_json jsonb,                      -- full ShipmentResult at save time
  share_slug text unique,
  expires_at timestamptz,                 -- anonymous shipments: now() + 30 days
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on shipments (user_id, created_at desc);
create index on shipments (anon_token);

create table shipment_lines (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  product_id uuid references products(id),
  name text not null,
  hs_code text not null,
  volume_ml integer not null,
  abv numeric(5,2) not null,
  units_per_case integer not null,
  cases integer not null,
  cases_per_pallet integer,
  unit_cost numeric(14,4) not null,
  computed_json jsonb,
  position integer not null default 0
);
create index on shipment_lines (shipment_id, position);

-- ---------- RLS ----------

alter table tariff_lines enable row level security;
alter table excise_lines enable row level security;
alter table sst_rates enable row level security;
alter table fta_rates enable row level security;
alter table fx_customs enable row level security;
alter table products enable row level security;
alter table logistics_benchmarks enable row level security;
alter table shipments enable row level security;
alter table shipment_lines enable row level security;

-- Rate and reference tables: anyone can read, only service role writes.
create policy "public read tariff" on tariff_lines for select using (true);
create policy "public read excise" on excise_lines for select using (true);
create policy "public read sst" on sst_rates for select using (true);
create policy "public read fta" on fta_rates for select using (true);
create policy "public read fx" on fx_customs for select using (true);
create policy "public read products" on products for select using (true);
create policy "public read benchmarks" on logistics_benchmarks for select using (true);

-- Shipments: owner only. Anonymous shipments are accessed through an Edge Function
-- that checks anon_token, never directly from the client.
create policy "own shipments" on shipments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own shipment lines" on shipment_lines
  for all using (exists (select 1 from shipments s where s.id = shipment_id and s.user_id = auth.uid()))
  with check (exists (select 1 from shipments s where s.id = shipment_id and s.user_id = auth.uid()));

-- Shared links: public read of a shipment by slug (result_json only is exposed by the API layer).
create policy "shared shipment read" on shipments for select using (share_slug is not null);
