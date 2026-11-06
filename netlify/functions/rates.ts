/**
 * GET /api/rates?dest=TH&hs=940131[&origin=CN][&date=YYYY-MM-DD]
 * Best known import duty for a destination + HS-6 (+ origin), from the world rates table.
 * Returns { rate: {...} | null, source: {...} | null, tier, note }. Public, cached 1h.
 * Alcohol/tobacco/fuel into non-schedule countries still needs excise: the caller shows that.
 */
import type { Config, Context } from "@netlify/functions";

export const config: Config = { path: "/api/rates" };

const json = (status: number, body: unknown, cache = "public, max-age=3600") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": cache } });

export default async (req: Request, _ctx: Context) => {
  const u = new URL(req.url);
  const dest = (u.searchParams.get("dest") ?? "").toUpperCase();
  const hs = (u.searchParams.get("hs") ?? "").replace(/\D/g, "").slice(0, 6);
  const origin = (u.searchParams.get("origin") ?? "MFN").toUpperCase();
  const date = u.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^[A-Z]{2}$/.test(dest) || hs.length !== 6) return json(400, { error: "dest (ISO-2) and hs (6 digits) required" }, "no-store");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return json(200, { rate: null, source: null, tier: null, note: "World rates database not configured on this deployment" }, "no-store");

  const call = async (path: string, body?: unknown) =>
    fetch(`${url}/rest/v1/${path}`, { method: body ? "POST" : "GET", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

  const r = await call("rpc/best_duty", { p_dest: dest, p_hs6: hs, p_origin: origin, p_date: date });
  if (!r.ok) return json(502, { error: `rates lookup failed (${r.status})` }, "no-store");
  const rows = (await r.json()) as Record<string, unknown>[];
  const rate = rows[0] ?? null;
  let source = null;
  if (rate) {
    const s = await call(`rate_sources?id=eq.${encodeURIComponent(String(rate.source_id))}&select=id,name,url,tier,last_loaded_at`);
    source = s.ok ? ((await s.json()) as unknown[])[0] ?? null : null;
  }
  return json(200, {
    rate,
    source,
    tier: rate?.tier ?? null,
    note: rate
      ? rate.rate_type === "compound"
        ? "Some national lines under this HS-6 carry specific or compound duty; the value is an average — confirm on the national schedule."
        : `${rate.origin === "MFN" ? "MFN" : `Preferential (${rate.origin})`} rate at HS-${rate.hs_level} level, schedule year ${rate.year ?? "n/a"}.`
      : `No rate loaded yet for ${dest} ${hs}; enter the duty % from the official tariff tool.`,
  });
};
