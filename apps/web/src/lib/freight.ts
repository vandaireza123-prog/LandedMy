/**
 * Freight estimates for every mode, any origin to any of 213 destinations.
 *
 * Sea: USD per 40' between 14 trade regions. Lanes marked "index" are anchored on published indices for the week
 * in FREIGHT_AS_OF (Drewry WCI, Freightos FBX, Xeneta, carrier FAK notices); the rest are rough estimates derived
 * from those lanes and shown as such. Air: TAC Index anchors (Hong Kong–North America, Asia–Europe,
 * Frankfurt–North America), otherwise a distance model calibrated on them. Courier: DHL Express 2026 retail card by
 * distance band. Road: per-km rates on great-circle distance × 1.25. Rail: China–Europe block-train range.
 * Modes with no usable public index (ISO tank, breakbulk, RoRo, on-board courier, ferry flight) get no number.
 */
import geo from "./freight-geo.json";
import wci from "./freight-index.json";
import type { Equipment } from "./lanes";
import { MODES } from "./lanes";

type Region = "EAS" | "SEA" | "SAS" | "MEG" | "MED" | "NEU" | "NAM" | "CAR" | "SAE" | "SAW" | "WAF" | "EAF" | "SAF" | "OCE" | "CAS";
type Geo = [number, number, Region, "AFEU" | "AM" | "", 0 | 1];
const G = geo as unknown as Record<string, Geo>;

/** Weekly Drewry WCI pull (scripts/refresh/freight.mjs). */
const IX = wci as { as_of: string; source: string; url: string; composite: number; base: { composite: number }; routes: Record<string, number> };
const fmtDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const FREIGHT_AS_OF = fmtDate(IX.as_of);
export const FREIGHT_SOURCE_URL = IX.url;
export const FREIGHT_AS_OF_ISO = IX.as_of;
/** How far the market has moved since the week the matrix and the other anchors were set (clamped). */
const MOVE = Math.min(2.5, Math.max(0.4, IX.composite / IX.base.composite));
const daysOld = (iso: string) => (Date.parse(IX.as_of) - Date.parse(iso)) / 86400000;

export const REGION_NAME: Record<Region, string> = {
  EAS: "East Asia", SEA: "Southeast Asia", SAS: "South Asia", MEG: "Middle East / Gulf", MED: "Mediterranean & Black Sea", NEU: "North Europe",
  NAM: "North America", CAR: "Caribbean & Central America", SAE: "South America east coast", SAW: "South America west coast",
  WAF: "West & Central Africa", EAF: "East Africa", SAF: "Southern Africa", OCE: "Oceania", CAS: "Central Asia",
};

const R: Region[] = ["EAS", "SEA", "SAS", "MEG", "MED", "NEU", "NAM", "CAR", "SAE", "SAW", "WAF", "EAF", "SAF", "OCE"];
/** USD per 40' dry, mid of market, rows = from, columns = to (order of R). */
const SEA_FEU: number[][] = [
  /* EAS */ [1100, 1500, 2200, 8000, 4250, 3650, 8400, 6000, 5150, 4800, 5500, 4500, 5000, 5000],
  /* SEA */ [900, 900, 1800, 7000, 4300, 3800, 8000, 6200, 5300, 5000, 5300, 4200, 4500, 3800],
  /* SAS */ [1200, 1300, 900, 3500, 4900, 4800, 6500, 6000, 5500, 5800, 4000, 2800, 3500, 3500],
  /* MEG */ [1500, 1500, 1500, 1200, 3000, 3000, 5000, 5500, 5000, 5500, 4000, 2500, 3000, 3500],
  /* MED */ [900, 1300, 2000, 3500, 1000, 1300, 3300, 3200, 1500, 2800, 2200, 3000, 2600, 3500],
  /* NEU */ [700, 1100, 1500, 3200, 1200, 900, 3000, 2800, 900, 2400, 2400, 3000, 2500, 3200],
  /* NAM */ [850, 1300, 1800, 3500, 1700, 1200, 1500, 1800, 2500, 2200, 3000, 4000, 3200, 2500],
  /* CAR */ [1200, 1500, 2200, 3500, 1800, 1500, 1300, 1500, 2000, 1800, 3000, 4000, 3500, 3000],
  /* SAE */ [1500, 1800, 2500, 3500, 1800, 1800, 3000, 2200, 1200, 2000, 2500, 3000, 2200, 3000],
  /* SAW */ [1500, 1800, 2600, 3800, 2200, 2000, 2200, 1800, 2000, 1200, 3200, 3800, 3200, 2600],
  /* WAF */ [1200, 1500, 2000, 3000, 1800, 1800, 2500, 2800, 2500, 3000, 1500, 3000, 2000, 3500],
  /* EAF */ [1200, 1400, 1500, 2000, 2500, 2500, 3500, 3800, 3000, 3800, 3000, 1200, 1500, 3000],
  /* SAF */ [1200, 1500, 1800, 2500, 2200, 2000, 2800, 3200, 2200, 3000, 1800, 1500, 1000, 2500],
  /* OCE */ [1100, 1200, 2000, 3200, 3000, 2800, 2500, 3000, 3200, 2800, 3800, 3200, 2600, 1500],
];

