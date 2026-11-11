// United States: live USITC HTS export, all chapters → raw/us_hts.json
import { RAW, get, save, sleep, today } from "./_util.mjs";
const rows = [];
let revision = "current release";
try {
  const html = await (await get("https://hts.usitc.gov/")).text();
  const m = html.match(/(\d{4})\s+(?:HTS\s+)?Revision\s+(\d+)/i) ?? html.match(/Revision\s+(\d+)/i);
  if (m) revision = m.length > 2 ? `${m[1]} HTS Revision ${m[2]}` : `HTS Revision ${m[1]}`;
} catch {}
for (let c = 1; c <= 99; c++) {
  if (c === 77) continue;
  const ch = String(c).padStart(2, "0");
  const r = await get(`https://hts.usitc.gov/reststop/exportList?from=${ch}01&to=${ch}99&format=JSON&styles=false`);
  if (!r.ok) { console.warn("chapter", ch, r.status); continue; }
  const j = await r.json();
  for (const x of j) rows.push([x.htsno, x.indent, x.description, (x.units || []).join("/"), x.general, x.special, x.other, x.additionalDuties || x.addiitionalDuties || "", (x.footnotes || []).map((f) => f.value || f).join(" | ").slice(0, 200)]);
  await sleep(300);
}
if (rows.length < 30000) throw new Error(`US export looks incomplete: ${rows.length} rows`);
save(RAW + "us_hts.json", { revision, as_of: today(), pulled: today(), rows });
console.log("US", revision, rows.length, "rows");
