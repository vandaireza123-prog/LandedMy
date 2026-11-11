// United Kingdom: DBT Tariff data API (measures on declarable commodities) + geographical areas → raw/uk_tariff.json, raw/uk_geo_areas.json
import { RAW, get, save, streamCsv, today } from "./_util.mjs";
const metaRes = await get("https://data.api.trade.gov.uk/v1/datasets/uk-tariff-2021-01-01/versions/latest/metadata?format=csvw");
const version = metaRes.url.match(/v\d+\.\d+\.\d+/)?.[0] ?? "latest";
const NA = (v) => (v == null || v === "#NA" || v === "" ? null : v);
const KEEP = new Set(["103", "105", "142", "143", "145", "146", "551", "552", "553", "554", "555"]);
const T = today();
const out = {};
const r = await get("https://data.api.trade.gov.uk/v1/datasets/uk-tariff-2021-01-01/versions/latest/tables/measures-on-declarable-commodities/data?format=csv");
const n = await streamCsv(r, (o) => {
  const t = o.measure__type__id;
  if (!KEEP.has(t)) return;
  const end = NA(o.measure__effective_end_date); if (end && end < T) return;
  const start = NA(o.measure__effective_start_date); if (start && start > T) return;
  const e = (out[o.commodity__code] ??= { d: (o.commodity__description || "").slice(0, 120) });
  const geo = o.measure__geographical_area__id, duty = NA(o.measure__duty_expression) || "", ex = NA(o.measure__excluded_geographical_areas__ids), ac = NA(o.measure__additional_code__code);
  if (t === "103" || t === "105") { if (geo !== "1011") return; if (ac) (e.mfnac ??= {})[ac] = duty; else e.mfn = duty; }
  else if (t === "142" || t === "143" || t === "145" || t === "146") (e.p ??= {})[geo] = ((t === "143" || t === "146") ? "Q:" : "") + duty + (ex ? "|x:" + ex : "");
  else if (!(e.ad ??= []).includes(geo)) e.ad.push(geo);
});
if (Object.keys(out).length < 15000) throw new Error(`UK tariff looks incomplete: ${Object.keys(out).length} codes from ${n} rows`);
save(RAW + "uk_tariff.json", { version: `uk-tariff-2021-01-01 latest (${version})`, pulled: T, lines: out });
const g = await (await get("https://www.trade-tariff.service.gov.uk/api/v2/geographical_areas", { headers: { accept: "application/json" } })).json();
const geo = {};
for (const d of g.data) geo[d.attributes.geographical_area_id] = { d: d.attributes.description, m: (d.relationships?.children_geographical_areas?.data || []).map((x) => x.id) };
save(RAW + "uk_geo_areas.json", geo);
console.log("UK", Object.keys(out).length, "codes;", Object.keys(geo).length, "geo areas");
