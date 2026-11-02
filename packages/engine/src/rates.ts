/**
 * Builds effective-dated RateTables from data/chapter22.json.
 * Two excise versions: the 2022 Order and the +10% Budget 2026 rise from 1 Nov 2025.
 */
import type { ExciseLine, FtaRate, ISODate, Rate, RateTables, SstRate, TariffLine } from "./types";
import chapter22 from "../data/chapter22.json";

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

  return { tariff_lines, excise_lines, sst_rates, fta_rates };
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
