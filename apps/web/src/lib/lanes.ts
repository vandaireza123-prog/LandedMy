/**
 * Lane benchmarks and local-charge defaults. Sprint 1 values are placeholders to be
 * replaced with real quotes (logistics_benchmarks table) in Sprint 2. Every number
 * is labelled with its as-of date in the UI.
 */
export type Equipment =
  | "air" | "express" | "obc"
  | "pallet" | "lcl_cbm" | "breakbulk"
  | "20dc" | "40dc" | "40hc" | "45hc" | "20rf" | "40rf" | "20ot" | "40ot" | "20fr" | "40fr" | "isotank" | "roro"
  | "ftl" | "ltl" | "rail"
  | "post" | "ferry";

export type ModeGroup = "Air" | "Sea · shared" | "Sea · full container" | "Land" | "Other";
/** What the shipment is counted in for this mode (drives the field shown under the picker and the default local charges). */
export type ModeMeasure = "kg" | "pallets" | "cbm" | "containers" | "trucks" | "units" | "none";
export interface ModeInfo {
  label: string;
  group: ModeGroup;
  measure: ModeMeasure;
  /** Freight line label on the charges step. */
  freight: string;
  /** Local-charge profile used for the default destination charges. */
  profile: "lcl" | "fcl" | "air" | "express" | "road" | "rail" | "roro" | "post" | "ferry";
  /** Size factor for full-container / special equipment local charges (20' dry = 1). */
  size?: number;
}

export const MODES: Record<Equipment, ModeInfo> = {
  air: { label: "Air cargo", group: "Air", measure: "kg", freight: "Air freight", profile: "air" },
  express: { label: "Express courier", group: "Air", measure: "kg", freight: "Courier", profile: "express" },
  obc: { label: "On-board courier / AOG", group: "Air", measure: "kg", freight: "On-board courier", profile: "express" },
  pallet: { label: "LCL pallets", group: "Sea · shared", measure: "pallets", freight: "Sea freight (LCL)", profile: "lcl" },
  lcl_cbm: { label: "LCL by m³", group: "Sea · shared", measure: "cbm", freight: "Sea freight (LCL)", profile: "lcl" },
  breakbulk: { label: "Breakbulk", group: "Sea · shared", measure: "units", freight: "Sea freight (breakbulk)", profile: "fcl", size: 2 },
  "20dc": { label: "20' dry", group: "Sea · full container", measure: "containers", freight: "Sea freight", profile: "fcl", size: 1 },
  "40dc": { label: "40' dry", group: "Sea · full container", measure: "containers", freight: "Sea freight", profile: "fcl", size: 1.5 },
  "40hc": { label: "40' HC", group: "Sea · full container", measure: "containers", freight: "Sea freight", profile: "fcl", size: 1.5 },
  "45hc": { label: "45' HC", group: "Sea · full container", measure: "containers", freight: "Sea freight", profile: "fcl", size: 1.7 },
  "20rf": { label: "20' reefer", group: "Sea · full container", measure: "containers", freight: "Sea freight (reefer)", profile: "fcl", size: 1.2 },
  "40rf": { label: "40' reefer", group: "Sea · full container", measure: "containers", freight: "Sea freight (reefer)", profile: "fcl", size: 1.8 },
  "20ot": { label: "20' open top", group: "Sea · full container", measure: "containers", freight: "Sea freight (open top)", profile: "fcl", size: 1.4 },
  "40ot": { label: "40' open top", group: "Sea · full container", measure: "containers", freight: "Sea freight (open top)", profile: "fcl", size: 2 },
  "20fr": { label: "20' flat rack", group: "Sea · full container", measure: "containers", freight: "Sea freight (flat rack)", profile: "fcl", size: 1.6 },
  "40fr": { label: "40' flat rack", group: "Sea · full container", measure: "containers", freight: "Sea freight (flat rack)", profile: "fcl", size: 2.2 },
  isotank: { label: "ISO tank", group: "Sea · full container", measure: "containers", freight: "Sea freight (ISO tank)", profile: "fcl", size: 1.6 },
  roro: { label: "RoRo", group: "Sea · full container", measure: "units", freight: "Sea freight (RoRo)", profile: "roro" },
  ftl: { label: "Truck, full load", group: "Land", measure: "trucks", freight: "Road freight", profile: "road" },
  ltl: { label: "Truck, part load", group: "Land", measure: "pallets", freight: "Road freight", profile: "road" },
  rail: { label: "Rail", group: "Land", measure: "containers", freight: "Rail freight", profile: "rail" },
  post: { label: "Post / parcel", group: "Other", measure: "kg", freight: "Postage", profile: "post" },
  ferry: { label: "Ferry flight (aircraft flies itself)", group: "Other", measure: "none", freight: "Ferry flight (crew, fuel, permits)", profile: "ferry" },
};
export const MODE_GROUPS: ModeGroup[] = ["Air", "Sea · shared", "Sea · full container", "Land", "Other"];
/** Kept for older code paths: the short label of a mode. */
export const EQUIPMENT_LABEL: Record<Equipment, string> = Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.label])) as Record<Equipment, string>;
export const isEquipment = (x: unknown): x is Equipment => typeof x === "string" && x in MODES;

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

/**
 * Default destination charges in RM (Malaysian level), by how the goods arrive. `n` is the count the mode is
 * measured in (pallets, containers, trucks, units, m³ or kg). Labels are generic; the caller renames the customs line.
 */
export function localChargeProfile(equipment: Equipment, n: number): Record<string, number> {
  const m = MODES[equipment] ?? MODES.pallet;
  const k = Math.max(1, n);
  switch (m.profile) {
    case "lcl": {
      const p = equipment === "lcl_cbm" ? Math.max(1, Math.ceil(k / 1.5)) : k; // ~1.5 m³ per pallet
      return { "Port and terminal handling": 350 + 250 * p, "Customs clearance": 400, "Delivery to warehouse": 300 + 100 * p, Unstuffing: 100 * p };
    }
    case "fcl": {
      const f = (m.size ?? 1) * k;
      return { "Port and terminal handling": Math.round(1200 * f), "Customs clearance": 600, "Delivery to warehouse": Math.round(900 * f), Unstuffing: Math.round(300 * f) };
    }
    case "air":
      return { "Airport terminal handling": Math.round(150 + 0.6 * k), "Customs clearance": 450, "Delivery to warehouse": Math.round(200 + 0.25 * k) };
    case "express":
      return { "Courier clearance and disbursement": 80 };
    case "post":
      return { "Postal clearance fee": 20 };
    case "road":
      return { "Border clearance": 500, "Delivery to warehouse": 300 * (equipment === "ftl" ? k : 1) };
    case "rail":
      return { "Rail terminal handling": 900 * k, "Customs clearance": 600, "Delivery to warehouse": 900 * k };
    case "roro":
      return { "Port and terminal handling": 800 * k, "Customs clearance": 600 };
    case "ferry":
      return { "Customs clearance": 1500, "Airport, landing and parking": 2000 };
  }
}

/** Default local charges at Port Klang, RM. Editable by the user. */
export function defaultLocalCharges(equipment: Equipment, pallets: number): Record<string, number> {
  return localChargeProfile(equipment, pallets);
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
