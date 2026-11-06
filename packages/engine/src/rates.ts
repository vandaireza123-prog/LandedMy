/**
 * Builds effective-dated RateTables from data/chapter22.json.
 * Two excise versions: the 2022 Order (P.U.(A) 163/2022) and the 2025 Order (P.U.(A) 389/2025) from 1 Nov 2025.
 */
import { RateNotFoundError, type CountryCode, type ExciseLine, type FtaRate, type ISODate, type Rate, type RateTables, type SstRate, type TariffLine } from "./types";
import chapter22 from "../data/chapter22.json";
import general from "../data/general.json";
import sg from "../data/sg.json";
import fta from "../data/fta.json";
import destinations from "../data/destinations.json";
import uk from "../data/uk.json";
import ca from "../data/ca.json";

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

  return { country: "MY", tax_name: "SST", tier: "verified", tariff_lines, excise_lines, sst_rates, fta_rates };
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
  return { country: "SG", tax_name: "GST", tier: "official", tariff_lines, excise_lines, sst_rates, fta_rates: [] };
}

/**
 * United Kingdom: UK Global Tariff duty per hectolitre, Alcohol Duty by ABV band per litre of pure alcohol,
 * VAT 20% on CIF + duty + excise. Cider lines are omitted (duty unconfirmed) so they are refused.
 */
export function buildUkRateTables(): RateTables {
  const tariff_lines: TariffLine[] = [];
  const excise_lines: ExciseLine[] = [];
  const sst_rates: SstRate[] = [];
  const doc = "UK Global Tariff (trade-tariff.service.gov.uk)";
  for (const l of chapter22.lines) {
    const d = uk.duty.find((r) => l.hs_code.startsWith(r.prefix));
    if (!d) continue; // cider/perry: not loaded on purpose
    tariff_lines.push({ hs_code: l.hs_code, description: l.description, unit: "l", duty: { type: d.type as Rate["type"], value: d.value }, effective_from: uk._meta.duty_effective_from, effective_to: null, source_doc: `${doc} — ${d.label}`, source_url: uk._meta.sources.trade_tariff });
    const kind = l.hs_code.startsWith("2203") ? "beer" : l.hs_code.startsWith("2206.00.10") ? "cider" : "wine_spirits_other";
    for (const b of uk.excise_bands) {
      if (b.applies !== "all" && b.applies !== kind) continue;
      excise_lines.push({ hs_code: l.hs_code, description: l.description, excise: { type: "per_litre_pure_alcohol", value: b.rate }, abv_min: b.abv_min, abv_max: b.abv_max, effective_from: uk._meta.excise_effective_from, effective_to: null, source_doc: `HMRC Alcohol Duty, ${b.abv_min}–${b.abv_max}% ABV band, from 1 Feb 2026 (non-draught)`, source_url: uk._meta.sources.alcohol_duty });
    }
    sst_rates.push({ hs_code: l.hs_code, description: l.description, rate_pct: uk.vat_pct, effective_from: "2011-01-04", effective_to: null, source_doc: "UK import VAT 20% on CIF + duty + excise", source_url: uk._meta.sources.vat });
  }
  return { country: "GB", tax_name: "VAT", tier: "official", tariff_lines, excise_lines, sst_rates, fta_rates: [] };
}

/**
 * Canada: 2026 Customs Tariff chapter 22 (CBSA), federal excise (CRA, from 1 Apr 2026), GST 5% on CIF + duty + excise.
 * Provincial liquor-board markups are outside scope and noted in the data file.
 */
export function buildCaRateTables(): RateTables {
  const tariff_lines: TariffLine[] = [];
  const excise_lines: ExciseLine[] = [];
  const sst_rates: SstRate[] = [];
  type Band = { abv_min?: number; abv_max?: number; value: number; label: string; type?: string };
  for (const l of chapter22.lines) {
    const ds = (ca.duty as (Band & { prefix: string })[]).filter((r) => l.hs_code.startsWith(r.prefix));
    // most specific prefix wins; banded rows under the same prefix all apply
    const best = ds.reduce((a, r) => (r.prefix.length > a ? r.prefix.length : a), 0);
    for (const d of ds.filter((r) => r.prefix.length === best)) {
      tariff_lines.push({ hs_code: l.hs_code, description: l.description, unit: "l", duty: { type: d.type as Rate["type"], value: d.value }, abv_min: d.abv_min, abv_max: d.abv_max, effective_from: ca._meta.duty_effective_from, effective_to: null, source_doc: `Customs Tariff 2026, ch. 22 — ${d.label} (MFN)`, source_url: ca._meta.sources.tariff });
    }
    const kind = l.hs_code.startsWith("2203") ? "beer" : l.hs_code.startsWith("2208") ? "spirits" : "wine";
    const bands: Band[] = kind === "beer" ? ca.excise.beer_per_litre : kind === "spirits" ? ca.excise.spirits : ca.excise.wine_per_litre;
    for (const b of bands) {
      excise_lines.push({ hs_code: l.hs_code, description: l.description, excise: { type: (b.type ?? "per_litre") as Rate["type"], value: b.value }, abv_min: b.abv_min, abv_max: b.abv_max, effective_from: ca._meta.excise_effective_from, effective_to: null, source_doc: `CRA excise duty from 1 Apr 2026 — ${b.label}`, source_url: ca._meta.sources.excise });
    }
    sst_rates.push({ hs_code: l.hs_code, description: l.description, rate_pct: ca.gst_pct, effective_from: "2008-01-01", effective_to: null, source_doc: "GST 5% on duty-paid value (CIF + duty + excise); provincial HST/PST and liquor-board markup excluded", source_url: ca._meta.sources.gst });
  }
  return { country: "CA", tax_name: "GST", tier: "official", tariff_lines, excise_lines, sst_rates, fta_rates: [] };
}

