/**
 * Builds effective-dated RateTables from data/chapter22.json.
 * Two excise versions: the 2022 Order (P.U.(A) 163/2022) and the 2025 Order (P.U.(A) 389/2025) from 1 Nov 2025.
 */
import type { CountryCode, ExciseLine, FtaRate, ISODate, Rate, RateTables, SstRate, TariffLine } from "./types";
import chapter22 from "../data/chapter22.json";
import general from "../data/general.json";
import sg from "../data/sg.json";
import fta from "../data/fta.json";

export const EXCISE_V2_EFFECTIVE: ISODate = "2025-11-01";
const EXCISE_V1_EFFECTIVE: ISODate = "2022-06-01";
const CUSTOMS_EFFECTIVE: ISODate = "2022-06-01";

const S = chapter22._meta.sources;

export function buildRateTables(): RateTables {
  const tariff_lines: TariffLine[] = [];
  const excise_lines: ExciseLine[] = [];
  const sst_rates: SstRate[] = [];
  const fta_rates: FtaRate[] = [];

  for (const l of chapter22.lines) {
    tariff_lines.push({
      hs_code: l.hs_code,
      description: l.description,
      unit: "l",
      duty: l.duty as Rate,
      effective_from: CUSTOMS_EFFECTIVE,
      effective_to: null,
      source_doc: "Customs Duties Order 2022, P.U.(A) 114/2022",
      source_url: S.customs,
    });

    excise_lines.push({
      hs_code: l.hs_code,
      description: l.description,
      excise: l.excise as Rate,
      effective_from: EXCISE_V1_EFFECTIVE,
      effective_to: "2025-10-31",
      source_doc: "Excise Duties Order 2022, P.U.(A) 163/2022",
      source_url: S.excise_2022,
    });
    excise_lines.push({
      hs_code: l.hs_code,
      description: l.description,
      excise: l.excise_2025 as Rate,
      effective_from: EXCISE_V2_EFFECTIVE,
      effective_to: null,
      source_doc: "Excise Duties Order 2025, P.U.(A) 389/2025 (in force 1 Nov 2025)",
      source_url: S.excise_2025,
    });

    sst_rates.push({
      hs_code: l.hs_code,
      description: l.description,
      rate_pct: 10,
      effective_from: "2018-09-01",
      effective_to: null,
      source_doc: "Sales Tax Act 2018 — 10% standard rate on imports",
      source_url: S.sst,
    });
  }

  // General goods (ad valorem duty, no excise), indicative until verified.
  for (const g of general.lines) {
    tariff_lines.push({
      hs_code: g.hs_code,
      description: g.description,
      unit: "u",
      duty: { type: "ad_valorem", value: g.duty_pct },
      effective_from: CUSTOMS_EFFECTIVE,
      effective_to: null,
      source_doc: `Customs Duties Order 2022 (indicative — ${g.confidence})`,
      source_url: general._meta.sources.customs,
    });
    sst_rates.push({
      hs_code: g.hs_code,
      description: g.description,
      rate_pct: g.sst_pct,
      effective_from: "2025-07-01",
      effective_to: null,
      source_doc: "Sales Tax (Rates of Tax) Order, July 2025 expansion (indicative)",
      source_url: general._meta.sources.sst,
    });
  }

  // FTA preferences: only general goods, only ATIGA for now. Alcohol is excluded (see preferenceNote).
  for (const f of fta.general_goods) {
    for (const g of general.lines) {
      for (const origin of f.origins) {
        fta_rates.push({
          hs_code: g.hs_code,
          description: g.description,
          origin_iso: origin,
          agreement: f.agreement,
          duty: { type: "ad_valorem", value: f.duty_pct },
          effective_from: f.effective_from,
          effective_to: null,
          source_doc: `${f.agreement} preferential rate (indicative — ${f.confidence}); needs ${f.requires}`,
          source_url: fta._meta.sources.atiga,
        });
      }
    }
  }

  return { country: "MY", tax_name: "SST", tariff_lines, excise_lines, sst_rates, fta_rates };
}

/**
 * Why a line from an FTA-partner origin still pays MFN duty, or null if no FTA partner is involved.
 * Alcohol into Malaysia gets no preference under ATIGA, MAFTA or MNZFTA.
 */
export function preferenceNote(origin_iso: string, hs_code: string): string | null {
  const ex = fta.alcohol_excluded;
  if (!ex.hs_prefixes.some((p) => hs_code.startsWith(p))) return null;
  for (const a of Object.values(ex.agreements)) if (a.origins.includes(origin_iso)) return a.note;
  return null;
}

/** Drop FTA rows so a shipment is priced at MFN (no certificate of origin). */
export function withoutFta(tables: RateTables): RateTables {
  return { ...tables, fta_rates: [] };
}

