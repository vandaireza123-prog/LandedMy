"use client";
import { useMemo, useState } from "react";
import { buildRateTables, computeShipment, type LineResult, type Shipment, type ShipmentResult } from "@landedmy/engine";
import type { AppState } from "@/lib/state";
import { Card, Footer, Progress, SecondaryButton, rm, smallInputCls } from "./ui";
import { QuoteGap } from "./QuoteGap";

const rates = buildRateTables();

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{k}</span>
      <span>{rm(v)}</span>
    </div>
  );
}

function LineCard({ l, currency, fx, unitCost }: { l: LineResult; currency: string; fx: number; unitCost: number }) {
  const [open, setOpen] = useState(false);
  const ex = l.rates_used.excise;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-[15px] font-semibold">{l.name}</div>
        <div className="shrink-0 font-display text-[22px] font-bold text-teal">
          RM {rm(l.per_unit.landed)}
          <span className="text-xs font-medium text-muted"> / unit</span>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        <Row k={`Goods ${currency}${unitCost} × ${fx}`} v={l.per_unit.goods} />
        <Row k="Freight + insurance" v={l.per_unit.freight_insurance} />
        <Row k="Import duty" v={l.per_unit.duty} />
        <Row k="Excise" v={l.per_unit.excise} />
        <Row k="SST 10%" v={l.per_unit.sst} />
        <Row k="Local charges" v={l.per_unit.local_charges} />
      </div>
      <div className="mt-2.5 flex justify-between border-t border-line-2 pt-2.5 text-xs text-muted">
        <span>
          Case RM {rm(l.per_case)}
          {l.per_pallet ? ` · Pallet RM ${rm(l.per_pallet, 0)}` : ""} · line RM {rm(l.landed, 0)}
        </span>
        <button type="button" onClick={() => setOpen(!open)} className="font-semibold text-teal">
          {open ? "Hide formula" : "Show formula"}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg bg-ground p-2.5 font-mono text-[11px] leading-relaxed text-ink-2">
          <div>litres = {l.litres} L for {l.units} units</div>
          <div>
            duty = {l.rates_used.duty.type === "per_litre" ? `${l.litres} L × RM${l.rates_used.duty.value}` : l.rates_used.duty.type === "per_litre_pure_alcohol" ? `${l.litres} L × ABV × RM${l.rates_used.duty.value}` : `CIF × ${l.rates_used.duty.value}%`} = {rm(l.duty)}
          </div>
          {ex && (
            <div>
              excise = {ex.type === "per_litre_pure_alcohol" ? `${l.litres} L × ABV × RM${ex.value}` : `RM${ex.value}`} = {rm(l.excise)}
            </div>
          )}
          <div>SST = 10% × (CIF {rm(l.cif)} + duty + excise) = {rm(l.sst)}</div>
          <div className="mt-1 text-muted">
            Duty: {l.rates_used.duty.source_doc}
            {ex ? ` · Excise: ${ex.source_doc} (from ${ex.effective_from})` : ""}
            {l.rates_used.fta_agreement ? ` · ${l.rates_used.fta_agreement} preference` : ""}
          </div>
        </div>
      )}
    </Card>
  );
}

