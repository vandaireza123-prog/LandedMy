/**
 * computeShipment — the one pure function LandedMY is built around.
 *
 * Order of operations (Malaysian customs practice):
 *   1. goods value → RM at the customs FX rate
 *   2. freight + insurance allocated to each line (volume share by default)
 *   3. CIF = goods + freight + insurance
 *   4. import duty: per_litre → litres × rate; per_litre_pure_alcohol → litres × ABV × rate;
 *                   ad_valorem → CIF × %.   FTA override if origin qualifies.
 *   5. excise: specific types as above; ad_valorem → (CIF + duty) × %
 *   6. SST = rate × (CIF + duty + excise)
 *   7. local charges allocated
 *   8. landed = CIF + duty + excise + SST + local
 *
 * All arithmetic in full precision; rounding to sen happens once per line total,
 * then per-unit figures are derived from the rounded line total.
 * The engine REFUSES to price a line that has no effective tariff or SST row for the
 * shipment date (RateNotFoundError). A missing excise row is treated as "no excise"
 * only for non-alcohol lines (abv === 0); alcohol with no excise row is also refused.
 */
import { effectiveRow } from "./rates";
import {
  RateNotFoundError,
  type LineResult,
  type Rate,
  type RateTables,
  type Shipment,
  type ShipmentLine,
  type ShipmentResult,
} from "./types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function specificOrAdValorem(rate: Rate, litres: number, abv: number, base: number): number {
  switch (rate.type) {
    case "per_litre":
      return litres * rate.value;
    case "per_litre_pure_alcohol":
      return litres * (abv / 100) * rate.value;
    case "ad_valorem":
      return base * (rate.value / 100);
  }
}

function lineLitres(l: ShipmentLine): number {
  return (l.volume_ml / 1000) * l.units_per_case * l.cases;
}

function lineUnits(l: ShipmentLine): number {
  return l.units_per_case * l.cases;
}

