/**
 * GET /.netlify/functions/fx
 * Returns { rates: { EUR: 5.01, ... }, as_of: "2026-11-02", source, note }
 *
 * Source: Bank Negara Malaysia public exchange-rate API (middle rate at 1700, 1 unit → MYR).
 * RMCD publishes its own weekly customs rates which differ slightly; the UI labels this
 * as the BNM rate and lets the user overwrite it with the RMCD figure. A later version
 * swaps in the RMCD table when a reliable machine-readable source exists.
 */
import type { Context } from "@netlify/functions";

const WANT = ["EUR", "USD", "GBP", "AUD", "NZD", "SGD", "CNY", "JPY", "THB", "HKD"];
const BNM = "https://api.bnm.gov.my/public/exchange-rate";

interface BnmRow {
  currency_code: string;
  unit: number;
  rate: { date: string; buying_rate: number; selling_rate: number; middle_rate: number };
}

let cache: { body: string; at: number } | null = null;

export default async (_req: Request, _ctx: Context) => {
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" };
  if (cache && Date.now() - cache.at < 60 * 60 * 1000) return new Response(cache.body, { headers });

  try {
    const r = await fetch(`${BNM}?session=1700&quote=rm`, { headers: { Accept: "application/vnd.BNM.API.v1+json" } });
    if (!r.ok) throw new Error(`BNM ${r.status}`);
    const data = (await r.json()) as { data: BnmRow[] };
    const rates: Record<string, number> = { MYR: 1 };
    let as_of = "";
    for (const row of data.data) {
      if (!WANT.includes(row.currency_code)) continue;
      rates[row.currency_code] = +(row.rate.middle_rate / row.unit).toFixed(4);
      as_of = row.rate.date;
    }
    const body = JSON.stringify({ rates, as_of, source: "Bank Negara Malaysia, 1700 middle rate", note: "RMCD customs rate may differ slightly; overwrite with the weekly RMCD figure if you have it." });
    cache = { body, at: Date.now() };
    return new Response(body, { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 502, headers });
  }
};
