/**
 * Lane benchmarks and local-charge defaults. Sprint 1 values are placeholders to be
 * replaced with real quotes (logistics_benchmarks table) in Sprint 2. Every number
 * is labelled with its as-of date in the UI.
 */
export type Equipment = "pallet" | "20dc" | "40hc" | "20rf";

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  pallet: "Pallet (LCL)",
  "20dc": "20' dry",
  "40hc": "40' HC",
  "20rf": "20' reefer",
};

export interface FreightRange { low: number; high: number; currency: string }

/** Freight benchmarks keyed by origin port code (UN/LOCODE). Only lanes with numbers we trust. */
export const BENCHMARKS: Record<string, Partial<Record<Equipment, FreightRange>>> = {
  BEANR: { pallet: { low: 420, high: 520, currency: "EUR" }, "20dc": { low: 2100, high: 2700, currency: "EUR" }, "40hc": { low: 2900, high: 3600, currency: "EUR" }, "20rf": { low: 4200, high: 5200, currency: "EUR" } },
  NLRTM: { pallet: { low: 420, high: 520, currency: "EUR" }, "20dc": { low: 2100, high: 2700, currency: "EUR" }, "40hc": { low: 2900, high: 3600, currency: "EUR" }, "20rf": { low: 4200, high: 5200, currency: "EUR" } },
  DEHAM: { pallet: { low: 430, high: 540, currency: "EUR" }, "20dc": { low: 2200, high: 2800, currency: "EUR" }, "40hc": { low: 3000, high: 3700, currency: "EUR" }, "20rf": { low: 4300, high: 5300, currency: "EUR" } },
  FRLEH: { pallet: { low: 440, high: 560, currency: "EUR" }, "20dc": { low: 2200, high: 2900, currency: "EUR" }, "40hc": { low: 3000, high: 3800, currency: "EUR" }, "20rf": { low: 4300, high: 5400, currency: "EUR" } },
  FRMRS: { pallet: { low: 440, high: 560, currency: "EUR" }, "20dc": { low: 2200, high: 2900, currency: "EUR" }, "40hc": { low: 3000, high: 3800, currency: "EUR" }, "20rf": { low: 4300, high: 5400, currency: "EUR" } },
  ESBCN: { pallet: { low: 440, high: 560, currency: "EUR" }, "20dc": { low: 2200, high: 2900, currency: "EUR" }, "40hc": { low: 3000, high: 3800, currency: "EUR" }, "20rf": { low: 4300, high: 5400, currency: "EUR" } },
  ITGOA: { pallet: { low: 440, high: 560, currency: "EUR" }, "20dc": { low: 2200, high: 2900, currency: "EUR" }, "40hc": { low: 3000, high: 3800, currency: "EUR" }, "20rf": { low: 4300, high: 5400, currency: "EUR" } },
  GBFXT: { pallet: { low: 400, high: 500, currency: "GBP" }, "20dc": { low: 1900, high: 2500, currency: "GBP" }, "40hc": { low: 2600, high: 3300, currency: "GBP" }, "20rf": { low: 3800, high: 4800, currency: "GBP" } },
  AUMEL: { pallet: { low: 500, high: 650, currency: "AUD" }, "20dc": { low: 1600, high: 2200, currency: "AUD" }, "40hc": { low: 2200, high: 2900, currency: "AUD" }, "20rf": { low: 3400, high: 4300, currency: "AUD" } },
  AUADL: { pallet: { low: 520, high: 680, currency: "AUD" }, "20dc": { low: 1700, high: 2300, currency: "AUD" }, "40hc": { low: 2300, high: 3000, currency: "AUD" }, "20rf": { low: 3500, high: 4400, currency: "AUD" } },
  NZAKL: { pallet: { low: 650, high: 850, currency: "NZD" }, "20dc": { low: 2200, high: 2900, currency: "NZD" }, "40hc": { low: 3000, high: 3800, currency: "NZD" }, "20rf": { low: 4200, high: 5300, currency: "NZD" } },
  CNSHA: { pallet: { low: 180, high: 260, currency: "USD" }, "20dc": { low: 500, high: 900, currency: "USD" }, "40hc": { low: 800, high: 1300, currency: "USD" }, "20rf": { low: 1800, high: 2500, currency: "USD" } },
};

export function benchmarkFor(portCode: string, equipment: Equipment): FreightRange | undefined {
  return BENCHMARKS[portCode]?.[equipment];
}

export const BENCHMARK_AS_OF = "Oct 2026 · indicative, replace with your forwarder's quote";

/** Default local charges at Port Klang, RM. Editable by the user. */
export function defaultLocalCharges(equipment: Equipment, pallets: number): Record<string, number> {
  if (equipment === "pallet") {
    const n = Math.max(1, pallets);
    return {
      "Port and terminal handling": 350 + 250 * n,
      "Customs agent and K1": 400,
      "Haulage to Kuala Lumpur": 300 + 100 * n,
      Unstuffing: 100 * n,
    };
  }
  const base = equipment === "40hc" ? 1.5 : 1;
  return {
    "Port and terminal handling": Math.round(1200 * base),
    "Customs agent and K1": 600,
    "Haulage to Kuala Lumpur": Math.round(900 * base),
    Unstuffing: Math.round(300 * base),
  };
}

/** RMCD-style customs rates to MYR. Sprint 1: fixed table, user can override. */
export const FX_DEFAULT: Record<string, number> = {
  EUR: 5.0,
  USD: 4.3,
  GBP: 5.7,
  AUD: 2.86,
  NZD: 2.6,
  SGD: 3.3,
  CNY: 0.6,
  MYR: 1,
};
export const FX_AS_OF = "indicative — enter this week's RMCD customs rate";