export function ResultsStep({
  state,
  update,
  reset,
  shipment,
  shareUrl,
}: {
  state: AppState;
  update: (p: Partial<AppState>) => void;
  reset: () => void;
  shipment: Shipment;
  shareUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const result = useMemo<ShipmentResult | { error: string }>(() => {
    try {
      return computeShipment(shipment, rates);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [shipment]);

  if ("error" in result) {
    return (
      <>
        <Progress step={4} />
        <div className="p-5">
          <Card>
            <div className="text-sm font-semibold">Can’t price this shipment yet</div>
            <p className="mt-1 text-sm text-muted">{result.error}</p>
          </Card>
        </div>
        <Footer>
          <SecondaryButton onClick={() => update({ step: 2 })}>Back to products</SecondaryButton>
        </Footer>
      </>
    );
  }

  const t = result.totals;
  const units = result.lines.reduce((a, l) => a + l.units, 0);
  const pct = (n: number) => (t.landed > 0 ? (n / t.landed) * 100 : 0);
  const segs = [
    { k: "Goods", v: pct(t.goods), c: "#FFFFFF" },
    { k: "Duty", v: pct(t.duty), c: "#9ED3CE" },
    { k: "Excise", v: pct(t.excise), c: "#5FB5AE" },
    { k: "SST", v: pct(t.sst), c: "#2E8A84" },
    { k: "Freight & local", v: pct(t.freight + t.insurance + t.local_charges), c: "#CFE9E6" },
  ];
  const first = result.lines[0];
  const margin = state.sell_price > 0 && first ? state.sell_price - first.per_unit.landed : 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Copy this link", shareUrl);
    }
  };
  const exportCsv = () => {
    const head = ["Product", "HS", "Units", "Litres", "Goods RM", "Freight+Ins RM", "CIF RM", "Duty RM", "Excise RM", "SST RM", "Local RM", "Landed RM", "Landed/unit RM"];
    const rows = result.lines.map((l) => [l.name, l.hs_code, l.units, l.litres, l.goods, l.freight + l.insurance, l.cif, l.duty, l.excise, l.sst, l.local_charges, l.landed, l.per_unit.landed]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `landedmy-${result.date}.csv`;
    a.click();
  };

  return (
    <>
      <Progress step={4} />
      <div className="mx-5 mt-3 rounded-2xl bg-teal p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-85">Shipment landed at your warehouse</div>
        <div className="mt-1.5 font-display text-[40px] font-bold leading-[1.05] tracking-tight">RM {rm(t.landed, 0)}</div>
        <div className="mt-1 text-[13px] opacity-85">
          {result.lines.length} product{result.lines.length === 1 ? "" : "s"} · {units.toLocaleString()} units · tax is {Math.round(t.tax_share_pct)}% of it
        </div>
        <div className="mt-3.5 flex h-2.5 overflow-hidden rounded-full bg-white/20">
          {segs.map((s) => (
            <div key={s.k} style={{ width: `${s.v}%`, background: s.c }} />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] opacity-90">
          {segs.map((s) => (
            <span key={s.k}>
              ■ {s.k} {Math.round(s.v)}%
            </span>
          ))}
        </div>
        {result.warnings.map((w) => (
          <div key={w} className="mt-2 text-[11px] opacity-85">
            ⚠ {w}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        {result.lines.map((l) => (
          <LineCard key={l.id} l={l} currency={state.currency} fx={state.fx_rate} unitCost={state.products.find((p) => p.id === l.id)?.unit_cost ?? 0} />
        ))}

        <Card>
          <div className="mb-2 text-sm font-semibold">Margin check</div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="sell" className="text-[13px] text-muted">
              Sell {first?.name ?? "it"} at (RM / unit)
            </label>
            <input id="sell" type="number" className={`${smallInputCls} !w-24 text-right`} value={state.sell_price || ""} onChange={(e) => update({ sell_price: Number(e.target.value) || 0 })} />
          </div>
          {state.sell_price > 0 && first && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Gross margin</span>
              <span className={`font-semibold ${margin >= 0 ? "text-teal" : "text-red-700"}`}>
                RM {rm(margin)} · {Math.round((margin / state.sell_price) * 100)}%
              </span>
            </div>
          )}
        </Card>

        <QuoteGap state={state} shareUrl={shareUrl} landedTotal={t.landed} />

        <Card>
          <div className="mb-2 text-sm font-semibold">Before you ship</div>
          <div className="flex flex-col gap-2 text-[13px]">
            {["Import licence for alcohol (RMCD)", "Customs tax stamps on every bottle", "Labels meet Food Regulations (from 1 Apr 2026)", "Sales tax registration if over threshold"].map((s) => (
              <label key={s} className="flex items-center gap-2.5">
                <input type="checkbox" className="h-[18px] w-[18px] accent-teal" />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </Card>

        <div className="px-0.5 text-[11px] leading-relaxed text-muted">
          Rates: Customs Duties Order 2022 · Excise Duties Order 2022 as raised 1 Nov 2025 (Budget 2026) · SST 10% on CIF + duty + excise. Customs FX RM {state.fx_rate}/{state.currency}. Calculation verified against RMCD K1 assessments. Estimate only; final assessment by RMCD.
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={copy} className="h-11 rounded-[10px] border border-line bg-white text-[13px] font-semibold">
            {copied ? "Copied" : "Share link"}
          </button>
          <button type="button" onClick={exportCsv} className="h-11 rounded-[10px] border border-line bg-white text-[13px] font-semibold">
            CSV
          </button>
          <button type="button" onClick={() => window.print()} className="h-11 rounded-[10px] border border-line bg-white text-[13px] font-semibold">
            PDF / print
          </button>
        </div>
      </div>

      <Footer>
        <div className="grid grid-cols-2 gap-2.5">
          <SecondaryButton onClick={() => update({ step: 3 })}>Edit</SecondaryButton>
          <SecondaryButton onClick={reset}>New shipment</SecondaryButton>
        </div>
      </Footer>
    </>
  );
}
