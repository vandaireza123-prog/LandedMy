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

// ---------- China (8-digit, 2026 Import and Export Tariff) ----------
{
  const rows = JSON.parse(readFileSync(join(DATA, "dcd887_hs-code-assistant/data/hs_codes_full.json"), "utf8"));
  const map = {};
  let miss = 0;
  for (const r of rows) {
    const code = String(r.hs_code).replace(/\./g, "").slice(0, 8);
    // The mirror appended the MFN rate to the name ("麦芽酿造的啤酒 0", "威士忌酒 10"); recover it.
    const m = String(r.name ?? "").match(/\s(\d+(?:\.\d+)?)(?:[∆△]\d+)?\s*[①-⑳]*\s*$/);
    if (!m) { miss++; continue; }
    const pct = Number(m[1]);
    map[code] = { d: String(r.name).replace(/\s\d+(?:\.\d+)?(?:[∆△]\d+)?\s*[①-⑳]*\s*$/, "").slice(0, 120), g: pct, gt: `${pct}%`, src: r.basis ?? "2026 tariff" };
  }
  writeFileSync(join(OUT, "CN.json"), JSON.stringify({ _meta: { country: "CN", level: 8, source_id: "cn-tariff-2026", as_of: "2026-01-01", licence: "Compiled from the 2026 Import and Export Tariff of the PRC (via dcd887/hs-code-assistant); verify on the GACC schedule", url: "http://www.customs.gov.cn/", note: "MFN rate. China VAT 13% (9% for food, books, agricultural goods) and consumption tax on alcohol, tobacco, cosmetics, fuel and cars are applied separately." }, lines: map }));
  console.log("CN", Object.keys(map).length, "lines;", miss, "without a parsable rate");
}

// ---------- Egypt (official, Nafeza / Decree 218/2022) ----------
{
  const rows = parseCsv(readFileSync(join(DATA, "Mohamed-Reda1010_egypt-customs-tariff/egypt_customs_tariff.csv"), "utf8").replace(/^﻿/, ""));
  const map = {};
  const pct = (t) => { const m = (t ?? "").match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; };
  for (const r of rows) {
    const code = String(r["كود_البند"] ?? "").replace(/\D/g, "");
    if (code.length < 8) continue;
    const duty = pct(r["ضريبة_الوارد_الجمارك"]);
    if (duty == null) continue;
    const vat = pct(r["ضريبة_القيمة_المضافة"]);
    map[code.slice(0, 10)] = { d: String(r["مسمى_الصنف_ووصفه"] ?? "").slice(0, 120), g: duty, gt: `${duty}%`, vat, other: r["ضرائب_ورسوم_أخرى"] || undefined };
  }
  writeFileSync(join(OUT, "EG.json"), JSON.stringify({ _meta: { country: "EG", level: 10, source_id: "eg-nafeza", as_of: "2025-01-01", tier: "indicative", licence: "CC-BY 4.0 — Egyptian Customs Authority / Nafeza single window, Presidential Decree 218/2022 as amended (via Mohamed-Reda1010/egypt-customs-tariff)", url: "https://www.nafeza.gov.eg/", note: "Duty and VAT per tariff line as published on Nafeza; 2,375 lines carry no rate in the export (incl. alcohol) and some apparel lines read 0% — confirm on Nafeza before you commit." }, lines: map }));
  console.log("EG", Object.keys(map).length, "lines");
}

// ---------- Nepal (Customs Tariff 2026/27) ----------
{
  const rows = parseCsv(readFileSync(join(DATA, "sabinevolve-hue_nepal-hs-code-finder/data/nepal-customs-tariff-2026-27.csv"), "utf8").replace(/^﻿/, ""));
  const map = {};
  for (const r of rows) {
    const code = String(r.hs_code ?? "").replace(/\D/g, "");
    const g = Number(r.duty_general);
    if (code.length < 8 || Number.isNaN(g)) continue;
    map[code.slice(0, 8)] = { d: `${r.heading_description} > ${r.description}`.slice(0, 120), g, gt: `${g}%`, saarc: r.duty_saarc ? Number(r.duty_saarc) : undefined };
  }
  writeFileSync(join(OUT, "NP.json"), JSON.stringify({ _meta: { country: "NP", level: 8, source_id: "np-customs-2026", as_of: "2026-07-17", licence: "Department of Customs, Nepal — Customs Tariff 2026/27 (via sabinevolve-hue/nepal-hs-code-finder)", url: "https://customs.gov.np/", note: "General rate; SAARC preferential rate where one exists." }, lines: map }));
  console.log("NP", Object.keys(map).length, "lines");
}