/**
 * Singapore: customs + excise both per litre of pure alcohol (Singapore Customs, List of Dutiable Goods),
 * GST on CIF + duties. Same HS lines as chapter22.json so a shipment can be re-priced for either destination.
 */
export function buildSgRateTables(): RateTables {
  const tariff_lines: TariffLine[] = [];
  const excise_lines: ExciseLine[] = [];
  const sst_rates: SstRate[] = [];
  const from: ISODate = sg._meta.effective_from;
  const doc = "Singapore Customs — List of Dutiable Goods (verify against permit)";

  for (const l of chapter22.lines) {
    // Longest matching prefix wins (rules are ordered specific → general, so first match is enough).
    const rule = sg.rules.find((r) => l.hs_code.startsWith(r.prefix));
    if (!rule) continue;
    tariff_lines.push({
      hs_code: l.hs_code,
      description: l.description,
      unit: "l",
      duty: { type: "per_litre_pure_alcohol", value: rule.customs },
      effective_from: from,
      effective_to: null,
      source_doc: doc,
      source_url: sg._meta.sources.dutiable_goods,
    });
    excise_lines.push({
      hs_code: l.hs_code,
      description: l.description,
      excise: { type: "per_litre_pure_alcohol", value: rule.excise },
      effective_from: from,
      effective_to: null,
      source_doc: doc,
      source_url: sg._meta.sources.dutiable_goods,
    });
    for (const g of sg.gst) {
      sst_rates.push({
        hs_code: l.hs_code,
        description: l.description,
        rate_pct: g.rate_pct,
        effective_from: g.effective_from,
        effective_to: g.effective_to,
        source_doc: `GST ${g.rate_pct}% on CIF + duties (Singapore Customs)`,
        source_url: sg._meta.sources.gst,
      });
    }
  }
  return { country: "SG", tax_name: "GST", tariff_lines, excise_lines, sst_rates, fta_rates: [] };
}

export const COUNTRY_META: Record<string, { currency: string; symbol: string; tax_name: string; verified: boolean }> = {
  MY: { currency: "MYR", symbol: "RM", tax_name: "SST", verified: true },
  SG: { currency: "SGD", symbol: "S$", tax_name: "GST", verified: false },
};

/** Rate tables by destination country. Malaysia is K1-verified; Singapore is from the published list, not yet permit-checked. */
const REGISTRY: Partial<Record<CountryCode, () => RateTables>> = { MY: buildRateTables, SG: buildSgRateTables };
export const SUPPORTED_COUNTRIES: CountryCode[] = Object.keys(REGISTRY) as CountryCode[];
export function ratesFor(country: CountryCode = "MY"): RateTables {
  const f = REGISTRY[country];
  if (!f) throw new Error(`No rate tables for destination ${country} yet (supported: ${SUPPORTED_COUNTRIES.join(", ")})`);
  return f();
}

export const GENERAL_GROUPS = general.groups as { key: string; label: string }[];
export const GENERAL_LINES = general.lines as { group: string; hs_code: string; description: string; duty_pct: number; sst_pct: number; confidence: string }[];
export const GENERAL_VERIFY_URL = general._meta.verify_url;

/**
 * Build a rate table for a user-entered line: the user supplies duty % and SST %
 * (AI classifies, user prices when the database has no row). hs_code must be unique
 * per line, e.g. "MANUAL-<lineId>".
 */
export function manualRates(hs_code: string, description: string, duty_pct: number, sst_pct: number): RateTables {
  const base = {
    hs_code,
    description,
    effective_from: "2000-01-01",
    effective_to: null,
    source_doc: "Entered by you — verify against the Customs Duties Order",
    source_url: GENERAL_VERIFY_URL,
  };
  return {
    country: "MY",
    tariff_lines: [{ ...base, unit: "u", duty: { type: "ad_valorem", value: duty_pct } }],
    excise_lines: [],
    sst_rates: [{ ...base, rate_pct: sst_pct }],
    fta_rates: [],
  };
}

export function mergeRates(...tables: RateTables[]): RateTables {
  return {
    country: tables[0]?.country,
    tax_name: tables[0]?.tax_name,
    tariff_lines: tables.flatMap((t) => t.tariff_lines),
    excise_lines: tables.flatMap((t) => t.excise_lines),
    sst_rates: tables.flatMap((t) => t.sst_rates),
    fta_rates: tables.flatMap((t) => t.fta_rates),
  };
}

/** Pick the row in force on `date`. Returns undefined if none. */
export function effectiveRow<T extends { effective_from: ISODate; effective_to: ISODate | null }>(
  rows: T[],
  date: ISODate,
): T | undefined {
  return rows
    .filter((r) => r.effective_from <= date && (r.effective_to === null || date <= r.effective_to))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
}
