"use client";
import type { AppState } from "@/lib/state";
import { BENCHMARK_AS_OF, EQUIPMENT_LABEL, benchmarkFor } from "@/lib/lanes";
import { DEST_PORTS } from "@/lib/ports";
import { Card, Footer, PrimaryButton, Progress, Title, rm, smallInputCls } from "./ui";

export function LogisticsStep({ state, update }: { state: AppState; update: (p: Partial<AppState>) => void }) {
  const bench = benchmarkFor(state.origin_port, state.equipment);
  const units = state.equipment === "pallet" ? state.pallets : 1;
  const benchMid = bench ? Math.round(((bench.low + bench.high) / 2) * units) : 0;
  const destLabel = DEST_PORTS.find((p) => p.code === state.dest_port)?.label.split(" (")[0];
  const localTotal = Object.values(state.local_charges).reduce((a, b) => a + b, 0);
  const cif = state.incoterm === "CIF";

  const setLocal = (k: string, v: number) => update({ local_charges: { ...state.local_charges, [k]: v }, local_touched: true });

  return (
    <>
      <Progress step={3} />
      <Title step={3} title="Freight and charges" sub="Got a forwarder quote? Enter it. If not, use our lane benchmark." />
      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              Sea freight, {state.origin_label.split(",")[0]} → {destLabel}
            </div>
            {!cif && bench && (
              <button type="button" onClick={() => update({ freight: benchMid })} className="text-xs font-semibold text-teal">
                Use benchmark
              </button>
            )}
          </div>
          {cif ? (
            <p className="mt-2 text-xs text-muted">Price basis is CIF: freight and insurance are already in your supplier’s price.</p>
          ) : (
            <>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted">Freight ({state.currency})</span>
                  <input type="number" className={smallInputCls} value={state.freight || ""} placeholder={bench ? String(benchMid) : "your quote"} onChange={(e) => update({ freight: Number(e.target.value) || 0 })} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted">Insurance (% of goods)</span>
                  <input type="number" step="0.1" className={smallInputCls} value={state.insurance_pct} onChange={(e) => update({ insurance_pct: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-[11px] text-muted">Did a forwarder quote you? Enter it to compare ({state.currency}, optional)</span>
                <input type="number" className={smallInputCls} value={state.forwarder_quote || ""} placeholder="e.g. 520" onChange={(e) => update({ forwarder_quote: Number(e.target.value) || 0 })} />
              </label>
              <div className="mt-2 text-[11px] text-muted">
                {bench
                  ? `Benchmark: ${bench.currency} ${bench.low.toLocaleString()}–${bench.high.toLocaleString()} per ${EQUIPMENT_LABEL[state.equipment].toLowerCase()}${units > 1 ? ` × ${units}` : ""} · ${BENCHMARK_AS_OF}`
                  : "No benchmark for this lane yet — enter your forwarder's quote. Leaving it at 0 gives a duty-paid price without freight."}
              </div>
            </>
          )}
        </Card>

        <Card>
          <div className="mb-2.5 text-sm font-semibold">Local charges, {destLabel} (RM)</div>
          <div className="flex flex-col gap-2">
            {Object.entries(state.local_charges).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <label htmlFor={`lc-${k}`} className="text-sm">
                  {k}
                </label>
                <input id={`lc-${k}`} type="number" className={`${smallInputCls} !w-24 text-right`} value={v} onChange={(e) => setLocal(k, Number(e.target.value) || 0)} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-line-2 pt-2.5 text-sm">
            <span className="text-muted">Total local</span>
            <span className="font-semibold">RM {rm(localTotal, 0)}</span>
          </div>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl bg-teal-tint px-3.5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5E5A" strokeWidth="2" aria-hidden="true" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <div className="text-xs leading-snug text-teal">Alcohol needs an import licence and customs tax stamps. We list what you need on the results page; nothing is charged for it.</div>
        </div>
      </div>
      <Footer>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => update({ step: 2 })} className="h-[54px] rounded-xl border border-line bg-white px-5 text-[15px] font-semibold">
            Back
          </button>
          <PrimaryButton onClick={() => update({ step: 4 })}>Calculate landed cost</PrimaryButton>
        </div>
      </Footer>
    </>
  );
}