interface Anchor { low: number; high: number; src: string }
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const W = IX.routes;
const wciSrc = (t: string) => `Drewry WCI ${t} (${FREIGHT_AS_OF})`;
/** Other published lanes, set by hand with their date; scaled with the WCI composite once they are older than the WCI week. */
const MANUAL: Record<string, Anchor & { date: string }> = {
  "EAS>SAE": { low: 5050, high: 5250, date: "2026-10-28", src: "Xeneta Far East–South America east coast $5,211 (28 Oct 2026)" },
  "NEU>SAE": { low: 850, high: 1000, date: "2026-10-28", src: "Xeneta North Europe–South America east coast $921 (28 Oct 2026)" },
  "EAS>SEA": { low: 1200, high: 1800, date: "2026-10-29", src: "Drewry Intra-Asia Container Index $1,504 (29 Oct 2026)" },
  "EAS>MEG": { low: 7500, high: 8600, date: "2026-10-15", src: "Shanghai–Jebel Ali $8,584 (Oct 2026, Bertling market report)" },
  "EAS>OCE": { low: 4500, high: 5700, date: "2026-09-30", src: "China–Australia carrier tariffs ~$5,500–5,700 per 40' HC (Sep 2026)" },
  "SAS>NEU": { low: 4650, high: 4950, date: "2026-08-01", src: "MSC FAK India/Pakistan–Antwerp $4,650–4,950 per 40' (2026)" },
  "SAS>MED": { low: 4750, high: 5050, date: "2026-08-01", src: "MSC FAK India/Pakistan–Valencia $4,750–5,050 per 40' (2026)" },
};
/** Lanes with a published number behind them (USD per 40'). WCI lanes move every week with the refresh. */
const SEA_INDEX: Record<string, Anchor & { tier: "index" | "rough" }> = {
  "EAS>NEU": { low: W["SHA-RTM"] * 0.97, high: W["SHA-RTM"] * 1.04, tier: "index", src: wciSrc(`Shanghai–Rotterdam ${usd(W["SHA-RTM"])}`) },
  "EAS>MED": { low: W["SHA-GOA"] * 0.97, high: W["SHA-GOA"] * 1.06, tier: "index", src: wciSrc(`Shanghai–Genoa ${usd(W["SHA-GOA"])}`) },
  "EAS>NAM": { low: Math.min(W["SHA-LAX"], W["SHA-NYC"]) * 0.98, high: Math.max(W["SHA-LAX"], W["SHA-NYC"]) * 1.06, tier: "index", src: wciSrc(`Shanghai–Los Angeles ${usd(W["SHA-LAX"])}, Shanghai–New York ${usd(W["SHA-NYC"])}`) },
  "NEU>EAS": { low: W["RTM-SHA"] * 0.92, high: W["RTM-SHA"] * 1.35, tier: "index", src: wciSrc(`Rotterdam–Shanghai ${usd(W["RTM-SHA"])}`) },
  "NAM>EAS": { low: W["LAX-SHA"] * 0.92, high: W["LAX-SHA"] * 1.25, tier: "index", src: wciSrc(`Los Angeles–Shanghai ${usd(W["LAX-SHA"])}`) },
  "NEU>NAM": { low: W["RTM-NYC"] * 0.95, high: W["RTM-NYC"] * 1.05, tier: "index", src: wciSrc(`Rotterdam–New York ${usd(W["RTM-NYC"])}`) },
  "NAM>NEU": { low: W["NYC-RTM"] * 0.94, high: W["NYC-RTM"] * 1.12, tier: "index", src: wciSrc(`New York–Rotterdam ${usd(W["NYC-RTM"])}`) },
  ...Object.fromEntries(
    Object.entries(MANUAL).map(([k, m]) => {
      const age = daysOld(m.date);
      if (age <= 45) return [k, { ...m, tier: "index" as const }];
      // older than the WCI week by more than ~6 weeks: move it with the market and call it rough
      return [k, { low: m.low * MOVE, high: m.high * MOVE * 1.1, tier: "rough" as const, src: `${m.src}, moved with the WCI composite since` }];
    }),
  ),
};

