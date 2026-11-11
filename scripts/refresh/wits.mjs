// WITS / UNCTAD TRAINS: MFN applied simple averages at HS-6 for every reporter → data/wits/wits_part1.json (shape used by build-wits.mjs)
// Slow (~1–3 min per reporter); run with --only 076,124 to limit, or let the monthly job take its time.
import { get, save, pool, sleep } from "./_util.mjs";
const OUT = new URL("../../data/wits/", import.meta.url).pathname;
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const reps = await (await get("https://wits.worldbank.org/API/V1/wits/datasource/trn/country/ALL?format=JSON")).json().catch(() => null);
let codes = [];
if (reps?.countries?.country) codes = reps.countries.country.filter((c) => c.isreporter === "1" || c.isreporter === true).map((c) => c.countrycode);
if (!codes.length) codes = Object.keys(JSON.parse(await (await import("node:fs")).promises.readFile(OUT + "wits_part1.json", "utf8").catch(() => "{}")));
if (only) codes = only;
const all = {};
await pool(codes, 3, async (code) => {
  for (const y of [new Date().getFullYear() - 1, new Date().getFullYear() - 2, new Date().getFullYear() - 3, new Date().getFullYear() - 4]) {
    const r = await get(`https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/${code}/partner/000/product/all/year/${y}/datatype/reported?format=JSON`, { tries: 3 });
    if (!r.ok) continue;
    const j = await r.json();
    const dims = j.structure.dimensions.series; const series = j.dataSets[0].series; const keys = Object.keys(series); if (!keys.length) continue;
    let pos = 2; const f = keys[0].split(":"); for (let i = 0; i < f.length; i++) if (keys.some((k) => k.split(":")[i] !== f[i])) { pos = i; break; }
    const pd = dims.find((d) => d.id === "PRODUCTCODE"); const rates = {};
    for (const k of keys) { const hs = pd.values[Number(k.split(":")[pos])].id; const o = Object.values(series[k].observations)[0]; if (o && o[0] != null) rates[hs] = [Math.round(o[0] * 100) / 100, null, null, null]; }
    all[code] = { year: y, rates };
    console.log(code, y, Object.keys(rates).length);
    break;
  }
  await sleep(1000);
});
if (Object.keys(all).length < (only ? 1 : 100)) throw new Error(`WITS pull looks incomplete: ${Object.keys(all).length} reporters`);
save(OUT + (only ? "wits_part_only.json" : "wits_part1.json"), all);
