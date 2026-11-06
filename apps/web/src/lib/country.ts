/**
 * Destination-country presentation: currency symbol, tax name, ports, default local charges,
 * verification status. Rates themselves live in the engine (ratesFor(country)).
 */
import { DESTINATIONS, type Destination } from "@landedmy/engine";
import type { Equipment } from "./lanes";

/** ISO-2 destination code; "MY" and "SG" have national schedules, the rest are indicative. */
export type DestCountry = string;
export type Tier = "verified" | "official" | "indicative";

export interface CountryInfo {
  code: DestCountry;
  name: string;
  currency: string;
  symbol: string;
  tax_name: string;
  tax_desc: string;
  tax_pct: number;
  tier: Tier;
  /** K1 / permit verified against real declarations. */
  verified: boolean;
  /** Official tariff lookup for this country. */
  lookup: string;
  duty_default_pct?: number;
  region: string;
  verify_note: string;
  customs_name: string;
  ports: { code: string; label: string }[];
  rates_note: string;
  fx_note: string;
}

const NATIONAL: Record<"MY" | "SG", CountryInfo> = {
  MY: {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    symbol: "RM",
    tax_name: "SST",
    tax_desc: "SST 10% on CIF + duty + excise",
    tax_pct: 10,
    tier: "verified",
    lookup: "https://ezhs.customs.gov.my/",
    region: "ASEAN",
    verified: true,
    verify_note: "Verified line by line against real RMCD K1 declarations.",
    customs_name: "Royal Malaysian Customs Department (RMCD)",
    ports: [
      { code: "MYPKG", label: "Port Klang (Westport / Northport)" },
      { code: "MYTPP", label: "Tanjung Pelepas" },
      { code: "MYPEN", label: "Penang" },
      { code: "MYPGU", label: "Pasir Gudang" },
      { code: "MYKUA", label: "Kuantan" },
      { code: "MYBTU", label: "Bintulu" },
      { code: "MYKCH", label: "Kuching" },
      { code: "MYBKI", label: "Kota Kinabalu (Sepanggar)" },
      { code: "MYKUL", label: "KLIA (air freight)" },
    ],
    rates_note: "Customs Duties Order 2022 · Excise Duties Order 2025 (P.U.(A) 389/2025, from 1 Nov 2025) · SST 10% on CIF + duty + excise.",
    fx_note: "Bank Negara Malaysia rate; overwrite with the weekly RMCD customs rate if you have it.",
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    symbol: "S$",
    tax_name: "GST",
    tax_desc: "GST 9% on CIF + customs duty + excise",
    tax_pct: 9,
    tier: "official",
    lookup: "https://www.customs.gov.sg/businesses/valuation-duties-taxes-fees/duties-and-dutiable-goods/list-of-dutiable-goods",
    region: "ASEAN",
    verified: false,
    verify_note: "From Singapore Customs' published List of Dutiable Goods. Not yet checked against a real import permit — treat as verify.",
    customs_name: "Singapore Customs",
    ports: [
      { code: "SGSIN", label: "Singapore (PSA Tanjong Pagar / Pasir Panjang / Tuas)" },
      { code: "SGCHG", label: "Changi (air freight)" },
    ],
    rates_note: "Singapore Customs List of Dutiable Goods: customs duty and excise per litre of pure alcohol · GST 9% on CIF + duties (since 1 Jan 2024).",
    fx_note: "Cross rate via Bank Negara Malaysia (currency → MYR ÷ SGD → MYR). Singapore Customs uses its own weekly rate; overwrite if you have it.",
  },
};

