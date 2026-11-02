"use client";
import { useState } from "react";
import type { LineResult } from "@landedmy/engine";
import { Card, rm, smallInputCls } from "./ui";
import { useT } from "@/lib/i18n";

/**
 * "I need to sell at RM X with Y% margin — what's the most I can pay the supplier?"
 * Landed cost per unit is linear in the supplier price for a given line:
 *   landed = a + b × unit_cost
 * where b = fx × (1 + duty% if ad valorem) × (1 + SST%) [+ insurance share] and a = everything else.
 * We get a and b from the current result by perturbing the supplier price mentally:
 *   b = d(landed)/d(unit_cost) = (landed_per_unit - fixed_per_unit) / unit_cost
 * which holds exactly because duty on alcohol is specific (per litre) and SST is linear.
 */
export function ReverseCalc({ line, currency, fx, unitCost }: { line: LineResult; currency: string; fx: number; unitCost: number }) {
  const t = useT();
  const [sell, setSell] = useState(0);
  const [marginPct, setMarginPct] = useState(50);

  // Variable part per unit: goods + SST on goods (+ insurance if pct-based, approximated via goods share).
  const goodsRm = line.per_unit.goods; // = unitCost × fx
  const sstPct = line.rates_used.sst_pct / 100;
  const dutyAdValorem = line.rates_used.duty.type === "ad_valorem" ? line.rates_used.duty.value / 100 : 0;
  // per unit of supplier price (in RM): 1 + duty% (if ad valorem) + SST on (1 + duty%)
  const bPerRm = (1 + dutyAdValorem) * (1 + sstPct);
  const variable = goodsRm * bPerRm;
  const fixed = line.per_unit.landed - variable;

  const targetLanded = sell > 0 ? sell * (1 - marginPct / 100) : 0;
  const maxGoodsRm = targetLanded > 0 ? (targetLanded - fixed) / bPerRm : 0;
  const maxUnitCost = maxGoodsRm / fx;
  const feasible = maxUnitCost > 0;

  return (
    <Card>
      <div className="text-sm font-semibold">{t("Reverse: what can I pay the supplier?")}</div>
      <p className="mt-1 text-[12px] text-muted">For {line.name}. Taxes and logistics stay as calculated; only the supplier price moves.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">I want to sell at (RM / unit)</span>
          <input type="number" className={smallInputCls} value={sell || ""} placeholder="e.g. 120" onChange={(e) => setSell(Number(e.target.value) || 0)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Target gross margin %</span>
          <input type="number" className={smallInputCls} value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value) || 0)} />
        </label>
      </div>
      {sell > 0 && (
        <div className="mt-2.5 rounded-lg bg-ground p-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-muted">Landed cost must be ≤</span>
            <span>RM {rm(targetLanded)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Fixed taxes + logistics per unit</span>
            <span>RM {rm(fixed)}</span>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-line-2 pt-1.5 font-semibold">
            <span>Max supplier price</span>
            <span className={feasible ? "text-teal" : "text-red-700"}>
              {feasible ? `${currency} ${rm(maxUnitCost)}` : "not possible at this price"}
            </span>
          </div>
          {feasible && (
            <div className="mt-1 text-[11px] text-muted">
              You pay {currency} {rm(unitCost)} now{unitCost > maxUnitCost ? ` — ${rm(((unitCost - maxUnitCost) / unitCost) * 100, 0)}% too high` : ` — ${rm(((maxUnitCost - unitCost) / unitCost) * 100, 0)}% of room`}.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