/** Container size and type relative to a 40' dry. */
const BOX: Partial<Record<Equipment, { f: number; extra: number; note?: string }>> = {
  "20dc": { f: 0.62, extra: 0 },
  "40dc": { f: 1, extra: 0 },
  "40hc": { f: 1, extra: 0 },
  "45hc": { f: 1.15, extra: 0 },
  "20rf": { f: 0.75, extra: 1200, note: "Reefer: dry rate plus a reefer premium; varies a lot by carrier and season." },
  "40rf": { f: 1.15, extra: 1800, note: "Reefer: dry rate plus a reefer premium; varies a lot by carrier and season." },
  "20ot": { f: 0.8, extra: 300, note: "Open top: special equipment; out-of-gauge cargo adds surcharges." },
  "40ot": { f: 1.3, extra: 500, note: "Open top: special equipment; out-of-gauge cargo adds surcharges." },
  "20fr": { f: 1.0, extra: 600, note: "Flat rack: out-of-gauge cargo is priced per lost slot; treat as a rough guide." },
  "40fr": { f: 1.6, extra: 900, note: "Flat rack: out-of-gauge cargo is priced per lost slot; treat as a rough guide." },
};

export interface FreightInput {
  from: string;
  to: string;
  mode: Equipment;
  /** containers, trucks, pallets — whatever the mode counts */
  count: number;
  /** chargeable weight of the shipment, if known */
  kg: number | null;
  cbm?: number;
  pallets?: number;
}
export type FreightEstimate =
  | { ok: true; low: number; high: number; currency: "USD"; tier: "index" | "rough"; basis: string; note?: string }
  | { ok: false; reason: string };

const km = (a: Geo, b: Geo) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
/** Central Asia is landlocked: reached via Chinese ports from Asia, via the Black Sea from everywhere else. */
const seaRegion = (r: Region, other: Region): Region => (r === "CAS" ? (other === "EAS" || other === "SEA" || other === "CAS" ? "EAS" : "MED") : r);
const round = (n: number) => (n >= 1000 ? Math.round(n / 50) * 50 : n >= 100 ? Math.round(n / 5) * 5 : Math.round(n));
const est = (lo: number, hi: number, tier: "index" | "rough", basis: string, note?: string): FreightEstimate => ({ ok: true, low: round(lo), high: round(Math.max(hi, lo)), currency: "USD", tier, basis, note });

