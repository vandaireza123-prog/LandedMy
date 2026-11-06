// Load the HS 2022 nomenclature into hs_codes from packages/engine/data/hs2022-source.csv (ODC-PDDL).
// node scripts/load/hs-codes.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { args, client, parseCsv } from "./lib.mjs";
const a = args();
const recs = parseCsv(readFileSync(new URL("../../packages/engine/data/hs2022-source.csv", import.meta.url), "utf8"));
const rows = recs.map((r) => ({ code: r.hscode, edition: "HS2022", description: r.description, parent: r.parent === "TOTAL" ? null : r.parent, level: Number(r.level), section: r.section }));
console.log(rows.length, "codes", a.dry ? "(dry run)" : "");
if (!a.dry) {
  const sb = client();
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from("hs_codes").upsert(rows.slice(i, i + 1000), { onConflict: "code" });
    if (error) throw error;
  }
  console.log("done");
}