export const COUNTRY_META: Record<string, { currency: string; symbol: string; tax_name: string; verified: boolean }> = {
  MY: { currency: "MYR", symbol: "RM", tax_name: "SST", verified: true },
  SG: { currency: "SGD", symbol: "S$", tax_name: "GST", verified: false },
  GB: { currency: "GBP", symbol: "£", tax_name: "VAT", verified: false },
  CA: { currency: "CAD", symbol: "C$", tax_name: "GST", verified: false },
};

/** Rate tables by destination country. Malaysia is K1-verified; Singapore is from the published list, not yet permit-checked. */
const REGISTRY: Partial<Record<CountryCode, () => RateTables>> = { MY: buildRateTables, SG: buildSgRateTables, GB: buildUkRateTables, CA: buildCaRateTables };
/** Countries with a national schedule loaded (exact duty rows). */
export const SUPPORTED_COUNTRIES: CountryCode[] = Object.keys(REGISTRY) as CountryCode[];
export function ratesFor(country: CountryCode = "MY"): RateTables {
  const f = REGISTRY[country];
  if (!f) throw new Error(`No rate tables for destination ${country} yet (supported: ${SUPPORTED_COUNTRIES.join(", ")})`);
  return f();
}

export interface Destination {
  code: CountryCode;
  name: string;
  currency: string;
  symbol: string;
  tax_name: string;
  tax_pct: number;
  tax_note: string;
  tier: "verified" | "official" | "indicative";
  lookup: string;
  customs: string;
  region: string;
  duty_default_pct?: number;
  extra_note?: string;
  de_minimis?: string;
  tax_base?: string;
  ports?: { code: string; label: string }[];
}
export const DESTINATIONS: Destination[] = destinations.countries as Destination[];
export const DESTINATION_CODES: CountryCode[] = DESTINATIONS.map((d) => d.code);
export function destination(code: CountryCode): Destination {
  const d = DESTINATIONS.find((x) => x.code === code);
  if (!d) throw new Error(`Unknown destination ${code} (known: ${DESTINATION_CODES.join(", ")})`);
  return d;
}

/**
 * Indicative destinations: build tables from the country's standard import tax and the duty %
 * on each line (user-entered, or the country's default where one exists). No excise rows, so the
 * engine still refuses alcohol — excise must be researched per country before it is priced.
 */
export function genericRates(country: CountryCode, lines: { hs_code: string; name: string; duty_pct?: number }[]): RateTables {
  const d = destination(country);
  const base = { effective_from: "2000-01-01", effective_to: null };
  const tariff_lines: TariffLine[] = [];
  const sst_rates: SstRate[] = [];
  for (const l of lines) {
    const duty = l.duty_pct ?? d.duty_default_pct;
    if (duty == null) throw new RateNotFoundError("tariff", l.hs_code, base.effective_from);
    tariff_lines.push({ ...base, hs_code: l.hs_code, description: l.name, unit: "u", duty: { type: "ad_valorem", value: duty }, source_doc: l.duty_pct != null ? `Duty % entered by you — verify at ${d.customs}` : `${d.name} common duty ${duty}% (indicative)`, source_url: d.lookup });
    sst_rates.push({ ...base, hs_code: l.hs_code, description: l.name, rate_pct: d.tax_pct, source_doc: `${d.tax_name} ${d.tax_pct}% — ${d.tax_note}`, source_url: destinations._meta.sources.vat_rates });
  }
  return { country, tax_name: d.tax_name === "none" ? "Tax" : d.tax_name, tier: "indicative", tax_base_uplift_pct: d.tax_base === "cif_uplift_10_plus_duty" ? 10 : 0, tariff_lines, excise_lines: [], sst_rates, fta_rates: [] };
}

/** The right tables for a shipment: national schedule where we have one, otherwise indicative generic tables. */
export function ratesForShipment(country: CountryCode, lines: { hs_code: string; name: string; duty_pct?: number }[]): RateTables {
  return REGISTRY[country] ? ratesFor(country) : genericRates(country, lines);
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
