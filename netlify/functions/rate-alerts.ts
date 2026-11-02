/**
 * Scheduled daily. Re-prices every saved shipment with alerts on against the current
 * rate tables; if the landed total moved, writes a notification (shown in-app) and
 * emails the owner when RESEND_API_KEY is configured.
 *
 * Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-side only), optional RESEND_API_KEY, ALERT_FROM.
 * Can also be run by hand: POST /.netlify/functions/rate-alerts with header x-run-key = RATE_ALERT_RUN_KEY.
 */
import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { buildRateTables, computeShipment, manualRates, mergeRates } from "../../packages/engine/src/index";

const CURRENT_RATE_VERSION = "2025-11-01-budget2026";

interface Row {
  id: string;
  user_id: string;
  name: string | null;
  snapshot_json: Record<string, unknown> | null;
  landed_total: number | null;
  rate_version: string | null;
}

import { buildShipment, manualLinesOf, type ShipmentSnapshot } from "../../apps/web/src/lib/shipment";

export default async (req: Request, _ctx: Context) => {
  const runKey = process.env.RATE_ALERT_RUN_KEY;
  if (req.method === "POST" && runKey && req.headers.get("x-run-key") !== runKey) return new Response("forbidden", { status: 403 });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response(JSON.stringify({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set" }), { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.from("shipments").select("id,user_id,name,snapshot_json,landed_total,rate_version").eq("alert_on_rate_change", true).not("snapshot_json", "is", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const rates = buildRateTables();

  let checked = 0,
    changed = 0,
    emailed = 0;
  for (const row of (data ?? []) as Row[]) {
    checked++;
    try {
      const snap = row.snapshot_json as unknown as ShipmentSnapshot;
      const merged = mergeRates(rates, ...manualLinesOf(snap).map((m) => manualRates(m.hs_code, m.name, m.duty_pct, m.sst_pct)));
      const res = computeShipment(buildShipment(snap), merged);
      const newTotal = res.totals.landed;
      const oldTotal = row.landed_total ?? newTotal;
      const delta = newTotal - oldTotal;
      if (Math.abs(delta) < 0.5 && row.rate_version === CURRENT_RATE_VERSION) continue;

      changed++;
      const title = `Landed cost ${delta >= 0 ? "up" : "down"} RM ${Math.abs(delta).toFixed(2)} on “${row.name ?? "your shipment"}”`;
      const body = `Rates changed (${CURRENT_RATE_VERSION}). Was RM ${oldTotal.toFixed(2)}, now RM ${newTotal.toFixed(2)}. Open the shipment to see which lines moved.`;
      await sb.from("notifications").insert({ user_id: row.user_id, shipment_id: row.id, kind: "rate_change", title, body, old_total: oldTotal, new_total: newTotal });
      await sb.from("shipments").update({ landed_total: newTotal, rate_version: CURRENT_RATE_VERSION, result_json: res }).eq("id", row.id);

      if (process.env.RESEND_API_KEY) {
        const { data: u } = await sb.auth.admin.getUserById(row.user_id);
        const to = u.user?.email;
        if (to) {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
            body: JSON.stringify({ from: process.env.ALERT_FROM ?? "LandedMY <alerts@landedmy.netlify.app>", to, subject: title, text: `${body}\n\nhttps://landedmy.netlify.app/` }),
          });
          if (r.ok) emailed++;
        }
      }
    } catch (e) {
      console.error("alert failed for", row.id, (e as Error).message);
    }
  }
  return new Response(JSON.stringify({ checked, changed, emailed, rate_version: CURRENT_RATE_VERSION }), { headers: { "content-type": "application/json" } });
};

export const config: Config = { schedule: "@daily" };
