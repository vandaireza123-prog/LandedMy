# LandedMY

Malaysian landed-cost calculator: verified engine, phone-first app at `/calc/`, landing page at `/`, SEO guides under `/guides/` (figures computed from the engine at build time), invoice reader, live FX, forwarder-quote check, general goods, reverse calculator, scenarios, Bahasa Malaysia, accounts, rate alerts, PDF quotes, compliance checklist, public API.

General-goods duty rates in `packages/engine/data/general.json` are indicative (labelled "verify") until checked against a K1; the UI always allows manual duty % and SST %, and links to JKDM's tariff tool.

## Deploying (Sprint 2 onward needs functions, so drag-and-drop of `out/` is no longer enough)

Option A — connect this repo to the Netlify site `landedmy`: build command `npm run build`, publish `apps/web/out`, functions `netlify/functions` (all in `netlify.toml`).
Option B — CLI: `npx netlify-cli deploy --prod --dir=apps/web/out --functions=netlify/functions`.

Environment variables on the site:
- `ANTHROPIC_API_KEY` — required for the invoice/photo reader and customs-code suggestions
- `LANDEDMY_MODEL` — optional, defaults to `claude-sonnet-5-5`
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — server-side only, for the daily rate-change alerts function
- `RESEND_API_KEY` and `ALERT_FROM` — optional; without them alerts are in-app only
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — optional overrides; the publishable key is compiled in by default

## Public API