/** Sea rate per 40' dry between two countries, with the range and where it comes from. */
export function seaFeu(from: string, to: string): { low: number; high: number; tier: "index" | "rough"; basis: string; inland: boolean } | null {
  const a = G[from], b = G[to];
  if (!a || !b) return null;
  const ra = seaRegion(a[2], b[2]), rb = seaRegion(b[2], a[2]);
  const inland = !!(a[4] || b[4] || a[2] === "CAS" || b[2] === "CAS");
  const ix = SEA_INDEX[`${ra}>${rb}`];
  let lo: number, hi: number, tier: "index" | "rough", basis: string;
  if (ix) {
    [lo, hi, tier, basis] = [ix.low, ix.high, ix.tier, ix.src];
  } else {
    const mid = SEA_FEU[R.indexOf(ra)][R.indexOf(rb)] * MOVE;
    [lo, hi, tier, basis] = [mid * 0.75, mid * 1.35, "rough", `Rough estimate for ${REGION_NAME[ra]} → ${REGION_NAME[rb]}, set from the published lanes and moved with the Drewry WCI composite (${usd(IX.composite)}, ${FREIGHT_AS_OF})`];
  }
  if (inland) {
    // Landlocked end: add inland haulage or rail from the nearest seaport.
    lo += 800;
    hi += 2500;
    tier = "rough";
    basis = `${basis}, plus a rough inland allowance to or from the nearest seaport`;
  }
  return { low: lo, high: hi, tier, basis, inland };
}

/** Air rate per kg (USD). */
function airPerKg(from: string, to: string): { low: number; high: number; tier: "index" | "rough"; basis: string } | null {
  const a = G[from], b = G[to];
  if (!a || !b) return null;
  const ra = a[2], rb = b[2];
  const asia = (r: Region) => r === "EAS" || r === "SEA";
  const europe = (r: Region) => r === "NEU" || r === "MED";
  if (asia(ra) && rb === "NAM") return { low: 6.3, high: 7.7, tier: "index", basis: "TAC Index Hong Kong–North America $7.02/kg (Sep 2026)" };
  if (asia(ra) && europe(rb)) return { low: 4.6, high: 5.8, tier: "index", basis: "TAC Index Hong Kong–Europe $4.80/kg (Sep 2026), Asia–Europe $5.79 (Apr 2026)" };
  if (europe(ra) && rb === "NAM") return { low: 2.5, high: 3.1, tier: "index", basis: "TAC Index Frankfurt–North America $2.81/kg (Apr 2026)" };
  const K: Record<Region, number> = { EAS: 1.9, SEA: 1.7, SAS: 1.6, MEG: 1.3, NEU: 1.25, MED: 1.25, CAS: 1.5, NAM: 1.0, CAR: 1.2, SAE: 1.3, SAW: 1.3, WAF: 1.4, EAF: 1.4, SAF: 1.3, OCE: 1.3 };
  const d = Math.max(500, km(a, b));
  const mid = K[ra] * (1 + d / 5000);
  return { low: mid * 0.7, high: mid * 1.4, tier: "rough", basis: `Rough estimate from distance (${Math.round(d / 100) * 100} km), calibrated on TAC Index lanes` };
}

/** Courier price for a shipment of `kg`, USD (retail high, typical account low). */
function courier(from: string, to: string, kg: number): { low: number; high: number } {
  const a = G[from], b = G[to];
  const d = a && b ? km(a, b) : 8000;
  const remote = (r?: Region) => !!r && ["WAF", "EAF", "SAF", "CAR", "SAE", "SAW", "CAS"].includes(r);
  const sameRegion = a && b && a[2] === b[2];
  let base: number, perKg: number;
  if (d <= 2500 || sameRegion) [base, perKg] = [97, 4.0];
  else if (remote(a?.[2]) || remote(b?.[2])) [base, perKg] = [270, 10];
  else if (d <= 8000) [base, perKg] = [120, 8.5];
  else [base, perKg] = [130, 12];
  const high = base + perKg * Math.max(0.5, kg);
  return { low: high * 0.45, high };
}

