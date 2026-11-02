/**
 * Builds effective-dated RateTables from data/chapter22.json.
 * Two excise versions: the 2022 Order and the +10% Budget 2026 rise from 1 Nov 2025.
 */
import type { ExciseLine, FtaRate, ISODate, Rate, RateTables, SstRate, TariffLine } from "./types";
import chapter22 from "../data/chapter22.json";
import general from "../data/general.json";

export const EXCISE_V2_EFFECTIVE: ISODate = "2025-11-01";
const EXCISE_V1_EFFECTIVE: ISODate = "2022-06-01";
const CUSTOMS_EFFECTIVE: ISODate = "2022-06-01";
const EXCISE_V2_MULTIPLIER = 1.10;

const S = chapter22._meta.sources;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
      excise: { type: l.excise.type as Rate["type"], value: round2(l.excise.value * EXCISE_V2_MULTIPLIER) },
      effective_from: EXCISE_V2_EFFECTIVE,
      effective_to: null,
      source_doc: "Budget 2026 +10% alcohol excise (gazetted amendment to be loaded)",
      source_url: S.budget_2026,
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

  return { tariff_lines, excise_lines, sst_rates, fta_rates };
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
    tariff_lines: [{ ...base, unit: "u", duty: { type: "ad_valorem", value: duty_pct } }],
    excise_lines: [],
    sst_rates: [{ ...base, rate_pct: sst_pct }],
    fta_rates: [],
  };
}

export function mergeRates(...tables: RateTables[]): RateTables {
  return {
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
