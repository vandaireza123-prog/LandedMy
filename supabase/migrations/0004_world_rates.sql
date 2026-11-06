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
