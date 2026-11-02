/**
 * LandedMY engine types.
 * Every rate row is effective-dated and carries its source so the UI can show
 * "where did this number come from" on tap.
 */

/** ISO date string, YYYY-MM-DD. */
export type ISODate = string;

/** How a duty or excise rate is expressed in the gazetted Order. */
export type RateType =
  /** % of the assessable value (CIF for duty; CIF + duty for excise). */
  | "ad_valorem"
  /** RM per litre of beverage, regardless of strength. */
  | "per_litre"
  /** RM per litre of 100% alcohol — multiply by litres × ABV. */
  | "per_litre_pure_alcohol";

export interface Rate {
  type: RateType;
  /** RM for specific rates; percentage (10 = 10%) for ad valorem. */
  value: number;
}

export interface RateRowBase {
  hs_code: string;
  description: string;
  effective_from: ISODate;
  /** null = open-ended, still in force. */
  effective_to: ISODate | null;
  source_url: string;
  source_doc: string;
}

export interface TariffLine extends RateRowBase {
  unit: "l" | "kg" | "u";
  duty: Rate;
}

export interface ExciseLine extends RateRowBase {
  excise: Rate;
}

export interface SstRate extends RateRowBase {
  /** 0, 5 or 10 (percent). */
  rate_pct: number;
}

export interface FtaRate extends RateRowBase {
  /** ISO 3166-1 alpha-2, e.g. "AU", "NZ", "TH". */
  origin_iso: string;
  agreement: "ATIGA" | "MAFTA" | "MNZFTA" | "CPTPP" | "RCEP" | string;
  duty: Rate;
}

export type CountryCode = "MY" | "SG" | "TH" | "ID" | "VN" | "PH";

export interface RateTables {
  /** Destination country these tables price for. */
  country?: CountryCode;
  /** Consumption tax name for display: SST (MY), GST (SG), VAT (TH/ID/VN/PH). */
  tax_name?: string;
  tariff_lines: TariffLine[];
  excise_lines: ExciseLine[];
  sst_rates: SstRate[];
  fta_rates: FtaRate[];
}

export type Incoterm = "EXW" | "FOB" | "CIF";
export type AllocationBasis = "volume" | "value" | "units";

export interface ShipmentLine {
  id: string;
  name: string;
  hs_code: string;
  /** Volume of one retail unit in millilitres. */
  volume_ml: number;
  /** Alcohol by volume as a percentage, e.g. 13 for 13%. 0 for non-alcohol. */
  abv: number;
  units_per_case: number;
  cases: number;
  /** Cost per retail unit in the shipment currency. */
  unit_cost: number;
  /**
   * Optional: the invoice line total in shipment currency, as declared on the K1.
   * When given it overrides unit_cost × units for the goods value (customs values
   * each line from the invoice, not from a rounded unit price).
   */
  declared_value?: number;
  /** Optional: cases per pallet, used only for per-pallet output. */
  cases_per_pallet?: number;
}

export interface Shipment {
  /** Date used to pick the effective rate rows. */
  date: ISODate;
  /** Destination country; defaults to MY. Rate tables must match. */
  dest_country?: CountryCode;
  origin_iso: string;
  /** Destination port code, informational only in Sprint 0. */
  dest_port: string;
  currency: string;
  /** RM per 1 unit of `currency`, i.e. the RMCD customs rate. */
  fx_rate: number;
  incoterm: Incoterm;
  /** International freight in shipment currency (0 if incoterm is CIF). */
  freight: number;
  /** Insurance in shipment currency, or a % of goods value. */
  insurance: { amount: number } | { pct_of_goods: number };
  /** Local charges in RM: port, agent, haulage, unstuffing. */
  local_charges_myr: Record<string, number>;
  allocation: AllocationBasis;
  lines: ShipmentLine[];
}

export interface LineResult {
  id: string;
  name: string;
  hs_code: string;
  units: number;
  litres: number;
  /** Everything below is RM for the whole line. */
  goods: number;
  freight: number;
  insurance: number;
  cif: number;
  duty: number;
  excise: number;
  sst: number;
  duty_paid: number;
  local_charges: number;
  landed: number;
  per_unit: {
    goods: number;
    freight_insurance: number;
    cif: number;
    duty: number;
    excise: number;
    sst: number;
    local_charges: number;
    landed: number;
  };
  per_case: number;
  per_pallet: number | null;
  /** Share of landed cost that is tax (duty + excise + SST). */
  tax_share_pct: number;
  rates_used: {
    duty: Rate & { source_doc: string; source_url: string; effective_from: ISODate };
    excise: (Rate & { source_doc: string; source_url: string; effective_from: ISODate }) | null;
    sst_pct: number;
    fta_agreement: string | null;
  };
}

export interface ShipmentResult {
  date: ISODate;
  fx_rate: number;
  currency: string;
  lines: LineResult[];
  totals: {
    goods: number;
    freight: number;
    insurance: number;
    cif: number;
    duty: number;
    excise: number;
    sst: number;
    duty_paid: number;
    local_charges: number;
    landed: number;
    tax_share_pct: number;
  };
  warnings: string[];
}

export class RateNotFoundError extends Error {
  constructor(public kind: "tariff" | "sst", public hs_code: string, public date: ISODate) {
    super(`No effective ${kind} rate for HS ${hs_code} on ${date}`);
    this.name = "RateNotFoundError";
  }
}
