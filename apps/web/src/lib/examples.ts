/**
 * Worked examples for the guides. Computed from the real engine at build time so
 * the articles always show the same numbers as the calculator.
 */
import { buildRateTables, computeShipment, type LineResult, type Shipment } from "@landedmy/engine";

const rates = buildRateTables();
export const EXAMPLE_DATE = "2026-01-15";
export const EXAMPLE_FX = 5.0;

export interface ExampleInput {
  name: string;
  hs_code: string;
  volume_ml: number;
  abv: number;
  units_per_case: number;
  cases: number;
  unit_cost: number;
  /** Freight + insurance in EUR for the shipment. */
  freight_eur: number;
  /** Port, agent, haulage in RM for the shipment. */
  local_rm: number;
}

export function priceExample(x: ExampleInput): LineResult {
  const s: Shipment = {
    date: EXAMPLE_DATE,
    origin_iso: "BE",
    dest_port: "MYPKG",
    currency: "EUR",
    fx_rate: EXAMPLE_FX,
    incoterm: "EXW",
    freight: x.freight_eur,
    insurance: { amount: 0 },
    local_charges_myr: { total: x.local_rm },
    allocation: "volume",
    lines: [{ id: "l1", name: x.name, hs_code: x.hs_code, volume_ml: x.volume_ml, abv: x.abv, units_per_case: x.units_per_case, cases: x.cases, unit_cost: x.unit_cost }],
  };
  return computeShipment(s, rates).lines[0];
}

// One pallet of wine: 60 cases × 12 = 720 bottles. Freight+insurance €576 (= RM2,880 → RM4.00/bottle), local RM1,800.
export const WINE_BASE: ExampleInput = { name: "Still wine 13%", hs_code: "2204.21.11", volume_ml: 750, abv: 13, units_per_case: 12, cases: 60, unit_cost: 5, freight_eur: 576, local_rm: 1800 };
export const WINE_VARIANTS: { label: string; input: ExampleInput }[] = [
  { label: "€3 wine instead of €5", input: { ...WINE_BASE, unit_cost: 3 } },
  { label: "14.5% ABV instead of 13%", input: { ...WINE_BASE, abv: 14.5 } },
  { label: "Sparkling wine (RM23/L duty)", input: { ...WINE_BASE, name: "Sparkling 12%", hs_code: "2204.10.00", abv: 12 } },
  { label: "Full 20' container (10 pallets)", input: { ...WINE_BASE, cases: 600, freight_eur: 2400, local_rm: 4500 } },
];

// One pallet of lager: 168 cases × 24 = 4,032 cans. Freight+insurance €484 (→ RM0.60/can), local RM1,613 (→ RM0.40/can).
export const BEER_BASE: ExampleInput = { name: "Lager 5.0%", hs_code: "2203.00.91", volume_ml: 330, abv: 5, units_per_case: 24, cases: 168, unit_cost: 1, freight_eur: 483.84, local_rm: 1612.8 };
export const BEER_VARIANTS: { label: string; input: ExampleInput; date?: string }[] = [
  { label: "Abbey ale 8.0%, €1.50", input: { ...BEER_BASE, name: "Abbey ale 8%", hs_code: "2203.00.99", abv: 8, unit_cost: 1.5 } },
  { label: "Same lager, excise before 1 Nov 2025 (RM175)", input: BEER_BASE, date: "2025-10-15" },
  { label: "Same lager, full 20' container", input: { ...BEER_BASE, cases: 1680, freight_eur: 2016, local_rm: 4032 } },
  { label: "Cider 4.5%, €1.00 (RM7/L duty, RM66/L alc. excise)", input: { ...BEER_BASE, name: "Cider 4.5%", hs_code: "2206.00.10", abv: 4.5 } },
];

export function priceExampleOn(x: ExampleInput, date: string): LineResult {
  const s: Shipment = {
    date,
    origin_iso: "BE",
    dest_port: "MYPKG",
    currency: "EUR",
    fx_rate: EXAMPLE_FX,
    incoterm: "EXW",
    freight: x.freight_eur,
    insurance: { amount: 0 },
    local_charges_myr: { total: x.local_rm },
    allocation: "volume",
    lines: [{ id: "l1", name: x.name, hs_code: x.hs_code, volume_ml: x.volume_ml, abv: x.abv, units_per_case: x.units_per_case, cases: x.cases, unit_cost: x.unit_cost }],
  };
  return computeShipment(s, rates).lines[0];
}

export const rm2 = (n: number) => `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