export function computeShipment(shipment: Shipment, rates: RateTables): ShipmentResult {
  const warnings: string[] = [];
  const { date, fx_rate } = shipment;

  if (shipment.lines.length === 0) throw new Error("Shipment has no lines");
  const dest = shipment.dest_country ?? "MY";
  if (rates.country && rates.country !== dest) throw new Error(`Rate tables are for ${rates.country}, shipment is to ${dest}`);
  if (!(fx_rate > 0)) throw new Error("fx_rate must be > 0");

  // ---- 1. goods in RM, and allocation weights ----
  const goodsRm = shipment.lines.map((l) => (l.declared_value ?? l.unit_cost * lineUnits(l)) * fx_rate);
  const totalGoods = goodsRm.reduce((a, b) => a + b, 0);

  let allocation = shipment.allocation;
  if (allocation === "volume" && shipment.lines.some((l) => lineLitres(l) <= 0)) {
    allocation = "value";
    warnings.push("Some lines have no volume (non-beverage goods), so freight and local charges were split by value instead of volume.");
  }
  const weights = shipment.lines.map((l, i) => {
    switch (allocation) {
      case "value":
        return goodsRm[i];
      case "units":
        return lineUnits(l);
      case "volume":
      default:
        return lineLitres(l);
    }
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const share = (i: number) => (totalWeight === 0 ? 1 / weights.length : weights[i] / totalWeight);

  // ---- 2. freight and insurance in RM ----
  const freightRm = shipment.incoterm === "CIF" ? 0 : shipment.freight * fx_rate;
  if (shipment.incoterm === "CIF" && shipment.freight > 0) {
    warnings.push("Incoterm is CIF but freight was given; freight ignored (already in the goods price).");
  }
  const insuranceRm =
    "amount" in shipment.insurance
      ? shipment.insurance.amount * fx_rate
      : totalGoods * (shipment.insurance.pct_of_goods / 100);
  const localTotal = Object.values(shipment.local_charges_myr).reduce((a, b) => a + b, 0);

  // ---- per line ----
  const lines: LineResult[] = shipment.lines.map((l, i) => {
    const units = lineUnits(l);
    const litres = lineLitres(l);
    const s = share(i);

    const tariff = effectiveRow(rates.tariff_lines.filter((r) => r.hs_code === l.hs_code), date);
    if (!tariff) throw new RateNotFoundError("tariff", l.hs_code, date);
    const sst = effectiveRow(rates.sst_rates.filter((r) => r.hs_code === l.hs_code), date);
    if (!sst) throw new RateNotFoundError("sst", l.hs_code, date);
    const excise = effectiveRow(rates.excise_lines.filter((r) => r.hs_code === l.hs_code), date);
    if (!excise && l.abv > 0) {
      throw new Error(`No effective excise rate for alcohol line HS ${l.hs_code} (${l.abv}% ABV) on ${date}`);
    }
    const fta = effectiveRow(
      rates.fta_rates.filter((r) => r.hs_code === l.hs_code && r.origin_iso === shipment.origin_iso),
      date,
    );

    const goods = goodsRm[i];
    const freight = freightRm * s;
    const insurance = insuranceRm * s;
    const cif = goods + freight + insurance;

    // RMCD practice (verified against K1 assessments B3S110000837 and B3S106001874):
    // everything is computed at full precision from the unrounded invoice value and
    // rounded to the sen once per line, per tax. SST uses the unrounded base.
    const dutyRate = fta ? fta.duty : tariff.duty;
    const duty = specificOrAdValorem(dutyRate, litres, l.abv, cif);
    const exciseAmt = excise ? specificOrAdValorem(excise.excise, litres, l.abv, cif + duty) : 0;
    const sstAmt = (cif + duty + exciseAmt) * (sst.rate_pct / 100);
    const dutyPaid = cif + duty + exciseAmt + sstAmt;
    const local = localTotal * s;
    const landed = dutyPaid + local;

    const r = {
      goods: round2(goods),
      freight: round2(freight),
      insurance: round2(insurance),
      cif: round2(cif),
      duty: round2(duty),
      excise: round2(exciseAmt),
      sst: round2(sstAmt),
      duty_paid: round2(dutyPaid),
      local_charges: round2(local),
      landed: round2(landed),
    };
    const taxShare = landed > 0 ? ((duty + exciseAmt + sstAmt) / landed) * 100 : 0;

    const src = (row: { source_doc: string; source_url: string; effective_from: string }) => ({
      source_doc: row.source_doc,
      source_url: row.source_url,
      effective_from: row.effective_from,
    });

    return {
      id: l.id,
      name: l.name,
      hs_code: l.hs_code,
      units,
      litres: round2(litres),
      ...r,
      per_unit: {
        goods: round2(goods / units),
        freight_insurance: round2((freight + insurance) / units),
        cif: round2(cif / units),
        duty: round2(duty / units),
        excise: round2(exciseAmt / units),
        sst: round2(sstAmt / units),
        local_charges: round2(local / units),
        landed: round2(landed / units),
      },
      per_case: round2(landed / l.cases),
      per_pallet: l.cases_per_pallet ? round2((landed / l.cases) * l.cases_per_pallet) : null,
      tax_share_pct: round2(taxShare),
      rates_used: {
        duty: { ...dutyRate, ...src(fta ?? tariff) },
        excise: excise ? { ...excise.excise, ...src(excise) } : null,
        sst_pct: sst.rate_pct,
        fta_agreement: fta ? fta.agreement : null,
      },
    };
  });

  const sum = (k: keyof Pick<LineResult, "goods" | "freight" | "insurance" | "cif" | "duty" | "excise" | "sst" | "duty_paid" | "local_charges" | "landed">) =>
    round2(lines.reduce((a, l) => a + l[k], 0));

  const totals = {
    goods: sum("goods"),
    freight: sum("freight"),
    insurance: sum("insurance"),
    cif: sum("cif"),
    duty: sum("duty"),
    excise: sum("excise"),
    sst: sum("sst"),
    duty_paid: sum("duty_paid"),
    local_charges: sum("local_charges"),
    landed: sum("landed"),
    tax_share_pct: 0,
  };
  totals.tax_share_pct = totals.landed > 0 ? round2(((totals.duty + totals.excise + totals.sst) / totals.landed) * 100) : 0;

  return { date, fx_rate, currency: shipment.currency, lines, totals, warnings };
}
