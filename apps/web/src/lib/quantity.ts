/**
 * How a non-drink product is counted. Drinks keep bottles × case × cases; everything else is a quantity in its own
 * unit (pieces, boxes of N, kg, litres, metres…). The engine still sees retail units: one piece, one kg, one litre,
 * and a "case" is one box, so per-unit and per-box results fall out of the same arithmetic.
 */
import type { ProductRow } from "./shipment";

export type Uom = "piece" | "set" | "pair" | "box" | "kg" | "litre" | "metre";

export const UOMS: { key: Uom; one: string; many: string }[] = [
  { key: "piece", one: "piece", many: "pieces" },
  { key: "set", one: "set", many: "sets" },
  { key: "pair", one: "pair", many: "pairs" },
  { key: "box", one: "box", many: "boxes" },
  { key: "kg", one: "kg", many: "kg" },
  { key: "litre", one: "litre", many: "litres" },
  { key: "metre", one: "metre", many: "metres" },
];
export const uomName = (u: Uom, n = 1) => {
  const x = UOMS.find((y) => y.key === u)!;
  return n === 1 ? x.one : x.many;
};

/** The unit a non-drink row is counted in (older saved rows had only units_per_case × cases). */
export function uomOf(r: ProductRow): Uom {
  return r.uom ?? (r.units_per_case > 1 ? "box" : "piece");
}

/** Sensible starting unit for a product, from its catalogue hint or HS code. */
export function defaultQuantity(hs6?: string, hint?: Uom): Pick<ProductRow, "uom" | "units_per_case" | "cases"> {
  const u = hint ?? uomForHs(hs6);
  if (u === "box") return { uom: "box", units_per_case: 100, cases: 10 };
  if (u === "kg" || u === "litre" || u === "metre") return { uom: u, units_per_case: 1, cases: 100 };
  return { uom: u, units_per_case: 1, cases: 1 };
}

function uomForHs(hs6?: string): Uom {
  if (!hs6) return "piece";
  const ch = Number(hs6.slice(0, 2));
  const h4 = Number(hs6.slice(0, 4));
  if (ch <= 24 && ch !== 22) return "kg"; // food and agriculture
  if (ch === 27) return "litre"; // fuels and oils
  if ([3208, 3209, 3403, 3814, 3819, 3820].includes(h4)) return "litre";
  if (h4 === 7318 || hs6 === "761610") return "box"; // fasteners
  if ((h4 >= 7201 && h4 <= 7229) || (h4 >= 7401 && h4 <= 7412) || (h4 >= 7501 && h4 <= 7508) || (h4 >= 7601 && h4 <= 7609) || (h4 >= 8101 && h4 <= 8113 && hs6 !== "810890")) return "kg"; // metals in primary forms
  if ((h4 >= 5007 && h4 <= 5516) || (h4 >= 5801 && h4 <= 5811) || (h4 >= 6001 && h4 <= 6006)) return "metre"; // fabrics
  if ((h4 === 8544 && hs6 !== "854430") || h4 === 4009 || h4 === 3917 || h4 === 7312 || h4 === 7217 || hs6 === "722300") return "metre"; // cable, hose, wire rope
  return "piece";
}

/** Engine fields for a non-drink row: cost per retail unit, retail units per "case", weight per retail unit. */
export function engineQuantity(r: ProductRow): { units_per_case: number; cases: number; unit_cost: number; weight_kg?: number; unit_label: string; pack_label?: string } {
  const u = uomOf(r);
  const pack = u === "box" ? Math.max(1, r.units_per_case) : 1;
  const w = u === "kg" ? 1 : r.weight_per_uom && r.weight_per_uom > 0 ? r.weight_per_uom / pack : undefined;
  return {
    units_per_case: pack,
    cases: r.cases,
    unit_cost: r.unit_cost / pack,
    weight_kg: w,
    unit_label: u === "box" ? "piece" : uomName(u),
    pack_label: u === "box" ? `box of ${pack}` : undefined,
  };
}

/** "20 boxes · 2,000 pieces · 400 kg" */
export function quantitySummary(r: ProductRow): string {
  const u = uomOf(r);
  const parts = [`${r.cases.toLocaleString()} ${uomName(u, r.cases)}`];
  if (u === "box") parts.push(`${(r.cases * r.units_per_case).toLocaleString()} pieces`);
  const kg = u === "kg" ? r.cases : r.weight_per_uom ? r.weight_per_uom * r.cases : 0;
  if (kg && u !== "kg") parts.push(`${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`);
  return parts.join(" · ");
}
