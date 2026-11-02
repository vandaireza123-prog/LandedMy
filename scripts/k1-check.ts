import { readFileSync } from "node:fs";
import { buildRateTables, computeShipment } from "../packages/engine/src/index.js";
for (const f of ["RD2609L00119-au-wine", "RD2606L00016-fr-wine"]) {
  const fx = JSON.parse(readFileSync(new URL(`../packages/engine/fixtures/k1/${f}.json`, import.meta.url), "utf8"));
  const r = computeShipment(fx.shipment, buildRateTables());
  const t = fx.k1_totals;
  console.log(`\n${fx.name}`);
  console.table({
    "CIF value": { K1: t.cif, Engine: r.totals.cif },
    "Import duty": { K1: t.duty, Engine: r.totals.duty },
    "Excise": { K1: t.excise, Engine: r.totals.excise },
    "SST": { K1: t.sst, Engine: r.totals.sst },
    "Total payable": { K1: t.total_payable, Engine: +(r.totals.duty + r.totals.excise + r.totals.sst).toFixed(2) },
  });
}