`GET https://landedmy.netlify.app/api/calc` returns the schema; `POST` the same shape (the engine's Shipment plus optional `manual_rates`) and get `{ result }` with every rate's source. Beta: free, 60 req/min per IP; with an `x-api-key` header (created under Account → API keys; only the SHA-256 hash is stored, validated by the `touch_api_key` RPC with the service role) 300 req/min per key and usage counted on the account. `dest_country: "SG"` prices for Singapore; `claim_fta: false` prices at MFN.

## Going global

Layer 1 (done): the full HS 2022 nomenclature (5,613 six-digit subheadings, public domain, `packages/engine/data/hs2022-source.csv` → `apps/web/src/lib/hs/hs6.json`, lazy-loaded) is searchable in plain language (`lib/hs/search.ts`, ~400 everyday-word synonyms) and the invoice/photo classifier returns an HS-6 for any goods. An HS-6 that matches a national line prices at once; otherwise the line asks for duty % and tax % with a link to the official lookup.
Layer 3 (done, engine + API): `packages/engine/data/destinations.json` registers 55 destinations with currency, standard import tax (VAT/GST/sales tax) and base, official tariff lookup and data tier. `ratesForShipment(country, lines)` uses the national schedule for MY/SG and otherwise builds indicative tables from the country's tax and each line's `duty_pct` (user-entered, or the country default such as GCC 5%); alcohol is refused there until excise is loaded. `GET /api/calc?destinations=1` lists them. The web UI has a searchable destination picker (exact vs indicative, tier badges), a per-line duty % field with the country's tariff lookup for indicative destinations, BNM cross-rate FX into any of the 55 currencies, tier-aware result banner and a generic compliance list.
Layer 2 (blocked on data access): indicative MFN duty at HS-6 for every destination from World Bank WITS/TRAINS. Layer 4: excise on sensitive goods per country, by demand, declaration-verified.

## World rates backbone (migration 0004)

`duty_rates` holds one row per destination × HS code (6-digit universal or national line) × origin (MFN / ISO-2 / agreement) × measure, effective-dated, with `source_id` → `rate_sources` and a tier. `best_duty(dest, hs6, origin, date)` picks the best row (named origin > MFN, national line > HS-6, verified > official > indicative). `hs_codes` holds the nomenclature; `declarations` receives user-uploaded customs declarations for the verification loop.

Loaders (run locally with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, all support `--dry-run`): `scripts/load/hs-codes.mjs` (HS 2022), `scripts/load/wto-tdf.mjs --file <csv>` (WTO Tariff Download Facility HS-6 export), `scripts/load/wits.mjs --country TH --year 2024 [--partner CHN]` (WITS/TRAINS SDMX API, MFN and preferential).

`GET /api/rates?dest=TH&hs=940131&origin=CN` serves the best rate with its source; the app pre-fills the duty field from it for indicative destinations and labels the provenance. `nomenclature-watch` runs weekly: diffs the public HS dataset into `hs_codes` and flags rate sources older than 400 days.

## Multi-country

`ratesFor(country)` serves the rate tables. `MY` is K1-verified. `GB` (`data/uk.json`: UK Global Tariff £/hl duty for chapter 22, HMRC Alcohol Duty by ABV band per litre of pure alcohol from 1 Feb 2026, VAT 20%; cider lines deliberately absent until confirmed) is official. `CA` (`data/ca.json`: CBSA Customs Tariff 2026 chapter 22 with ABV-banded wine duty, CRA federal excise from 1 Apr 2026, GST 5% on duty-paid value; provincial markups excluded and noted) is official. `AU` (`data/au.json`: 5% general rate + ATO excise-equivalent from 3 Aug 2026 with the 1.15% beer threshold, WET 29% on wine/cider/mead, GST 10%) is official. `SG` (`data/sg.json`, Singapore Customs List of Dutiable Goods: customs + excise per litre of alcohol, GST 9% on CIF + duties) is registered and available through the API (`dest_country: "SG"`), but labelled unverified until a Singapore Customs permit is checked against it. The web UI has a Malaysia / Singapore switch on step 1: it changes the rate tables, currency (RM / S$), tax name (SST / GST), destination ports, default local charges, FX (BNM cross rate for SGD) and the compliance checklist, and the results page shows the same shipment priced for the other country. Singapore results carry a 'verify' banner until permit-checked.

## Database (Supabase)

Paste `supabase/setup.sql` into the SQL Editor and run it once (safe to re-run; re-run after pulling a version that adds a migration — 0003 adds `api_keys`). It creates every table, RLS policies, the chapter-22 rate seed, profiles, notifications and the rate-version stamp.
In Authentication → URL Configuration set Site URL to the deployed site and add it to Redirect URLs, so magic links return to the app.

Leads from "Get quotes" land in Netlify → Forms → `quote-request`; turn on email notifications there.

## Engine

```
npm install
npm test          # 68 tests, all green (incl. 2 real K1 declarations)
npm run typecheck
npx tsx scripts/demo.ts   # prints the €5 wine worked example
npm run seed:sql          # regenerates supabase/seed/0001_chapter22.sql from the JSON
```

## Layout

| Path | What |
|---|---|
| `packages/engine/src/types.ts` | Shipment, rate-row and result types |
| `packages/engine/src/rates.ts` | Builds effective-dated tables from `data/chapter22.json` (two excise versions) |
| `packages/engine/src/engine.ts` | `computeShipment(shipment, rates)` — the one pure function |
| `packages/engine/data/chapter22.json` | 28 HS lines, duty + excise + source URLs. Single source of truth for engine and DB seed |
| `packages/engine/fixtures/shipments/` | Five test shipments with hand-checked expectations |
| `packages/engine/fixtures/k1/` | Two real RMCD K1 declarations (AU wine Oct 2026, FR wine Jun 2026) — per-line duty/excise/SST must match to the sen |
| `supabase/migrations/0001_schema.sql` | All tables, RLS on from the start |
| `supabase/seed/0001_chapter22.sql` | Generated seed |

## Rules the engine enforces

- SST = 10% × (CIF + duty + excise). Never on CIF alone.
- Specific rates: per litre of beverage, or per litre of 100% alcohol × ABV.
- Excise rows switch on 1 Nov 2025 to the Excise Duties Order 2025, P.U.(A) 389/2025 (every chapter-22 line = 2022 rate × 1.10, checked against the gazette).
- A line with no effective tariff or SST row for the shipment date is refused, not guessed.
- Alcohol with no excise row is refused.
- FTA rows override MFN duty when origin matches. Alcohol into Malaysia never gets a preference (ATIGA exclusion list, MAFTA side letter, MNZFTA); `preferenceNote()` explains why. ATIGA 0% is loaded for general goods from ASEAN origins (indicative, needs Form D); `withoutFta()` prices at MFN and the app has a 'claim FTA' toggle.
- Rounding to sen once per line per tax, on the unrounded invoice value — matches RMCD assessments exactly (verified on 50 declaration lines).

## Before launch

- Add more real K1 declarations as fixtures (beer, cider, spirits — the two we have are both still wine).
