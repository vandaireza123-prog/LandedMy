// EU: TARIC third-country duty per 10-digit line via the Northern Ireland Online Tariff API (heading overview measures) → raw/eu_taric10.json
import { RAW, get, pool, save, sleep, today } from "./_util.mjs";
const H = { accept: "application/json" };
const headings = new Set();
for (let c = 1; c <= 98; c++) {
  if (c === 77) continue;
  const r = await get(`https://www.trade-tariff.service.gov.uk/xi/api/v2/chapters/${String(c).padStart(2, "0")}`, { headers: H });
  if (!r.ok) { console.warn("chapter", c, r.status); continue; }
  const j = await r.json();
  for (const i of j.included || []) if (i.type === "heading") headings.add(i.attributes.goods_nomenclature_item_id.slice(0, 4));
  await sleep(400);
}
const lines = {};
let done = 0;
await pool([...headings], 2, async (h) => {
  const r = await get(`https://www.trade-tariff.service.gov.uk/xi/api/v2/headings/${h}`, { headers: H, tries: 8, backoff: 10000 });
  if (!r.ok) { console.warn("heading", h, r.status); return; }
  const j = await r.json();
  const inc = j.included || [];
  const byId = {};
  for (const i of inc) byId[i.type + ":" + i.id] = i;
  for (const c of inc) {
    if (c.type !== "commodity" || !c.attributes.declarable) continue;
    let mfn = null;
    for (const m of c.relationships?.overview_measures?.data || []) {
      const mm = byId["measure:" + m.id]; if (!mm) continue;
      const mt = mm.relationships?.measure_type?.data?.id;
      if (mt === "103" || mt === "105") { const de = mm.relationships.duty_expression?.data; const d = de && byId["duty_expression:" + de.id]; mfn = d ? d.attributes.base : ""; }
    }
    lines[c.attributes.goods_nomenclature_item_id] = [(c.attributes.description_plain || c.attributes.description || "").slice(0, 120), mfn];
  }
  if (++done % 100 === 0) console.log(done, "/", headings.size);
  await sleep(700);
});
if (Object.keys(lines).length < 15000) throw new Error(`EU TARIC looks incomplete: ${Object.keys(lines).length} lines`);
save(RAW + "eu_taric10.json", { pulled: today(), lines });
console.log("EU", Object.keys(lines).length, "lines from", headings.size, "headings");