/** Freight for the whole shipment in USD, or why there is no number. */
export function estimateFreight(i: FreightInput): FreightEstimate {
  const { from, to, mode } = i;
  if (!G[from] || !G[to]) return { ok: false, reason: "No location data for this origin or destination yet." };
  if (from === to) return { ok: false, reason: "Origin and destination are the same country: enter your domestic transport cost." };
  const n = Math.max(1, i.count || 1);
  const m = MODES[mode];
  const a = G[from], b = G[to];

  if (BOX[mode]) {
    const s = seaFeu(from, to)!;
    const bx = BOX[mode]!;
    const tier = bx.note && mode !== "20rf" && mode !== "40rf" ? "rough" : s.tier;
    const note = bx.note;
    return est((s.low * bx.f + bx.extra) * n, (s.high * bx.f + bx.extra) * n, tier, `${m.label} × ${n}: ${s.basis}`, note);
  }
  if (mode === "pallet" || mode === "lcl_cbm") {
    const s = seaFeu(from, to)!;
    const cbm = Math.max(1, mode === "pallet" ? (i.pallets ?? n) * 1.5 : i.cbm ?? n, (i.kg ?? 0) / 1000);
    // LCL ocean per m³ ≈ 1/36 of the 40' rate (Shanghai–LA board, Nov 2026), plus origin CFS and documentation.
    const perCbm = (feu: number) => feu / 36 + 60;
    return est(perCbm(s.low) * cbm + 50, perCbm(s.high) * cbm * 1.2 + 100, "rough", `${Math.round(cbm * 10) / 10} m³ (greater of volume or tonnes) at about 1/36 of the 40' rate plus origin CFS: ${s.basis}`);
  }
  if (mode === "air") {
    if (!i.kg) return { ok: false, reason: "Add a weight per item on step 1 (or chargeable kg on step 2) to estimate air freight." };
    const r = airPerKg(from, to)!;
    const kg = Math.max(i.kg, 45);
    return est(Math.max(120, r.low * kg + 0.25 * kg), Math.max(180, r.high * kg + 0.35 * kg), r.tier, `${Math.round(i.kg).toLocaleString()} kg chargeable × $${r.low.toFixed(2)}–${r.high.toFixed(2)}/kg plus airport fees: ${r.basis}`, "Chargeable weight is the greater of actual kg and volume (cm³ ÷ 6,000).");
  }
  if (mode === "express" || mode === "post") {
    if (!i.kg) return { ok: false, reason: "Add a weight per item on step 1 to estimate the courier price." };
    if (mode === "post" && i.kg > 30) return { ok: false, reason: "Most postal services stop at 30 kg per parcel; use courier or air cargo." };
    const c = courier(from, to, i.kg);
    if (mode === "post") return est(c.high * 0.3, c.high * 0.6, "rough", `Postal parcel, ${i.kg} kg: rough, about a third to two thirds of the courier retail price`);
    return est(c.low, c.high, "rough", `Courier, ${i.kg} kg, from the DHL Express 2026 retail card by distance; the low end is a typical business-account discount`, "Fuel surcharge included; remote-area and oversize fees are extra.");
  }
  if (mode === "ftl" || mode === "ltl") {
    if (!a[3] || a[3] !== b[3]) return { ok: false, reason: "No road connection between these countries; pick sea or air." };
    const d = km(a, b) * 1.25;
    if (d > 7000) return { ok: false, reason: "Over 7,000 km by road; sea or rail is usually used. Enter a quote if you truck it." };
    const perKm = a[2] === "NEU" || a[2] === "MED" ? 2.0 : a[2] === "NAM" ? 1.6 : 1.3;
    const ftl = Math.max(600, d * perKm);
    const basis = `About ${Math.round(d / 10) * 10} km by road at ~$${perKm.toFixed(2)}/km (spot level), country centre to centre`;
    if (mode === "ftl") return est(ftl * 0.75 * n, ftl * 1.3 * n + 300 * n, "rough", `${n} truck${n > 1 ? "s" : ""}: ${basis}`, "Border waiting, tolls and permits vary; ferry crossings are extra.");
    const p = Math.max(1, i.pallets ?? n);
    const share = Math.min(1, (p / 33) * 2.2);
    return est(ftl * share * 0.75 + 80, ftl * share * 1.3 + 150, "rough", `${p} pallet${p > 1 ? "s" : ""} of a 33-pallet truck, part-load premium: ${basis}`);
  }
  if (mode === "rail") {
    const asia = (g: Geo) => g[2] === "EAS" || g[2] === "CAS";
    const europe = (g: Geo) => g[2] === "NEU" || (g[2] === "MED" && g[0] >= 36 && g[1] >= -10 && g[1] <= 45);
    if ((asia(a) && europe(b)) || (asia(b) && europe(a))) {
      return est(7000 * n, 10000 * n, "rough", `China–Europe block train, $7,000–10,000 per 40' (2026 forwarder ranges) × ${n}`, "Border and last-mile delivery are often extra.");
    }
    return { ok: false, reason: "No regular rail service priced for this route; enter a quote." };
  }
  const why: Partial<Record<Equipment, string>> = {
    isotank: "ISO tank operators quote door to door per tank; no public index. Enter a quote.",
    breakbulk: "Breakbulk is priced per freight tonne by charter or liner quote; enter a quote.",
    roro: "RoRo is priced per unit by size (lane metres or m³); enter a quote.",
    obc: "On-board courier is priced per trip (flights, courier time, excess baggage); enter a quote.",
    ferry: "A ferry flight is priced by the ferry pilot company (crew, fuel, permits, insurance); enter a quote.",
  };
  return { ok: false, reason: why[mode] ?? "No estimate for this mode; enter a quote." };
}

