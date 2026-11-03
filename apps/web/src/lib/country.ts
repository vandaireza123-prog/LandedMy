/**
 * Destination-country presentation: currency symbol, tax name, ports, default local charges,
 * verification status. Rates themselves live in the engine (ratesFor(country)).
 */
import type { CountryCode } from "@landedmy/engine";
import type { Equipment } from "./lanes";

export type DestCountry = Extract<CountryCode, "MY" | "SG">;

export interface CountryInfo {
  code: DestCountry;
  name: string;
  currency: string;
  symbol: string;
  tax_name: string;
  tax_desc: string;
  /** K1 / permit verified against real declarations. */
  verified: boolean;
  verify_note: string;
  customs_name: string;
  ports: { code: string; label: string }[];
  rates_note: string;
  fx_note: string;
}

export const COUNTRIES: Record<DestCountry, CountryInfo> = {
  MY: {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    symbol: "RM",
    tax_name: "SST",
    tax_desc: "SST 10% on CIF + duty + excise",
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

export const DEST_COUNTRIES: DestCountry[] = ["MY", "SG"];

export function countryOfPort(code: string): DestCountry {
  return code.startsWith("SG") ? "SG" : "MY";
}

/** Default local charges by destination, in the destination currency. Editable by the user. */
export function localChargesFor(country: DestCountry, equipment: Equipment, pallets: number): Record<string, number> {
  const n = Math.max(1, pallets);
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

/** Indicative FX when the live feed is unavailable: destination currency per 1 unit. */
export function fxDefault(country: DestCountry, currency: string, myrDefaults: Record<string, number>): number {
  const toMyr = myrDefaults[currency] ?? 1;
  if (country === "MY") return toMyr;
  const sgdToMyr = myrDefaults.SGD ?? 3.3;
  return +(toMyr / sgdToMyr).toFixed(4);
}

/** Live FX: BNM gives MYR per unit; for Singapore divide by MYR per SGD. */
export function fxFromBnm(country: DestCountry, rates: Record<string, number>, currency: string): number | undefined {
  const toMyr = rates[currency];
  if (toMyr == null) return undefined;
  if (country === "MY") return toMyr;
  if (currency === "SGD") return 1;
  if (!rates.SGD) return undefined;
  return +(toMyr / rates.SGD).toFixed(4);
}
