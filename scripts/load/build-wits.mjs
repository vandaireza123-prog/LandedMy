// Builds per-country MFN applied tariff files (HS-6) from WITS/UNCTAD TRAINS pulls.
// Input: one or more wits_part*.json  ({ m49: { year, rates: { hs6: [avg,min,max,lines] } } })
// plus iso.json (lukes/ISO-3166-Countries-with-Regional-Codes all.json) for M49 → ISO-2.
// Output: apps/web/public/data/wits/{ISO2}.json and index.json — served statically, fetched by the app
// when no national schedule is bundled for the destination.
//
//   WITS_DIR=/path/to/wits node scripts/load/build-wits.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.WITS_DIR ?? new URL("../../data/wits/", import.meta.url).pathname;
const out = join(process.cwd(), "apps/web/public/data/wits");
mkdirSync(out, { recursive: true });

const iso = JSON.parse(readFileSync(join(dir, "iso.json"), "utf8"));
const m49 = Object.fromEntries(iso.map((x) => [x["country-code"], x["alpha-2"]]));
// WITS uses a few non-standard reporter codes
Object.assign(m49, { "918": "EU", "490": "TW", "729": "SD", "736": "SD", "891": "RS", "890": "RS", "280": "DE" });

const parts = readdirSync(dir).filter((f) => /^wits_part\d*\.json$/.test(f));
if (!parts.length) { console.log("WITS: no wits_part*.json in", dir, "— keeping existing files"); process.exit(0); }
const index = {};
let rows = 0;
for (const f of parts) {
  const part = JSON.parse(readFileSync(join(dir, f), "utf8"));
  for (const [code, v] of Object.entries(part)) {
    const iso2 = m49[code];
    if (!iso2) {
      console.warn("no ISO-2 for M49", code);
      continue;
    }
    // Only the simple average (slot 0) is published: it is the one series we have verified against
    // national schedules (BR wine 27%, BR t-shirts 35%, CN wheat 33% = mean of in/out-quota). The other
    // slots in the raw pull are not min/max (avg often falls outside them) and are dropped rather than guessed.
    const rates = Object.fromEntries(Object.entries(v.rates).map(([hs, a]) => [hs, Math.round(a[0] * 100) / 100]));
    const n = Object.keys(rates).length;
    if (!n) continue;
    writeFileSync(join(out, `${iso2}.json`), JSON.stringify({ iso2, year: v.year, n, source: "WITS / UNCTAD TRAINS, MFN applied, simple average of national lines at HS-6", rates }));
    index[iso2] = { year: v.year, n };
    rows += n;
  }
}
writeFileSync(join(out, "index.json"), JSON.stringify({ built: new Date().toISOString().slice(0, 10), countries: index }, null, 1));
// Small copy for the app bundle so the destination picker can say which countries pre-fill duty.
writeFileSync(join(process.cwd(), "apps/web/src/lib/wits-index.json"), JSON.stringify(index));
console.log(`WITS: ${Object.keys(index).length} countries, ${rows} HS-6 rows →`, out);