// ---- In the shipment's currency, from the app state ----
import { FX_MYR } from "./country";
import { modeCount, shipmentKg, type ProductRow } from "./shipment";

export interface FreightView {
  ok: true;
  low: number;
  high: number;
  mid: number;
  currency: string;
  tier: "index" | "rough";
  basis: string;
  note?: string;
}
type StateLike = { origin_iso: string; dest_country: string; equipment: Equipment; pallets: number; products: ProductRow[]; mode_qty?: number; cbm?: number; chargeable_kg?: number; currency: string; incoterm?: string };

/** EXW: collection from the supplier and export clearance at origin, USD, by how the goods travel. */
function exwOrigin(mode: Equipment, count: number, kg: number | null): [number, number] | null {
  const p = MODES[mode]?.profile;
  if (p === "lcl") return [150, 320];
  if (p === "fcl" && BOX[mode]) return [350 * count, 650 * count];
  if (p === "air") return [90 + 0.05 * (kg ?? 0), 220 + 0.12 * (kg ?? 0)];
  return null;
}

export function freightFor(s: StateLike, mode: Equipment = s.equipment): FreightView | { ok: false; reason: string } {
  const st = { ...s, equipment: mode };
  const kg = s.chargeable_kg ?? shipmentKg(s.products);
  const e = estimateFreight({ from: s.origin_iso, to: s.dest_country, mode, count: modeCount(st), kg: kg || null, cbm: s.cbm, pallets: s.pallets });
  if (!e.ok) return e;
  let { low: lo, high: hi, basis } = e;
  if ((s.incoterm ?? "EXW") === "EXW") {
    const o = exwOrigin(mode, modeCount(st), kg || null);
    if (o) {
      lo += o[0];
      hi += o[1];
      basis += `. Plus pickup at the supplier and export clearance (EXW), about $${Math.round(o[0])}–${Math.round(o[1])}`;
    }
  }
  const usd = (FX_MYR.USD ?? 4.2) / (FX_MYR[s.currency] ?? FX_MYR.USD ?? 4.2);
  const conv = (v: number) => {
    const x = v * usd;
    return x >= 1000 ? Math.round(x / 10) * 10 : Math.round(x);
  };
  return { ok: true, low: conv(lo), high: conv(hi), mid: conv((lo + hi) / 2), currency: s.currency, tier: e.tier, basis, note: e.note };
}
