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

`GET https://landedmy.netlify.app/api/calc` returns the schema; `POST` the same shape (the engine's Shipment plus optional `manual_rates`) and get `{ result }` with every rate's source. Beta: free, 60 req/min per IP (300 with an `x-api-key` header once keys are issued).

## Multi-country

`ratesFor(country)` serves the rate tables. `MY` is K1-verified. `SG` (`data/sg.json`, Singapore Customs List of Dutiable Goods: customs + excise per litre of alcohol, GST 9% on CIF + duties) is registered and available through the API (`dest_country: "SG"`), but labelled unverified until a Singapore Customs permit is checked against it. The web UI still prices Malaysia only; the country switch is pending design approval.

## Database (Supabase)

Paste `supabase/setup.sql` into the SQL Editor and run it once (safe to re-run). It creates every table, RLS policies, the chapter-22 rate seed, profiles, notifications and the rate-version stamp.
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
- Excise rows switch on 1 Nov 2025 (+10%, Budget 2026).
- A line with no effective tariff or SST row for the shipment date is refused, not guessed.
- Alcohol with no excise row is refused.
- FTA rows override MFN duty when origin matches.
- Rounding to sen once per line per tax, on the unrounded invoice value — matches RMCD assessments exactly (verified on 50 declaration lines).

## Before launch

- Replace the +10% excise rows with the gazetted Excise Duties (Amendment) Order figures line by line.
- Add ATIGA / MAFTA / MNZFTA schedules to `fta_rates`.
- Add more real K1 declarations as fixtures (beer, cider, spirits — the two we have are both still wine).
