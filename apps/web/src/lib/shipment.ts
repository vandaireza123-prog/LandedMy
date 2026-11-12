import { GENERAL_LINES, SUPPORTED_COUNTRIES, destination, genericRates, manualRates, mergeRates, ratesFor, withoutFta, type RateTables, type Shipment, type ShipmentLine } from "@landedmy/engine";

/** A general-goods line prices from a national row only when its code is one we have; anything else is user-rated. */
export function isManualLine(p: ProductRow, country: string = "MY"): boolean {
  // The general-goods tariff lines are Malaysian rows: anywhere else a non-drink line is always rated per line.
  return p.category === "general" && (country !== "MY" || !p.hs_code || p.hs_code === "MANUAL" || !GENERAL_LINES.some((g) => g.hs_code === p.hs_code));
}
import type { Category } from "./products";
import { engineQuantity } from "./quantity";
import { MODES } from "./lanes";
import type { Equipment } from "./lanes";
import type { DestCountry } from "./country";

export interface ProductRow extends ShipmentLine {
  category: Category;
  hs_confirmed: boolean;
  manual_duty_pct?: number;
  manual_sst_pct?: number;
  general_group?: string;
  /** Universal HS 2022 six-digit code and its description, when the product came from the world HS search. */
  hs6?: string;
  hs6_desc?: string;
  /** Where the duty % came from when pre-filled ("WTO MFN 2024 · indicative"); "you" when typed. */
  duty_source?: string;
  /** "DEST:ORIGIN:HS6" the duty % applies to; a different route or code clears it. */
  duty_for?: string;
  /** Extra duties flagged by the rates API (e.g. US chapter 99 for this origin) — shown, not priced. */
  duty_notes?: string[];
  /** Where the customs code came from when picked from a part catalogue ("Aircraft and helicopter parts · Landing gear"). */
  code_source?: string;
  /** Classification note from the catalogue (why this heading, exceptions). */
  code_note?: string;
  /** True when customs administrations classify this item differently — the user should confirm. */
  code_check?: boolean;
  /** Non-drink goods: what the quantity counts (cases = quantity; units_per_case = pieces per box when "box"). unit_cost is per this unit. */
  uom?: import("./quantity").Uom;
  /** Optional gross weight of one unit of `uom` in kg (ignored for kg). */
  weight_per_uom?: number;
}

/** Everything the engine needs, without UI-only fields. */
export interface ShipmentSnapshot {
  origin_iso: string;
  origin_port: string;
  origin_label: string;
  dest_country?: DestCountry;
  dest_port: string;
  equipment: Equipment;
  pallets: number;
  incoterm: Shipment["incoterm"];
  currency: string;
  fx_rate: number;
  fx_source: string;
  forwarder_quote: number;
  freight: number;
  insurance_pct: number;
  local_charges: Record<string, number>;
  local_touched: boolean;
  products: ProductRow[];
  sell_price: number;
  fta_claim?: boolean;
}

/** Total gross weight of the products in kg, when every product has one (drinks estimated at 1.5 kg per litre). */
export function shipmentKg(products: ProductRow[]): number | null {
  let kg = 0;
  for (const p of products) {
    if (p.category !== "general") kg += (p.volume_ml / 1000) * p.units_per_case * p.cases * 1.5;
    else {
      const q = engineQuantity(p);
      if (!q.weight_kg) return null;
      kg += q.weight_kg * q.units_per_case * q.cases;
    }
  }
  return Math.round(kg * 10) / 10;
}

/** The count the chosen mode is measured in (pallets, containers, m³, kg…), for default charges and benchmarks. */
export function modeCount(s: Pick<ShipmentSnapshot, "equipment" | "pallets" | "products"> & { mode_qty?: number; cbm?: number; chargeable_kg?: number }): number {
  const m = MODES[s.equipment]?.measure ?? "pallets";
  if (m === "pallets") return Math.max(1, s.pallets);
  if (m === "cbm") return Math.max(0.1, s.cbm ?? 1);
  if (m === "kg") return Math.max(1, s.chargeable_kg ?? shipmentKg(s.products) ?? 100);
  if (m === "none") return 1;
  return Math.max(1, s.mode_qty ?? 1);
}

/** Pure: the engine input for a given app state. */
export function buildShipment(state: ShipmentSnapshot): Shipment {
  return {
    date: new Date().toISOString().slice(0, 10),
    origin_iso: state.origin_iso,
    dest_country: state.dest_country ?? "MY",
    dest_port: state.dest_port,
    currency: state.currency,
    fx_rate: state.fx_rate,
    incoterm: state.incoterm,
    freight: state.freight,
    insurance: { pct_of_goods: state.insurance_pct },
    local_charges_myr: state.local_charges,
    allocation: "volume",
    lines: state.products.map((p) => ({
      id: p.id,
      name: p.name,
      hs_code: isManualLine(p, state.dest_country ?? "MY") ? `MANUAL-${p.id}` : p.hs_code,
      volume_ml: p.volume_ml,
      abv: p.abv,
      units_per_case: p.units_per_case,
      cases: p.cases,
      unit_cost: p.unit_cost,
      cases_per_pallet: p.cases_per_pallet,
      duty_pct: p.manual_duty_pct,
      ...(p.category === "general" ? engineQuantity(p) : {}),
    })),
  };
}

export function isExactDestination(country?: string): boolean {
  return country === undefined || SUPPORTED_COUNTRIES.includes(country);
}

/**
 * The rate tables for a snapshot: national schedule (+ user-entered lines) for MY/SG,
 * indicative tables (standard tax + per-line duty %) for every other registered destination.
 */
export function tablesFor(state: ShipmentSnapshot): RateTables {
  const country = state.dest_country ?? "MY";
  let t: RateTables;
  if (isExactDestination(country)) {
    // User-rated lines: Malaysia lets the user pick the SST band (0/5/10); other schedules apply their single standard rate.
    const taxPct = country === "MY" ? undefined : destination(country).tax_pct;
    t = mergeRates(ratesFor(country), ...manualLinesOf(state, country).map((m) => ({ ...manualRates(m.hs_code, m.name, m.duty_pct, taxPct ?? m.sst_pct), country })));
  } else {
    t = genericRates(
      country,
      state.products.map((p) => ({ hs_code: isManualLine(p, country) ? `MANUAL-${p.id}` : p.hs_code, name: p.name, duty_pct: p.manual_duty_pct })),
    );
  }
  return state.fta_claim === false ? withoutFta(t) : t;
}

export function manualLinesOf(state: { products: ProductRow[]; dest_country?: string }, country: string = state.dest_country ?? "MY") {
  return state.products
    .filter((p) => isManualLine(p, country))
    .map((p) => ({ hs_code: `MANUAL-${p.id}`, name: p.name, duty_pct: p.manual_duty_pct ?? 0, sst_pct: p.manual_sst_pct ?? 10 }));
}

