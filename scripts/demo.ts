// Prints the plan's worked example through the engine. Run: npx tsx scripts/demo.ts
import { readFileSync } from "node:fs";
import { buildRateTables, computeShipment } from "../packages/engine/src/index.js";

const fx = JSON.parse(
  readFileSync(new URL("../packages/engine/fixtures/shipments/01-wine-5eur-pallet.json", import.meta.url), "utf8"),
);
const r = computeShipment(fx.shipment, buildRateTables());
const l = r.lines[0];

console.log(`\n${fx.name}\n`);
console.table({
  "Goods (€5 × 5.00)": l.per_unit.goods,
  "Freight + insurance": l.per_unit.freight_insurance,
  CIF: l.per_unit.cif,
  "Import duty (0.75L × RM7)": l.per_unit.duty,
  "Excise (0.75L × 13% × RM165)": l.per_unit.excise,
  "SST 10% on CIF+duty+excise": l.per_unit.sst,
  "Port, agent, haulage": l.per_unit.local_charges,
  "LANDED per bottle": l.per_unit.landed,
});
console.log(`Per case: RM${l.per_case}   Per pallet: RM${l.per_pallet}   Shipment: RM${r.totals.landed}   Tax share: ${l.tax_share_pct}%`);
console.log(`Excise source: ${l.rates_used.excise?.source_doc} (effective ${l.rates_used.excise?.effective_from})\n`);
