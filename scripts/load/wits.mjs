// Load MFN and preferential duties at HS-6 from World Bank WITS (UNCTAD TRAINS) via its SDMX REST API.
// Docs: https://wits.worldbank.org/witsapiintro.aspx  — datasource TRN, datatype 'reported' (applied) or 'aveestimated'.
// Example: node scripts/load/wits.mjs --country TH --year 2024 [--partner 000|CHN] [--dry-run]
//   partner 000 = world (MFN). A named partner returns the preferential rate where one exists.
import { args, upsertRates, markSourceLoaded, ISO2 } from "./lib.mjs";

const a = args();
const iso3 = Object.entries(ISO2).find(([, v]) => v === a.country)?.[0];
if (!iso3) throw new Error("--country <ISO2 in registry> required");
const year = a.year ?? String(new Date().getFullYear() - 2);
const partner = a.get("--partner") ?? "000";
const url = `https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/${iso3}/partner/${partner}/product/all/year/${year}/datatype/reported?format=JSON`;
console.log("GET", url);
const res = await fetch(url);
if (!res.ok) throw new Error(`WITS ${res.status}: ${await res.text()}`);
const j = await res.json();
// SDMX-JSON: dataSets[0].series keyed "i:j:k:..." with observations; structure.dimensions.series gives the keys.
const dims = j.structure.dimensions.series;
const prodIdx = dims.findIndex((d) => /product/i.test(d.id));
const partIdx = dims.findIndex((d) => /partner/i.test(d.id));
const rows = [];
for (const [key, s] of Object.entries(j.dataSets[0].series)) {
  const idx = key.split(":").map(Number);
  const hs = dims[prodIdx].values[idx[prodIdx]].id.replace(/\D/g, "").slice(0, 6);
  const part = dims[partIdx].values[idx[partIdx]].id;
  const obs = Object.values(s.observations)[0];
  const value = Number(obs?.[0]);
  if (!hs || hs.length !== 6 || Number.isNaN(value)) continue;
  const origin = part === "000" || part === "WLD" ? "MFN" : (ISO2[part] ?? part);
  rows.push({
    dest_iso2: a.country, hs_code: hs, hs_level: 6, origin, measure: "duty", rate_type: "ad_valorem", value, unit: null, currency: null, compound_text: null,
    effective_from: `${year}-01-01`, effective_to: null, year: Number(year), source_id: "wits-trains", source_ref: `TRAINS ${iso3}/${partner}/${year}`, tier: "indicative",
  });
}
await upsertRates(rows, a);
await markSourceLoaded("wits-trains");
