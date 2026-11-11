-- LandedMY one-shot database setup. Paste into Supabase SQL Editor and Run. Safe to re-run.

-- LandedMY schema — Sprint 0
-- Every rate table is effective-dated and never overwritten: a change is a new row.

create extension if not exists "pgcrypto";

do $$ begin create type rate_type as enum ('ad_valorem', 'per_litre', 'per_litre_pure_alcohol'); exception when duplicate_object then null; end $$;
do $$ begin create type incoterm as enum ('EXW', 'FOB', 'CIF'); exception when duplicate_object then null; end $$;
do $$ begin create type allocation_basis as enum ('volume', 'value', 'units'); exception when duplicate_object then null; end $$;

-- ---------- Rate tables (public read, admin write) ----------

create table if not exists tariff_lines (
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
create index if not exists tariff_lines_idx1 on tariff_lines (hs_code, effective_from desc);

create table if not exists excise_lines (
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
create index if not exists excise_lines_idx2 on excise_lines (hs_code, effective_from desc);

create table if not exists sst_rates (
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
create index if not exists sst_rates_idx3 on sst_rates (hs_code, effective_from desc);

create table if not exists fta_rates (
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
create index if not exists fta_rates_idx4 on fta_rates (hs_code, origin_iso, effective_from desc);

create table if not exists fx_customs (
  id uuid primary key default gen_random_uuid(),
  currency char(3) not null,
  rate_to_myr numeric(14,6) not null,
  week_start date not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (currency, week_start)
);

create table if not exists products (
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
create index if not exists products_gin_idx on products using gin (to_tsvector('simple', name || ' ' || coalesce(brand, '')));

create table if not exists logistics_benchmarks (
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

create table if not exists shipments (
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
create index if not exists shipments_idx5 on shipments (user_id, created_at desc);
create index if not exists shipments_idx6 on shipments (anon_token);

create table if not exists shipment_lines (
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
create index if not exists shipment_lines_idx7 on shipment_lines (shipment_id, position);

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
drop policy if exists "public read tariff" on tariff_lines;
create policy "public read tariff" on tariff_lines for select using (true);
drop policy if exists "public read excise" on excise_lines;
create policy "public read excise" on excise_lines for select using (true);
drop policy if exists "public read sst" on sst_rates;
create policy "public read sst" on sst_rates for select using (true);
drop policy if exists "public read fta" on fta_rates;
create policy "public read fta" on fta_rates for select using (true);
drop policy if exists "public read fx" on fx_customs;
create policy "public read fx" on fx_customs for select using (true);
drop policy if exists "public read products" on products;
create policy "public read products" on products for select using (true);
drop policy if exists "public read benchmarks" on logistics_benchmarks;
create policy "public read benchmarks" on logistics_benchmarks for select using (true);

-- Shipments: owner only. Anonymous shipments are accessed through an Edge Function
-- that checks anon_token, never directly from the client.
drop policy if exists "own shipments" on shipments;
create policy "own shipments" on shipments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own shipment lines" on shipment_lines;
create policy "own shipment lines" on shipment_lines
  for all using (exists (select 1 from shipments s where s.id = shipment_id and s.user_id = auth.uid()))
  with check (exists (select 1 from shipments s where s.id = shipment_id and s.user_id = auth.uid()));

-- Shared links: public read of a shipment by slug (result_json only is exposed by the API layer).
drop policy if exists "shared shipment read" on shipments;
create policy "shared shipment read" on shipments for select using (share_slug is not null);

-- Generated by scripts/gen-seed-sql.mjs — do not edit by hand. Source: packages/engine/data/chapter22.json
begin;
delete from sst_rates; delete from excise_lines; delete from tariff_lines;
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.11', 'Stout and porter, not exceeding 5.8% vol', 'l', 'per_litre', 5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.11', 'Stout and porter, not exceeding 5.8% vol', 'per_litre_pure_alcohol', 175, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.11', 'Stout and porter, not exceeding 5.8% vol', 'per_litre_pure_alcohol', 192.5, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2203.00.11', 'Stout and porter, not exceeding 5.8% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.19', 'Stout and porter, other', 'l', 'per_litre', 5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.19', 'Stout and porter, other', 'per_litre_pure_alcohol', 175, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.19', 'Stout and porter, other', 'per_litre_pure_alcohol', 192.5, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2203.00.19', 'Stout and porter, other', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.91', 'Beer (incl. ale), not exceeding 5.8% vol', 'l', 'per_litre', 5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.91', 'Beer (incl. ale), not exceeding 5.8% vol', 'per_litre_pure_alcohol', 175, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.91', 'Beer (incl. ale), not exceeding 5.8% vol', 'per_litre_pure_alcohol', 192.5, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2203.00.91', 'Beer (incl. ale), not exceeding 5.8% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.99', 'Beer (incl. ale), other', 'l', 'per_litre', 5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.99', 'Beer (incl. ale), other', 'per_litre_pure_alcohol', 175, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2203.00.99', 'Beer (incl. ale), other', 'per_litre_pure_alcohol', 192.5, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2203.00.99', 'Beer (incl. ale), other', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.10.00', 'Sparkling wine', 'l', 'per_litre', 23, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.10.00', 'Sparkling wine', 'per_litre_pure_alcohol', 450, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.10.00', 'Sparkling wine', 'per_litre_pure_alcohol', 495, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.10.00', 'Sparkling wine', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.11', 'Still wine in containers ≤2L, not exceeding 15% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.11', 'Still wine in containers ≤2L, not exceeding 15% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.11', 'Still wine in containers ≤2L, not exceeding 15% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.21.11', 'Still wine in containers ≤2L, not exceeding 15% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.13', 'Still wine in containers ≤2L, >15% to 23% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.13', 'Still wine in containers ≤2L, >15% to 23% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.13', 'Still wine in containers ≤2L, >15% to 23% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.21.13', 'Still wine in containers ≤2L, >15% to 23% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.14', 'Still wine in containers ≤2L, exceeding 23% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.14', 'Still wine in containers ≤2L, exceeding 23% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.21.14', 'Still wine in containers ≤2L, exceeding 23% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.21.14', 'Still wine in containers ≤2L, exceeding 23% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.22.11', 'Still wine in containers >2L to 10L, not exceeding 15% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.22.11', 'Still wine in containers >2L to 10L, not exceeding 15% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.22.11', 'Still wine in containers >2L to 10L, not exceeding 15% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.22.11', 'Still wine in containers >2L to 10L, not exceeding 15% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.22.12', 'Still wine in containers >2L to 10L, >15% to 23% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.22.12', 'Still wine in containers >2L to 10L, >15% to 23% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.22.12', 'Still wine in containers >2L to 10L, >15% to 23% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.22.12', 'Still wine in containers >2L to 10L, >15% to 23% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.29.11', 'Wine, other containers, not exceeding 15% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.29.11', 'Wine, other containers, not exceeding 15% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.29.11', 'Wine, other containers, not exceeding 15% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.29.11', 'Wine, other containers, not exceeding 15% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2204.29.12', 'Wine, other containers, exceeding 15% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.29.12', 'Wine, other containers, exceeding 15% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2204.29.12', 'Wine, other containers, exceeding 15% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2204.29.12', 'Wine, other containers, exceeding 15% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2205.10.10', 'Vermouth in containers ≤2L, not exceeding 15% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2205.10.10', 'Vermouth in containers ≤2L, not exceeding 15% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2205.10.10', 'Vermouth in containers ≤2L, not exceeding 15% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2205.10.10', 'Vermouth in containers ≤2L, not exceeding 15% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2205.10.20', 'Vermouth in containers ≤2L, exceeding 15% vol', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2205.10.20', 'Vermouth in containers ≤2L, exceeding 15% vol', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2205.10.20', 'Vermouth in containers ≤2L, exceeding 15% vol', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2205.10.20', 'Vermouth in containers ≤2L, exceeding 15% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.10', 'Cider and perry', 'l', 'per_litre', 7, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.10', 'Cider and perry', 'per_litre_pure_alcohol', 60, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.10', 'Cider and perry', 'per_litre_pure_alcohol', 66, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2206.00.10', 'Cider and perry', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.20', 'Saké', 'l', 'per_litre_pure_alcohol', 25.5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.20', 'Saké', 'per_litre_pure_alcohol', 60, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.20', 'Saké', 'per_litre_pure_alcohol', 66, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2206.00.20', 'Saké', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.50', 'Mead', 'l', 'per_litre', 23, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.50', 'Mead', 'per_litre_pure_alcohol', 40, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.50', 'Mead', 'per_litre_pure_alcohol', 44, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2206.00.50', 'Mead', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.60', 'Fruit wine (non-grape)', 'l', 'per_litre_pure_alcohol', 108.5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.60', 'Fruit wine (non-grape)', 'per_litre_pure_alcohol', 60, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2206.00.60', 'Fruit wine (non-grape)', 'per_litre_pure_alcohol', 66, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2206.00.60', 'Fruit wine (non-grape)', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.20.50', 'Brandy', 'l', 'per_litre', 58, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.20.50', 'Brandy', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.20.50', 'Brandy', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.20.50', 'Brandy', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.20.90', 'Other grape spirits', 'l', 'per_litre', 58, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.20.90', 'Other grape spirits', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.20.90', 'Other grape spirits', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.20.90', 'Other grape spirits', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.30.10', 'Whisky in containers >5L', 'l', 'per_litre', 58, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.30.10', 'Whisky in containers >5L', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.30.10', 'Whisky in containers >5L', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.30.10', 'Whisky in containers >5L', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.30.90', 'Whisky, other', 'l', 'per_litre', 58, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.30.90', 'Whisky, other', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.30.90', 'Whisky, other', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.30.90', 'Whisky, other', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.40.00', 'Rum and sugar-cane spirits', 'l', 'per_litre', 55, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.40.00', 'Rum and sugar-cane spirits', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.40.00', 'Rum and sugar-cane spirits', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.40.00', 'Rum and sugar-cane spirits', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.50.00', 'Gin and Geneva', 'l', 'per_litre', 55, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.50.00', 'Gin and Geneva', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.50.00', 'Gin and Geneva', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.50.00', 'Gin and Geneva', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.60.00', 'Vodka', 'l', 'per_litre', 55, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.60.00', 'Vodka', 'per_litre_pure_alcohol', 150, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.60.00', 'Vodka', 'per_litre_pure_alcohol', 165, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.60.00', 'Vodka', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.70.10', 'Liqueurs and cordials, not exceeding 57% vol', 'l', 'per_litre_pure_alcohol', 93.5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.70.10', 'Liqueurs and cordials, not exceeding 57% vol', 'per_litre_pure_alcohol', 60, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.70.10', 'Liqueurs and cordials, not exceeding 57% vol', 'per_litre_pure_alcohol', 66, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.70.10', 'Liqueurs and cordials, not exceeding 57% vol', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.70.90', 'Liqueurs and cordials, other', 'l', 'per_litre_pure_alcohol', 64.5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.70.90', 'Liqueurs and cordials, other', 'per_litre_pure_alcohol', 60, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.70.90', 'Liqueurs and cordials, other', 'per_litre_pure_alcohol', 66, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.70.90', 'Liqueurs and cordials, other', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
insert into tariff_lines (hs_code, description, unit, duty_type, duty_value, effective_from, effective_to, source_doc, source_url) values ('2208.90.99', 'Other spirituous beverages', 'l', 'per_litre_pure_alcohol', 64.5, '2022-06-01', null, 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/1729676/P.U.%20(A)%20114_2022%20(DUTI%20KASTAM).pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.90.99', 'Other spirituous beverages', 'per_litre_pure_alcohol', 60, '2022-06-01', '2025-10-31', 'Excise Duties Order 2022, P.U.(A) 163/2022', 'https://afcwp.asean.org/wp-content/uploads/2023/08/Malaysia_Excise-Duties-Order-2022.pdf');
insert into excise_lines (hs_code, description, excise_type, excise_value, effective_from, effective_to, source_doc, source_url) values ('2208.90.99', 'Other spirituous beverages', 'per_litre_pure_alcohol', 66, '2025-11-01', null, 'Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)', 'https://www.thestar.com.my/news/nation/2025/10/11/budget-2026-alcohol-excise-duty-hike-will-fuel-illicit-beer-growth-says-brewers');
insert into sst_rates (hs_code, description, rate_pct, effective_from, effective_to, source_doc, source_url) values ('2208.90.99', 'Other spirituous beverages', 10, '2018-09-01', null, 'Sales Tax Act 2018 — 10% standard rate on imports', 'https://www.dhl.com/discover/en-my/logistics-advice/essential-guides/import-sales-tax-malaysia.html');
commit;

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
drop policy if exists "own profile" on profiles;
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
drop policy if exists "public read rate versions" on rate_versions;
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
drop policy if exists "own notifications" on notifications;
create policy "own notifications" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role (scheduled function) needs to read all alert-enabled shipments; RLS does not apply to service role.
-- API keys for /api/calc. The raw key is shown once to the user; only its SHA-256 hash is stored.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'default',
  key_prefix text not null,            -- first 8 chars, for display
  key_hash text not null unique,       -- sha256 hex of the full key
  calls_total bigint not null default 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_user_idx on api_keys (user_id, created_at desc);
alter table api_keys enable row level security;
drop policy if exists "own api keys" on api_keys;
create policy "own api keys" on api_keys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Called by the calc function with the service role: validates a key and counts the call.
create or replace function public.touch_api_key(p_hash text)
returns table (user_id uuid, key_id uuid) language plpgsql security definer as $$
begin
  return query
  update api_keys set calls_total = calls_total + 1, last_used_at = now()
  where key_hash = p_hash and revoked_at is null
  returning api_keys.user_id, api_keys.id;
end $$;
-- World tariff backbone: one row per (destination, HS code, origin group, measure), effective-dated and sourced.
-- Fed by scripts/load-*.mjs from WTO Tariff Download Facility, World Bank WITS/TRAINS and national schedules.

create table if not exists hs_codes (
  code text primary key,               -- 6 digits (universal) or national 8–10 digits with country prefix handled by national_lines
  edition text not null default 'HS2022',
  description text not null,
  parent text,
  level smallint not null,             -- 2 chapter, 4 heading, 6 subheading
  section text,
  added_at timestamptz not null default now(),
  retired_at timestamptz
);

create table if not exists rate_sources (
  id text primary key,                 -- 'wto-tdf', 'wits-trains', 'eu-taric', 'us-hts', 'my-customs-order-2022', ...
  name text not null,
  url text not null,
  licence text,
  tier text not null check (tier in ('verified','official','indicative')),
  last_loaded_at timestamptz,
  note text
);

create table if not exists duty_rates (
  id bigserial primary key,
  dest_iso2 text not null,             -- destination country
  hs_code text not null,               -- 6-digit universal, or national line (digits only)
  hs_level smallint not null,          -- 6, 8, 10
  origin text not null default 'MFN',  -- 'MFN' | ISO2 | agreement code (ATIGA, RCEP, CPTPP, EU, USMCA...)
  measure text not null default 'duty',-- 'duty' | 'excise' | 'vat' | 'additional' | 'fee'
  rate_type text not null check (rate_type in ('ad_valorem','per_unit','per_litre','per_litre_pure_alcohol','per_kg','compound','unknown')),
  value numeric,                       -- percent for ad_valorem, amount for specific
  unit text,                           -- 'l', 'kg', 'u', ...
  currency text,                       -- for specific rates
  compound_text text,                  -- raw text when the rate can't be reduced to one number ("10% + €2/kg")
  effective_from date not null,
  effective_to date,
  year smallint,                       -- schedule year, for bulk MFN data
  source_id text not null references rate_sources(id),
  source_ref text,                     -- line/page/url fragment
  tier text not null check (tier in ('verified','official','indicative')),
  verified_by text,                    -- declaration reference when tier = verified
  loaded_at timestamptz not null default now()
);
create index if not exists duty_rates_lookup_idx on duty_rates (dest_iso2, hs_code, origin, measure, effective_from desc);
create index if not exists duty_rates_hs6_idx on duty_rates (dest_iso2, left(hs_code, 6));

-- Public read (rates are public information); writes only via service role.
alter table hs_codes enable row level security;
alter table rate_sources enable row level security;
alter table duty_rates enable row level security;
drop policy if exists "public read hs" on hs_codes;
create policy "public read hs" on hs_codes for select using (true);
drop policy if exists "public read sources" on rate_sources;
create policy "public read sources" on rate_sources for select using (true);
drop policy if exists "public read rates" on duty_rates;
create policy "public read rates" on duty_rates for select using (true);

-- Best rate for a destination + HS-6 + origin on a date: national line beats HS-6, named origin beats MFN.
create or replace function public.best_duty(p_dest text, p_hs6 text, p_origin text, p_date date default current_date)
returns table (hs_code text, hs_level smallint, origin text, rate_type text, value numeric, unit text, currency text, compound_text text, source_id text, tier text, year smallint, effective_from date)
language sql stable as $$
  select hs_code, hs_level, origin, rate_type, value, unit, currency, compound_text, source_id, tier, year, effective_from
  from duty_rates
  where dest_iso2 = p_dest and measure = 'duty'
    and left(hs_code, 6) = p_hs6
    and (origin = 'MFN' or origin = p_origin)
    and effective_from <= p_date and (effective_to is null or effective_to >= p_date)
  order by (origin = p_origin) desc, hs_level desc, (tier = 'verified') desc, (tier = 'official') desc, effective_from desc
  limit 1
$$;

-- Declarations users send us: the verification loop. Private to the uploader; reviewed rows become verified rates.
create table if not exists declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  dest_iso2 text not null,
  origin_iso2 text,
  declared_on date,
  file_url text,
  lines_json jsonb,                    -- [{hs_code, description, cif, duty, excise, tax}] as read by the extractor
  status text not null default 'received' check (status in ('received','reviewed','rejected')),
  note text,
  created_at timestamptz not null default now()
);
alter table declarations enable row level security;
drop policy if exists "own declarations" on declarations;
create policy "own declarations" on declarations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into rate_sources (id, name, url, licence, tier, note) values
  ('my-customs-order-2022', 'Customs Duties Order 2022, P.U.(A) 114/2022', 'https://ezhs.customs.gov.my/', 'Government of Malaysia', 'verified', 'Chapter 22 verified on K1 declarations'),
  ('my-excise-order-2025', 'Excise Duties Order 2025, P.U.(A) 389/2025', 'https://www.customs.gov.my/images/06-prosedur/eksais/perintah/PUA389_2025.pdf', 'Government of Malaysia', 'verified', null),
  ('sg-dutiable-goods', 'Singapore Customs — List of Dutiable Goods', 'https://www.customs.gov.sg/businesses/valuation-duties-taxes-fees/duties-and-dutiable-goods/list-of-dutiable-goods', 'Singapore Government', 'official', null),
  ('wto-tdf', 'WTO Tariff Download Facility (MFN applied, HS-6)', 'https://tariffdata.wto.org/', 'WTO — free, attribution', 'indicative', 'All WTO members, yearly'),
  ('wits-trains', 'World Bank WITS / UNCTAD TRAINS (MFN + preferential, HS-6)', 'https://wits.worldbank.org/', 'World Bank — free, attribution', 'indicative', 'Preferential rates by partner'),
  ('eu-taric', 'EU TARIC', 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp', 'EU open data', 'official', '10-digit, daily'),
  ('uk-trade-tariff', 'UK Trade Tariff API', 'https://www.trade-tariff.service.gov.uk/', 'OGL v3', 'official', '10-digit'),
  ('us-hts', 'US Harmonized Tariff Schedule', 'https://hts.usitc.gov/', 'US public domain', 'official', '10-digit; additional tariffs by origin loaded separately'),
  ('hs2022-wco', 'WCO HS 2022 nomenclature (datasets/harmonized-system)', 'https://github.com/datasets/harmonized-system', 'ODC-PDDL', 'official', '5,613 subheadings')
on conflict (id) do nothing;

-- 0005_grants.sql
-- Access rights for the API roles. Some projects do not carry Supabase's default privileges, so tables
-- created by 0003/0004 were unreadable through PostgREST ("permission denied for table duty_rates").
-- Row-level security policies still decide which rows each role may see.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.hs_codes, public.rate_sources, public.duty_rates to anon, authenticated, service_role;
grant all on public.hs_codes, public.rate_sources, public.duty_rates to service_role;
grant select, insert, update, delete on public.declarations to authenticated, service_role;
grant select, insert, update, delete on public.api_keys to authenticated, service_role;
grant execute on function public.best_duty(text, text, text, date) to anon, authenticated, service_role;
grant execute on function public.touch_api_key(text) to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
