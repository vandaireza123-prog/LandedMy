/**
 * Public calculation API.
 *
 *   GET  /api/calc            → this documentation as JSON
 *   POST /api/calc            → { result } for a shipment
 *
 * Body: the engine's Shipment object (see GET for the schema), plus optional
 *   "manual_rates": [{ hs_code, name, duty_pct, sst_pct }]   for lines not in our tables.
 *
 * Free while in beta, 60 requests/minute per IP. Send an `x-api-key` header once keys exist;
 * requests without one are accepted but rate-limited harder. Responses carry every rate's source.
 */
import type { Config, Context } from "@netlify/functions";
import { DESTINATION_CODES, computeShipment, destination, manualRates, mergeRates, ratesForShipment, withoutFta, RateNotFoundError, type CountryCode, type Shipment } from "../../packages/engine/src/index";
import { sbHeaders } from "../lib/sb";
const buckets = new Map<string, { n: number; reset: number }>();

function limited(ip: string, max: number): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) {
    buckets.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  b.n++;
  return b.n > max;
}

/** Validate an API key against Supabase (service role) and count the call. Null when keys are not configured. */
async function validateKey(key: string): Promise<{ user_id: string; key_id: string } | null> {
  const url = process.env.SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk || !/^lmy_[A-Za-z0-9_-]{20,}$/.test(key)) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  try {
    const r = await fetch(`${url}/rest/v1/rpc/touch_api_key`, {
      method: "POST",
      headers: sbHeaders(srk),
      body: JSON.stringify({ p_hash: hash }),
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as { user_id: string; key_id: string }[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-api-key", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json", ...CORS } });

const DOCS = {
  name: "Costavora calculation API",
  version: "0.1",
  status: "beta, free, 60 req/min per IP",
  endpoint: "POST /api/calc",
  body: {
    date: "YYYY-MM-DD (picks the rate version in force)",
    dest_country: "ISO-2 code. MY (verified, default) and SG (official schedule) price every line from national tables. 53 more destinations (ASEAN, AU, NZ, JP, KR, CN, HK, TW, IN, Gulf, UK, EU, US, CA, MX, BR…) are indicative: give duty_pct on each line (or rely on the country default where one exists, e.g. GCC 5%) and the standard VAT/GST is applied; alcohol is refused there until excise is loaded. GET /api/calc?destinations=1 lists them",
    origin_iso: "FR",
    dest_port: "MYPKG",
    currency: "EUR",
    fx_rate: "destination currency per 1 unit of currency, e.g. 5.0 RM per EUR",
    incoterm: "EXW | FOB | CIF",
    freight: "international freight in currency (0 for CIF)",
    insurance: "{ amount: 10 } in currency, or { pct_of_goods: 0.3 }",
    local_charges_myr: "{ 'Port and THC': 600, 'Customs agent': 400 } in destination currency",
    allocation: "volume | value | units",
    lines: [
      { id: "w1", name: "Still red wine 750ml", hs_code: "2204.21.11", volume_ml: 750, abv: 13, units_per_case: 6, cases: 100, unit_cost: 5.0 },
    ],
    claim_fta: "optional, default true: apply FTA preferential duty where one exists (ATIGA 0% on general goods from ASEAN, needs Form D). Alcohol never gets a preference into Malaysia; result.warnings says when a preference was applied",
    manual_rates: "optional: [{ hs_code: 'MANUAL-x', name, duty_pct, sst_pct }] for lines not in our tables",
  },
  response: "{ result: ShipmentResult } — per line CIF, duty, excise, SST, local charges, landed (total and per unit), rates_used with source documents; totals; warnings",
  auth: "optional x-api-key header (create one under Account → API keys in the app): 300 req/min per key instead of 60 per IP, and usage is counted against your account",
  errors: { 400: "invalid body", 401: "unknown or revoked API key", 422: "no rate in force for an HS code on that date (RateNotFoundError)", 429: "rate limited" },
  rates: "MY: Customs Duties Order 2022 (MFN); Excise Duties Order 2025 (P.U.(A) 389/2025) from 1 Nov 2025; SST 10% on CIF + duty + excise; verified against RMCD K1 assessments for chapter 22. SG: customs and excise per litre of alcohol from Singapore Customs List of Dutiable Goods; GST 9% on CIF + duties.",
  contact: "https://costavora.com/",
};

export default async (req: Request, ctx: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.has("destinations")) return json(200, { destinations: DESTINATION_CODES.map((c) => { const d = destination(c); return { code: d.code, name: d.name, currency: d.currency, tax_name: d.tax_name, tax_pct: d.tax_pct, tier: d.tier, lookup: d.lookup, duty_default_pct: d.duty_default_pct ?? null }; }) });
    return json(200, DOCS);
  }
  if (req.method !== "POST") return json(405, { error: "GET for docs, POST to calculate" });

  const ip = ctx.ip ?? req.headers.get("x-forwarded-for") ?? "anon";
  const key = req.headers.get("x-api-key");
  const keyed = key ? await validateKey(key) : null;
  if (key && !keyed) return json(401, { error: "Unknown or revoked API key" });
  if (limited(keyed ? `key:${keyed.key_id}` : ip, keyed ? 300 : 60)) return json(429, { error: "Rate limited; try again in a minute" });

  let body: Shipment & { manual_rates?: { hs_code: string; name: string; duty_pct: number; sst_pct: number }[]; claim_fta?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) return json(400, { error: "lines[] required; GET this endpoint for the schema" });
  if (body.lines.length > 200) return json(400, { error: "max 200 lines per call" });

  const dest_country = String(body.dest_country ?? "MY").toUpperCase() as CountryCode;
  if (!DESTINATION_CODES.includes(dest_country)) return json(400, { error: `dest_country must be one of ${DESTINATION_CODES.join(", ")}` });
  const dest = destination(dest_country);
  let rates;
  try {
    rates = ratesForShipment(dest_country, (body.lines ?? []).map((l) => ({ hs_code: l.hs_code, name: l.name, duty_pct: l.duty_pct })));
  } catch (e) {
    if (e instanceof RateNotFoundError) return json(422, { error: `${dest.name} is an indicative destination: give duty_pct on each line (look it up at ${dest.lookup}); ${dest.tax_name} ${dest.tax_pct}% is applied automatically`, lookup: dest.lookup });
    throw e;
  }
  if (body.claim_fta === false) rates = withoutFta(rates);
  const shipment: Shipment = {
    dest_country,
    date: body.date ?? new Date().toISOString().slice(0, 10),
    origin_iso: body.origin_iso ?? "XX",
    dest_port: body.dest_port ?? "MYPKG",
    currency: body.currency ?? "MYR",
    fx_rate: Number(body.fx_rate ?? 1),
    incoterm: body.incoterm ?? "EXW",
    freight: Number(body.freight ?? 0),
    insurance: body.insurance ?? { amount: 0 },
    local_charges_myr: body.local_charges_myr ?? {},
    allocation: body.allocation ?? "volume",
    lines: body.lines.map((l, i) => ({
      id: String(l.id ?? i + 1),
      name: String(l.name ?? `Line ${i + 1}`),
      hs_code: String(l.hs_code ?? ""),
      volume_ml: Number(l.volume_ml ?? 0),
      abv: Number(l.abv ?? 0),
      units_per_case: Number(l.units_per_case ?? 1),
      cases: Number(l.cases ?? 1),
      unit_cost: Number(l.unit_cost ?? 0),
      declared_value: l.declared_value != null ? Number(l.declared_value) : undefined,
      cases_per_pallet: l.cases_per_pallet != null ? Number(l.cases_per_pallet) : undefined,
    })),
  };

  try {
    const merged = mergeRates(rates, ...(body.manual_rates ?? []).map((m) => manualRates(m.hs_code, m.name, Number(m.duty_pct), Number(m.sst_pct))));
    const result = computeShipment(shipment, merged);
    return json(200, { result, destination: { country: dest_country, name: dest.name, currency: dest.currency, symbol: dest.symbol, tax_name: dest.tax_name, tier: rates.tier ?? dest.tier, lookup: dest.lookup, note: dest.tax_note } });
  } catch (e) {
    if (e instanceof RateNotFoundError) return json(422, { error: e.message, hs_code: e.hs_code, date: e.date });
    return json(400, { error: (e as Error).message });
  }
};

export const config: Config = { path: "/api/calc" };