// ---------- Vietnam (8-digit, Biểu thuế XNK 2025 — Decree 26/2023 as amended by 144/2024; MFN, VAT, SCT, export duty, FTAs) ----------
{
  const src = JSON.parse(readFileSync(new URL("../../packages/engine/data/raw/vn_bt2025.json", import.meta.url), "utf8"));
  const num = (v) => { if (v == null) return null; const s = String(v).trim(); if (s === "" || s === "*" || /^[A-ZĐ]/.test(s)) return null; const m = s.match(/^(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : null; };
  const FTA = ["acfta", "atiga", "ajcep", "vjepa", "akfta", "aanz", "aifta", "vkfta", "vcfta", "eaeu", "cptpp", "ahk", "evfta", "ukv", "lao", "vifta", "rcep"];
  const map = {};
  for (const [code, r] of Object.entries(src)) {
    const mfn = num(r.mfn);
    if (mfn == null && num(r.ord) == null) continue;
    const e = { d: r.d, g: mfn, gt: mfn != null ? `${mfn}%` : String(r.mfn ?? ""), vat: num(r.vat), sct: num(r.ttdb), xk: num(r.xk) };
    const p = {};
    for (const k of FTA) { const v = num(r[k]); if (v != null) p[k] = v; }
    if (Object.keys(p).length) e.p = p;
    if (r.vat === "8") e.vatnote = "8% reduced VAT (Resolution 174/2024) — standard 10%";
    map[code] = e;
  }
  writeFileSync(join(OUT, "VN.json"), JSON.stringify({ _meta: { country: "VN", level: 8, source_id: "vn-bieu-thue-2025", as_of: "2025-01-01", licence: "Vietnam Ministry of Finance / General Department of Customs tariff schedule (Decree 26/2023/NĐ-CP as amended by 144/2024/NĐ-CP), Excel as republished by MISA", url: "https://www.customs.gov.vn/", note: "MFN preferential rate (NK ưu đãi). FTA rates by agreement where the origin qualifies with a certificate of origin. VAT and special consumption tax per line." }, lines: map }));
  console.log("VN", Object.keys(map).length, "lines");
}

// Chapter-22 subset for the engine (Vietnam national tables: MFN duty, special consumption tax, VAT per line).
{
  const vn = JSON.parse(readFileSync(join(OUT, "VN.json"), "utf8"));
  const ch22 = Object.fromEntries(Object.entries(vn.lines).filter(([c]) => c.startsWith("22")));
  writeFileSync(new URL("../../packages/engine/data/vn-ch22.json", import.meta.url), JSON.stringify({ _meta: { ...vn._meta, scope: "Chapter 22 subset for the engine" }, lines: ch22 }, null, 1));
  console.log("VN ch22", Object.keys(ch22).length);
}

// ---------- Brazil (NCM 8-digit — Resolução Gecex 272/2021 Anexos I–X, MDIC workbook of 04-11-2026) ----------
// Anexo I = TEC; Anexo II = Brazilian applied rate where it differs (Decision CMC 08/22 10% cut etc.);
// Anexos IV/V/VI/VIII/IX/X = temporary exceptions (LETEC, LEBIT/BK, shortages, WTO quotas, DCC surcharges, ACE-14 autos).
{
  const src = JSON.parse(readFileSync(new URL("../../packages/engine/data/raw/br_tec_2026-11-04.json", import.meta.url), "utf8"));
  const key = (ncm) => String(ncm).replace(/\D/g, "");
  const xl = (n) => (typeof n === "number" && n > 20000 ? new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10) : null);
  const rate = (v) => { if (v == null || v === "") return { g: null, flag: "" }; const s = String(v).trim(); const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([A-Z/]*)$/); return m ? { g: Number(m[1].replace(",", ".")), flag: m[2] } : { g: null, flag: s }; };
  const map = {};
  for (const [ncm, [d, tec]] of Object.entries(src.I)) {
    const r = rate(tec);
    map[key(ncm)] = { d: d.replace(/^-+\s*/, "").slice(0, 120), tec: r.g, gt: r.g != null ? `${r.g}%` : String(tec ?? ""), bk: r.flag || undefined };
  }
  for (const [ncm, tec, flag, cmc, applied, basis] of src.II) {
    const e = map[key(ncm)];
    if (!e) continue;
    if (applied != null && applied !== e.tec) { e.g = applied; e.basis = basis || (cmc != null ? "Anexo III Decisão CMC 08/22" : "Anexo II"); }
  }
  for (const e of Object.values(map)) if (e.g == null) e.g = e.tec;
  // temporary annexes: only whole-NCM entries (Ex = "-") become candidate rates; Ex-numbered ones are notes
  const temp = {};
  const push = (ncm, t) => { const k = key(ncm); (temp[k] ??= []).push(t); };
  for (const [ncm, ex, d, g, quota, unit, ato] of src.IV) push(ncm, { annex: "IV shortage quota", ex, g, quota: quota !== "-" ? `${quota} ${unit}` : null, d: String(d).slice(0, 100), ato });
  for (const [ncm, ex, g, d, quota, unit, from, to] of src.V) push(ncm, { annex: "V LETEC", ex, g, quota: quota !== "-" ? `${quota} ${unit}` : null, d: String(d).slice(0, 100), from: xl(from), to: xl(to) });
  for (const [ncm, ex, d, g, quota, unit, ato, from] of src.VI) push(ncm, { annex: "VI LEBIT/BK", ex, g, quota: quota !== "-" ? `${quota} ${unit}` : null, d: String(d).slice(0, 100), ato, from: xl(from) });
  for (const [ncm, ex, g, d, quota, unit, obs] of src.VIII) push(ncm, { annex: "VIII WTO quota", ex, g, quota: quota !== "-" ? `${quota} ${unit}` : null, d: String(d).slice(0, 100), obs });
  for (const [ncm, ex, g, d, quota, unit, from, to] of src.IX) push(ncm, { annex: "IX DCC surcharge", ex, g, quota: quota !== "-" ? `${quota} ${unit}` : null, d: String(d).slice(0, 100), from: xl(from), to: xl(to) });
  for (const [ncm, ex, g, d, quota, unit, from, to] of src.X) push(ncm, { annex: "X ACE-14 autos", ex, g, quota: quota !== "-" ? `${quota} ${unit}` : null, d: String(d).slice(0, 100), from: xl(from), to: xl(to) });
  let n = 0;
  for (const [k, list] of Object.entries(temp)) { if (map[k]) { map[k].temp = list; n += list.length; } }
  const meta = src.meta;
  writeFileSync(join(OUT, "BR.json"), JSON.stringify({ _meta: { country: "BR", level: 8, source_id: "br-tec-gecex-272", as_of: "2026-11-04", licence: "MDIC / Camex — Resolução Gecex nº 272/2021 Anexos I a X, workbook published 04-11-2026 (public sector information)", url: "https://www.gov.br/mdic/pt-br/assuntos/camex/se-camex/strat/tarifas/vigentes", updates: meta, note: "Imposto de Importação only. IPI, PIS/COFINS-Importação and state ICMS are charged on top and are not in this rate. Mercosur origin (AR/PY/UY) is duty-free under ACE-18 except sugar and automotive goods under their own regimes." }, lines: map }));
  console.log("BR", Object.keys(map).length, "lines,", n, "temporary entries");
}
