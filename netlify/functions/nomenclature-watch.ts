/**
 * Weekly: fetch the public-domain HS nomenclature, diff against hs_codes, insert new subheadings and
 * mark retired ones. New codes appear in the app's search on the next deploy; the diff is logged so a
 * maintainer can review descriptions and add synonyms. Also reports which rate sources are stale (>400 days).
 */
import type { Config } from "@netlify/functions";
import { sbHeaders } from "../lib/sb";

export const config: Config = { schedule: "@weekly" };

const SRC = "https://raw.githubusercontent.com/datasets/harmonized-system/main/data/harmonized-system.csv";

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift()!;
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}

export default async () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("not configured", { status: 200 });
  const h = sbHeaders(key);
  const csv = await (await fetch(SRC)).text();
  const incoming = parseCsv(csv).filter((r) => r.level === "6");
  const have = new Set(((await (await fetch(`${url}/rest/v1/hs_codes?select=code&level=eq.6&retired_at=is.null`, { headers: h })).json()) as { code: string }[]).map((x) => x.code));
  const added = incoming.filter((r) => !have.has(r.hscode));
  const inc = new Set(incoming.map((r) => r.hscode));
  const retired = [...have].filter((c) => !inc.has(c));
  if (added.length) {
    await fetch(`${url}/rest/v1/hs_codes`, { method: "POST", headers: { ...h, prefer: "resolution=merge-duplicates" }, body: JSON.stringify(added.map((r) => ({ code: r.hscode, edition: "HS2022", description: r.description, parent: r.parent, level: 6, section: r.section }))) });
  }
  for (const c of retired) await fetch(`${url}/rest/v1/hs_codes?code=eq.${c}`, { method: "PATCH", headers: h, body: JSON.stringify({ retired_at: new Date().toISOString() }) });
  const stale = ((await (await fetch(`${url}/rest/v1/rate_sources?select=id,last_loaded_at`, { headers: h })).json()) as { id: string; last_loaded_at: string | null }[])
    .filter((s) => !s.last_loaded_at || Date.now() - Date.parse(s.last_loaded_at) > 400 * 86400e3).map((s) => s.id);
  const summary = { checked: incoming.length, added: added.map((r) => r.hscode), retired, stale_sources: stale };
  console.log(JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { headers: { "content-type": "application/json" } });
};
