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
