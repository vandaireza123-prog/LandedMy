// Load MFN applied duties at HS-6 from a WTO Tariff Download Facility export (https://tariffdata.wto.org/).
// Download: Tariff Download Facility → select reporter(s) and year → "HS6 subheading" level → CSV.
// Expected columns (TDF "Duty averages at HS6" export): Reporter_ISO_N or Reporter (ISO3), Year, ProductCode (6 digits),
// SimpleAverage (% ad valorem, averaged over national lines), Nbr_NAV_Lines (>0 means some lines are specific/compound).
// Usage: node scripts/load/wto-tdf.mjs --file export.csv [--country TH] [--dry-run] [--limit 50]
import { readFileSync } from "node:fs";
import { args, parseCsv, upsertRates, markSourceLoaded, ISO2 } from "./lib.mjs";

const a = args();
if (!a.file) throw new Error("--file <csv> required");
const recs = parseCsv(readFileSync(a.file, "utf8"));
const pick = (r, ...ks) => ks.map((k) => r[k]).find((v) => v !== undefined && v !== "");
const rows = [];
for (const r of recs) {
  const iso3 = pick(r, "Reporter_ISO", "ReporterISO3", "Reporter"); const iso2 = ISO2[iso3] ?? (iso3?.length === 2 ? iso3 : null);
  if (!iso2 || (a.country && iso2 !== a.country)) continue;
  const hs = String(pick(r, "ProductCode", "HS6", "Product") ?? "").replace(/\D/g, "").padStart(6, "0").slice(0, 6);
  const year = Number(pick(r, "Year", "year"));
  const avg = Number(pick(r, "SimpleAverage", "Simple_Average", "AV_Duty"));
  const nav = Number(pick(r, "Nbr_NAV_Lines", "NAV_Lines") ?? 0);
  if (!hs || !year || Number.isNaN(avg)) continue;
  rows.push({
    dest_iso2: iso2, hs_code: hs, hs_level: 6, origin: "MFN", measure: "duty",
    rate_type: nav > 0 ? "compound" : "ad_valorem", value: avg, unit: null, currency: null,
    compound_text: nav > 0 ? `${avg}% average; ${nav} national line(s) carry specific/compound duty — check the national schedule` : null,
    effective_from: `${year}-01-01`, effective_to: null, year, source_id: "wto-tdf", source_ref: `TDF ${iso3} ${year}`, tier: "indicative",
  });
}
await upsertRates(rows, a);
await markSourceLoaded("wto-tdf");
