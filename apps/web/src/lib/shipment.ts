import { GENERAL_LINES, SUPPORTED_COUNTRIES, destination, genericRates, manualRates, mergeRates, ratesFor, withoutFta, type RateTables, type Shipment, type ShipmentLine } from "@landedmy/engine";

/** A general-goods line prices from a national row only when its code is one we have; anything else is user-rated. */
export function isManualLine(p: ProductRow): boolean {
  return p.category === "general" && (!p.hs_code || p.hs_code === "MANUAL" || !GENERAL_LINES.some((g) => g.hs_code === p.hs_code));
}
import type { Category } from "./products";
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
  /** Where the duty % came from when pre-filled ("WTO MFN 2024 · indicative"); cleared when the user types. */
  duty_source?: string;
  /** Extra duties flagged by the rates API (e.g. US chapter 99 for this origin) — shown, not priced. */
  duty_notes?: string[];
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
      hs_code: isManualLine(p) ? `MANUAL-${p.id}` : p.hs_code,
      volume_ml: p.volume_ml,
      abv: p.abv,
      units_per_case: p.units_per_case,
      cases: p.cases,
      unit_cost: p.unit_cost,
      cases_per_pallet: p.cases_per_pallet,
      duty_pct: p.manual_duty_pct,
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
    t = mergeRates(ratesFor(country), ...manualLinesOf(state).map((m) => ({ ...manualRates(m.hs_code, m.name, m.duty_pct, taxPct ?? m.sst_pct), country })));
  } else {
    t = genericRates(
      country,
      state.products.map((p) => ({ hs_code: isManualLine(p) ? `MANUAL-${p.id}` : p.hs_code, name: p.name, duty_pct: p.manual_duty_pct })),
    );
  }
  return state.fta_claim === false ? withoutFta(t) : t;
}

export function manualLinesOf(state: { products: ProductRow[] }) {
  return state.products
    .filter(isManualLine)
    .map((p) => ({ hs_code: `MANUAL-${p.id}`, name: p.name, duty_pct: p.manual_duty_pct ?? 0, sst_pct: p.manual_sst_pct ?? 10 }));
}