function fromRegistry(d: Destination): CountryInfo {
  return {
    code: d.code,
    name: d.name,
    currency: d.currency,
    symbol: d.symbol,
    tax_name: d.tax_name === "none" ? "Tax" : d.tax_name,
    tax_desc: d.tax_note,
    tax_pct: d.tax_pct,
    tier: d.tier,
    lookup: d.lookup,
    duty_default_pct: d.duty_default_pct,
    region: d.region,
    verified: false,
    verify_note: `${d.tax_name === "none" ? "no import VAT/GST" : `${d.tax_name} ${d.tax_pct}%`} is applied from the standard rate; import duty is the % you enter per product${d.duty_default_pct != null ? ` (default ${d.duty_default_pct}%)` : ""}. Verify at ${d.customs} before you commit.`,
    customs_name: d.customs,
    ports: [
      { code: `${d.code}SEA`, label: `${d.name} · main seaport` },
      { code: `${d.code}AIR`, label: `${d.name} · airport (air freight)` },
    ],
    rates_note: `${d.tax_note}.${d.extra_note ? ` ${d.extra_note}` : ""}${d.de_minimis ? ` De minimis: ${d.de_minimis}.` : ""}`,
    fx_note: `Cross rate via Bank Negara Malaysia (currency → MYR ÷ ${d.currency} → MYR). Customs may use its own weekly rate; overwrite if you have it.`,
  };
}

/** Every destination the app can price, keyed by ISO-2. MY and SG keep their hand-written entries. */
export const COUNTRIES: Record<DestCountry, CountryInfo> = Object.fromEntries(
  DESTINATIONS.map((d) => [d.code, d.code === "MY" || d.code === "SG" ? NATIONAL[d.code as "MY" | "SG"] : fromRegistry(d)]),
) as Record<DestCountry, CountryInfo>;

export const DEST_COUNTRIES: DestCountry[] = DESTINATIONS.map((d) => d.code);
export const EXACT_COUNTRIES: DestCountry[] = DEST_COUNTRIES.filter((c) => COUNTRIES[c].tier !== "indicative");
export const INDICATIVE_COUNTRIES: DestCountry[] = DEST_COUNTRIES.filter((c) => COUNTRIES[c].tier === "indicative");
export const TIER_LABEL: Record<Tier, string> = { verified: "Verified", official: "Official", indicative: "Indicative" };

export function countryOfPort(code: string): DestCountry {
  const c = code.slice(0, 2).toUpperCase();
  return COUNTRIES[c] ? c : "MY";
}

