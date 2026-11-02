import type { Shipment, ShipmentLine } from "@landedmy/engine";
import type { Category } from "./products";
import type { Equipment } from "./lanes";

export interface ProductRow extends ShipmentLine {
  category: Category;
  hs_confirmed: boolean;
  manual_duty_pct?: number;
  manual_sst_pct?: number;
  general_group?: string;
}

/** Everything the engine needs, without UI-only fields. */
export interface ShipmentSnapshot {
  origin_iso: string;
  origin_port: string;
  origin_label: string;
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
}

/** Pure: the engine input for a given app state. */
export function buildShipment(state: ShipmentSnapshot): Shipment {
  return {
    date: new Date().toISOString().slice(0, 10),
    origin_iso: state.origin_iso,
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
      hs_code: p.category === "general" && (!p.hs_code || p.hs_code === "MANUAL") ? `MANUAL-${p.id}` : p.hs_code,
      volume_ml: p.volume_ml,
      abv: p.abv,
      units_per_case: p.units_per_case,
      cases: p.cases,
      unit_cost: p.unit_cost,
      cases_per_pallet: p.cases_per_pallet,
    })),
  };
}

export function manualLinesOf(state: { products: ProductRow[] }) {
  return state.products
    .filter((p) => p.category === "general" && (!p.hs_code || p.hs_code === "MANUAL"))
    .map((p) => ({ hs_code: `MANUAL-${p.id}`, name: p.name, duty_pct: p.manual_duty_pct ?? 0, sst_pct: p.manual_sst_pct ?? 10 }));
}

