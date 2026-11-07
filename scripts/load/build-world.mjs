// Build compact per-destination duty maps for the rates API from open datasets cloned into DATA_DIR.
// Sources (all open-licensed, see rate_sources): checkdutyrates/us-tariff-data (USITC HTS CC0; EU via UK Trade Tariff XI, OGL v3),
// Soe-Moe/thai-customs-tariff-json (Thai Customs ITD master files, ISC).
// Usage: DATA_DIR=/path/to/clones node scripts/load/build-world.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./lib.mjs";

const DATA = process.env.DATA_DIR;
if (!DATA) throw new Error("DATA_DIR required");
const OUT = new URL("../../netlify/data/world/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/** Parse a US HTS rate string into {pct|null, text, type}. */
function parseUsRate(t) {
  const s = (t ?? "").trim();
  if (!s) return null;
  if (/^free$/i.test(s)) return { type: "ad_valorem", pct: 0, text: "Free" };
  const m = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (m) return { type: "ad_valorem", pct: Number(m[1]), text: s };
  return { type: /\+/.test(s) ? "compound" : "specific", pct: null, text: s };
}

// ---------- United States ----------
{
  const rows = parseCsv(readFileSync(join(DATA, "checkdutyrates_us-tariff-data/data/hts.csv"), "utf8"));
  const map = {};
  // Rates sit on the line named in rate_source (8-digit, or 10-digit when the 8-digit level is the stat line itself).
  for (const r of rows) {
    if (!r.general_rate || !r.rate_source) continue;
    const code = r.rate_source.replace(/\./g, "").slice(0, 8);
    if (map[code]) continue;
    const g = parseUsRate(r.general_rate);
    if (!g) continue;
    map[code] = { d: r.description.slice(0, 120), g: g.pct, gt: g.text, s: r.special_rate || undefined, c2: r.column2_rate || undefined };
  }
  const add = parseCsv(readFileSync(join(DATA, "checkdutyrates_us-tariff-data/data/additional_duties.csv"), "utf8"))
    .filter((r) => r.status === "in force")
    .map((r) => ({ country: r.country, heading: r.heading, pct: Number(r.added_percent) || null, text: r.rate_text, scope: r.description.slice(0, 160) }));
  const ver = JSON.parse(readFileSync(join(DATA, "checkdutyrates_us-tariff-data/data/VERSION.json"), "utf8"));
  writeFileSync(join(OUT, "US.json"), JSON.stringify({ _meta: { country: "US", level: 8, source_id: "us-hts", revision: ver.hts_revision, as_of: ver.hts_export_date, licence: "CC0 (USITC public domain)", url: "https://hts.usitc.gov/" }, lines: map, additional: add }));
  console.log("US", Object.keys(map).length, "lines;", add.length, "additional-duty rows in force");
}

// ---------- European Union (HS-6, by origin) ----------
{
  const rows = parseCsv(readFileSync(join(DATA, "checkdutyrates_us-tariff-data/data/eu_duty_by_origin.csv"), "utf8"));
  const map = {};
  const parse = (t) => { const m = (t ?? "").match(/^(\d+(?:\.\d+)?) %$/); return m ? Number(m[1]) : null; };
  for (const r of rows) {
    const hs6 = r.hs6.replace(/\./g, "");
    const origin = r.origin.startsWith("ALL") ? "MFN" : r.origin;
    const lo = parse(r.duty_min), hi = parse(r.duty_max);
    const e = { lo, hi };
    if (lo == null) e.lot = r.duty_min;
    if (hi == null) e.hit = r.duty_max;
    if (r.anti_dumping_possible === "1" || r.anti_dumping_possible === "true") e.ad = 1;
    (map[hs6] ??= {})[origin] = e;
  }
  const ver = JSON.parse(readFileSync(join(DATA, "checkdutyrates_us-tariff-data/data/VERSION.json"), "utf8"));
  writeFileSync(join(OUT, "EU.json"), JSON.stringify({ _meta: { country: "EU", level: 6, source_id: "eu-taric", as_of: ver.eu_checked, licence: "OGL v3 — Contains public sector information licensed under the Open Government Licence v3.0", url: "https://www.trade-tariff.service.gov.uk/xi/find_commodity", note: "Duty range across the CN lines under each HS-6; lo = lowest, hi = highest. Origins beyond MFN are preferential rates with a certificate of origin." }, lines: map }));
  console.log("EU", Object.keys(map).length, "HS-6 codes");
}

// ---------- Thailand (8-digit, official ITD) ----------
{
  const base = join(DATA, "Soe-Moe_thai-customs-tariff-json/output");
  const wto = JSON.parse(readFileSync(join(base, "wto_json/wto_by_hscode.json"), "utf8"));
  const s12 = JSON.parse(readFileSync(join(base, "section12_json/section12_by_hscode.json"), "utf8"));
  const ed = JSON.parse(readFileSync(join(base, "emergency_decree_json/emergency_decree_by_hscode.json"), "utf8"));
  const map = {};
  const pick = (arr) => (arr ?? []).find((x) => !x.expiry_date?.iso) ?? arr?.[0];
  const codes = new Set([...Object.keys(wto), ...Object.keys(s12), ...Object.keys(ed)]);
  for (const c of codes) {
    const w = pick(wto[c]), s = pick(s12[c]), e = pick(ed[c]);
    const cand = [];
    for (const [x, src] of [[w, "WTO (MFN)"], [s, "Section 12 notification"], [e, "Emergency Decree (general)"]]) {
      if (!x) continue;
      const dr = x.duty_rate;
      cand.push({ pct: dr.is_exempt ? 0 : dr.ad_valorem_percentage, spec: dr.specific_rate_baht || 0, unit: dr.specific_unit?.en, src, text: dr.display_en, d: x.description?.en });
    }
    if (!cand.length) continue;
    // applied general-origin rate = lowest ad valorem among WTO and Section 12; emergency decree only if nothing else
    const pref = cand.filter((x) => !x.src.startsWith("Emergency"));
    const use = (pref.length ? pref : cand).reduce((a, b) => (b.pct ?? 999) < (a.pct ?? 999) ? b : a);
    map[c] = { d: (use.d ?? "").slice(0, 120), g: use.pct, gt: use.spec ? `${use.pct}% or ฿${use.spec}/${use.unit} whichever higher` : `${use.pct}%`, src: use.src };
  }
  // 2024 notification: wine import duty to 0% (Royal Gazette, Feb 2024) — the ITD master file predates it.
  for (const c of Object.keys(map)) if (c.startsWith("2204")) map[c] = { ...map[c], g: 0, gt: "0% (Section 12 notification, Feb 2024)", src: "Section 12 notification 2024 (wine duty removed)" };
  writeFileSync(join(OUT, "TH.json"), JSON.stringify({ _meta: { country: "TH", level: 8, source_id: "th-itd", as_of: "2022-01-01", licence: "Thai Customs Department open data (via Soe-Moe/thai-customs-tariff-json, ISC)", url: "https://itd.customs.go.th/", note: "Master file version 2022-01-01; wine (2204) overridden to 0% per the Feb 2024 notification. Check later notifications for other chapters." }, lines: map }));
  console.log("TH", Object.keys(map).length, "lines");
}
