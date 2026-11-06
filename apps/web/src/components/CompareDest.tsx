"use client";
import { useEffect, useMemo, useState } from "react";
import { computeShipment, type Shipment } from "@landedmy/engine";
import { tablesFor } from "@/lib/shipment";
import { fetchFx } from "@/lib/api";
import { COUNTRIES, fxDefault, fxFromBnm, localChargesFor, type DestCountry } from "@/lib/country";
import { FX_DEFAULT } from "@/lib/lanes";
import type { AppState } from "@/lib/state";
import { Card, rm } from "./ui";

/**
 * "Same shipment to the other country": re-prices the shipment with the other destination's
 * rate tables, FX and default local charges. Freight is kept as entered (same lane length).
 */
export function CompareDest({ state, shipment, manualRateLines, onSwitch }: { state: AppState; shipment: Shipment; manualRateLines: { hs_code: string; name: string; duty_pct: number; sst_pct: number }[]; onSwitch: (c: DestCountry) => void }) {
  // Compare with the home market (Malaysia), or Singapore when already in Malaysia.
  const other: DestCountry = state.dest_country === "MY" ? "SG" : "MY";
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    fetchFx().then((r) => r && setRates(r.rates));
  }, []);

  const res = useMemo(() => {
    const fx = (rates ? fxFromBnm(other, rates, state.currency) : undefined) ?? fxDefault(other, state.currency, FX_DEFAULT);
    const s: Shipment = { ...shipment, dest_country: other, dest_port: COUNTRIES[other].ports[0].code, fx_rate: fx, local_charges_myr: localChargesFor(other, state.equipment, state.pallets) };
    try {
      void manualRateLines;
      return { fx, r: computeShipment(s, tablesFor({ ...state, dest_country: other })) };
    } catch {
      return null;
    }
  }, [rates, other, shipment, state, manualRateLines]);

  if (!res) return null;
  const o = COUNTRIES[other];
  const first = res.r.lines[0];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Same shipment to {o.name}</div>
        <button type="button" onClick={() => onSwitch(other)} className="text-[12px] font-semibold text-teal">
          Switch →
        </button>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[13px]">
        <span className="text-muted">Landed per unit, {o.ports[0].label.split(" (")[0]}</span>
        <span className="font-semibold">
          {o.symbol} {rm(first.per_unit.landed)}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted">Whole shipment · tax {Math.round(res.r.totals.tax_share_pct)}%</span>
        <span className="font-semibold">
          {o.symbol} {rm(res.r.totals.landed, 0)}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {o.tax_desc}; same freight, {o.name} default port charges, {o.symbol} {res.fx} per {state.currency}.{o.verified ? "" : ` ${o.name} rates not yet permit-verified.`}
      </p>
    </Card>
  );
}