/** Default local charges by destination, in the destination currency. Editable by the user. */
export function localChargesFor(country: DestCountry, equipment: Equipment, pallets: number): Record<string, number> {
  const n = Math.max(1, pallets);
  if (country !== "MY" && country !== "SG") {
    // Indicative destinations: Malaysian-level charges converted at the default cross rate, rounded.
    const f = (fxDefault("MY", COUNTRIES[country].currency, FX_MYR) || 1);
    const conv = (rm: number) => Math.round(rm / f);
    const sea = equipment === "pallet";
    const base = equipment === "40hc" ? 1.5 : 1;
    return {
      "Port and terminal handling": conv(sea ? 350 + 250 * n : 1200 * base),
      "Customs broker and declaration": conv(sea ? 400 : 600),
      "Delivery to warehouse": conv(sea ? 300 + 100 * n : 900 * base),
      Unstuffing: conv(sea ? 100 * n : 300 * base),
    };
  }
  if (country === "SG") {
    if (equipment === "pallet") {
      return {
        "Port and terminal handling": 120 + 90 * n,
        "Customs permit and declarant": 150,
        "Delivery within Singapore": 120 + 40 * n,
        Unstuffing: 40 * n,
      };
    }
    const base = equipment === "40hc" ? 1.5 : 1;
    return {
      "Port and terminal handling": Math.round(450 * base),
      "Customs permit and declarant": 200,
      "Delivery within Singapore": Math.round(350 * base),
      Unstuffing: Math.round(120 * base),
    };
  }
  if (equipment === "pallet") {
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

/** Rough MYR per 1 unit, used only when the live feed has no rate (Nov 2026 order of magnitude). */
export const FX_MYR: Record<string, number> = {
  MYR: 1, SGD: 3.28, EUR: 4.93, USD: 4.2, GBP: 5.6, AUD: 2.8, NZD: 2.5, JPY: 0.028, KRW: 0.003, CNY: 0.59, HKD: 0.54, TWD: 0.135, INR: 0.048, PKR: 0.015, BDT: 0.035, LKR: 0.014,
  IDR: 0.00026, THB: 0.125, VND: 0.00016, PHP: 0.072, BND: 3.28, KHR: 0.00103, LAK: 0.00019, MMK: 0.002, AED: 1.14, SAR: 1.12, QAR: 1.15, OMR: 10.9, BHD: 11.1, KWD: 13.7,
  TRY: 0.1, EGP: 0.085, ZAR: 0.24, NGN: 0.0027, KES: 0.0325, PLN: 1.15, SEK: 0.44, DKK: 0.66, NOK: 0.41, CHF: 5.3, CAD: 3.05, MXN: 0.23, BRL: 0.78, CLP: 0.0044, ARS: 0.003,
  CZK: 0.2, HUF: 0.0125, RON: 0.97, BGN: 2.5, HRK: 0.65, ISK: 0.031, UAH: 0.1, RUB: 0.052, KZT: 0.0082, UZS: 0.00033, GEL: 1.55, AMD: 0.011, AZN: 2.47, RSD: 0.042, BAM: 2.5, MKD: 0.08, ALL: 0.05, MDL: 0.24, BYN: 1.3,
  COP: 0.001, PEN: 1.13, UYU: 0.1, PYG: 0.00055, BOB: 0.6, CRC: 0.0083, GTQ: 0.55, HNL: 0.16, NIO: 0.115, DOP: 0.07, JMD: 0.027, TTD: 0.62, BSD: 4.2, BBD: 2.1, BZD: 2.1, XCD: 1.55, GYD: 0.02, SRD: 0.11, HTG: 0.032, PAB: 4.2, VES: 0.02, CUP: 0.175,
  MAD: 0.45, TND: 1.4, DZD: 0.031, LYD: 0.77, ETB: 0.028, TZS: 0.0016, UGX: 0.00115, RWF: 0.003, GHS: 0.35, XOF: 0.0075, XAF: 0.0075, MUR: 0.092, SCR: 0.3, MZN: 0.066, AOA: 0.0046, ZMW: 0.17, BWP: 0.31, NAD: 0.24, SZL: 0.24, LSL: 0.24, MWK: 0.0024, MGA: 0.00093, CDF: 0.0015, SDG: 0.007, GMD: 0.06, SLE: 0.18, LRD: 0.021, GNF: 0.00049, MRU: 0.105, CVE: 0.045, DJF: 0.0236, KMF: 0.01, STN: 0.2, BIF: 0.0014, SOS: 0.0074, SSP: 0.001, ERN: 0.28, ZWG: 0.16,
  JOD: 5.93, ILS: 1.15, LBP: 0.000047, IQD: 0.0032, IRR: 0.0001, YER: 0.0168, SYP: 0.0003, AFN: 0.06, NPR: 0.03, MVR: 0.27, BTN: 0.048, MNT: 0.0012, KGS: 0.048, TJS: 0.4, TMT: 1.2, MOP: 0.52, KPW: 0.0047,
  FJD: 1.85, PGK: 1.05, SBD: 0.5, VUV: 0.035, WST: 1.5, TOP: 1.78, XPF: 0.041, GIP: 5.6, ANG: 2.35, AWG: 2.35, BMD: 4.2, KYD: 5.05,
};

function destCurrency(country: DestCountry): string {
  return COUNTRIES[country]?.currency ?? "MYR";
}

/** Indicative FX when the live feed is unavailable: destination currency per 1 unit of `currency`. */
export function fxDefault(country: DestCountry, currency: string, myrDefaults: Record<string, number>): number {
  const toMyr = myrDefaults[currency] ?? FX_MYR[currency] ?? 1;
  const dest = destCurrency(country);
  if (dest === "MYR") return toMyr;
  const destToMyr = myrDefaults[dest] ?? FX_MYR[dest];
  if (!destToMyr) return 0; // unknown: the user enters the rate
  return +(toMyr / destToMyr).toFixed(dest === "IDR" || dest === "VND" || dest === "KRW" || dest === "LAK" || dest === "KHR" ? 2 : 4);
}

/** Live FX: BNM gives MYR per unit; for other destinations divide by MYR per destination currency (BNM publishes most of them). */
export function fxFromBnm(country: DestCountry, rates: Record<string, number>, currency: string): number | undefined {
  const toMyr = rates[currency];
  if (toMyr == null) return undefined;
  const dest = destCurrency(country);
  if (dest === "MYR") return toMyr;
  if (currency === dest) return 1;
  const destToMyr = rates[dest];
  if (!destToMyr) return undefined;
  return +(toMyr / destToMyr).toFixed(4);
}
