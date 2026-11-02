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
import { buildRateTables, computeShipment, manualRates, mergeRates, RateNotFoundError, type Shipment } from "../../packages/engine/src/index";

const rates = buildRateTables();
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

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-api-key", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json", ...CORS } });

const DOCS = {
  name: "LandedMY calculation API",
  version: "0.1",
  status: "beta, free, 60 req/min per IP",
  endpoint: "POST /api/calc",
  body: {
    date: "YYYY-MM-DD (picks the rate version in force)",
    origin_iso: "FR",
    dest_port: "MYPKG",
    currency: "EUR",
    fx_rate: "RM per 1 unit of currency, e.g. 5.0",
    incoterm: "EXW | FOB | CIF",
    freight: "international freight in currency (0 for CIF)",
    insurance: "{ amount: 10 } in currency, or { pct_of_goods: 0.3 }",
    local_charges_myr: "{ 'Port and THC': 600, 'Customs agent': 400 }",
    allocation: "volume | value | units",
    lines: [
      { id: "w1", name: "Still red wine 750ml", hs_code: "2204.21.11", volume_ml: 750, abv: 13, units_per_case: 6, cases: 100, unit_cost: 5.0 },
    ],
    manual_rates: "optional: [{ hs_code: 'MANUAL-x', name, duty_pct, sst_pct }] for lines not in our tables",
  },
  response: "{ result: ShipmentResult } — per line CIF, duty, excise, SST, local charges, landed (total and per unit), rates_used with source documents; totals; warnings",
  errors: { 400: "invalid body", 422: "no rate in force for an HS code on that date (RateNotFoundError)", 429: "rate limited" },
  rates: "Customs Duties Order 2022 (MFN); Excise Duties Order 2022 and the +10% rise from 1 Nov 2025; SST 10% on CIF + duty + excise. Verified against RMCD K1 assessments for chapter 22.",
  contact: "https://landedmy.netlify.app/",
};

export default async (req: Request, ctx: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") return json(200, DOCS);
  if (req.method !== "POST") return json(405, { error: "GET for docs, POST to calculate" });

  const ip = ctx.ip ?? req.headers.get("x-forwarded-for") ?? "anon";
  const hasKey = !!req.headers.get("x-api-key");
  if (limited(ip, hasKey ? 300 : 60)) return json(429, { error: "Rate limited; try again in a minute" });

  let body: Shipment & { manual_rates?: { hs_code: string; name: string; duty_pct: number; sst_pct: number }[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) return json(400, { error: "lines[] required; GET this endpoint for the schema" });
  if (body.lines.length > 200) return json(400, { error: "max 200 lines per call" });

  const shipment: Shipment = {
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
    return json(200, { result });
  } catch (e) {
    if (e instanceof RateNotFoundError) return json(422, { error: e.message, hs_code: e.hs_code, date: e.date });
    return json(400, { error: (e as Error).message });
  }
};

export const config: Config = { path: "/api/calc" };
