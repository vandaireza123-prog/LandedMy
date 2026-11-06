// Shared helpers for the rate loaders. Run with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
// Every loader supports --dry-run (prints a sample, writes nothing) and --limit N.
import { createClient } from "@supabase/supabase-js";

export function args() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  return { dry: a.includes("--dry-run"), limit: Number(get("--limit") ?? 0) || 0, file: get("--file"), country: get("--country"), year: get("--year"), get };
}

export function client() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role; never commit it)");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function upsertRates(rows, { dry, limit }) {
  if (limit) rows = rows.slice(0, limit);
  console.log(`${rows.length} rate rows${dry ? " (dry run)" : ""}; sample:`, rows.slice(0, 3));
  if (dry) return;
  const sb = client();
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from("duty_rates").insert(rows.slice(i, i + 1000));
    if (error) throw error;
    process.stdout.write(`\r${Math.min(i + 1000, rows.length)}/${rows.length}`);
  }
  console.log("\ndone");
}

export async function markSourceLoaded(id) {
  if (process.argv.includes("--dry-run")) return;
  await client().from("rate_sources").update({ last_loaded_at: new Date().toISOString() }).eq("id", id);
}

/** Minimal CSV parser (handles quoted fields with commas). */
export function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

/** ISO numeric / ISO3 → ISO2 for the reporters we meet in WTO/WITS files. */
export const ISO2 = { MYS: "MY", SGP: "SG", THA: "TH", IDN: "ID", VNM: "VN", PHL: "PH", BRN: "BN", KHM: "KH", LAO: "LA", MMR: "MM", AUS: "AU", NZL: "NZ", JPN: "JP", KOR: "KR", CHN: "CN", HKG: "HK", TWN: "TW", IND: "IN", PAK: "PK", BGD: "BD", LKA: "LK", ARE: "AE", SAU: "SA", QAT: "QA", OMN: "OM", BHR: "BH", KWT: "KW", TUR: "TR", EGY: "EG", ZAF: "ZA", NGA: "NG", KEN: "KE", GBR: "GB", IRL: "IE", DEU: "DE", FRA: "FR", NLD: "NL", BEL: "BE", ITA: "IT", ESP: "ES", PRT: "PT", POL: "PL", SWE: "SE", DNK: "DK", FIN: "FI", NOR: "NO", CHE: "CH", USA: "US", CAN: "CA", MEX: "MX", BRA: "BR", CHL: "CL", ARG: "AR", EUN: "EU", E28: "EU", E27: "EU" };
