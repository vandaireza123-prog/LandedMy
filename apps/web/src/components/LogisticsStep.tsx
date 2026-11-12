"use client";
import type { AppState } from "@/lib/state";
import { MODES } from "@/lib/lanes";
import { FREIGHT_AS_OF, FREIGHT_AS_OF_ISO, freightFor } from "@/lib/freight";
import { freightIsAuto } from "@/lib/useFreightAuto";
import { DEST_PORTS } from "@/lib/ports";
import { useT } from "@/lib/i18n";
import { Card, Footer, PrimaryButton, Progress, Title, cs, rm, smallInputCls } from "./ui";

export function LogisticsStep({ state, update }: { state: AppState; update: (p: Partial<AppState>) => void }) {
  const t = useT();
  const mode = MODES[state.equipment] ?? MODES.pallet;
  const est = freightFor(state);
  const auto = freightIsAuto(state);
  const destLabel = DEST_PORTS.find((p) => p.code === state.dest_port)?.label.split(" (")[0];
  const localTotal = Object.values(state.local_charges).reduce((a, b) => a + b, 0);
  const cif = state.incoterm === "CIF";

  const setLocal = (k: string, v: number) => update({ local_charges: { ...state.local_charges, [k]: v }, local_touched: true });

  return (
    <>
      <Progress step={3} />
      <Title step={3} title="Freight and charges" sub="We fill in a typical freight price for your route and mode. Got a forwarder quote? Type it over ours." />
      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              {mode.freight}, {state.origin_label.split(",")[0]} → {destLabel}
            </div>
            {!cif && est.ok && !auto && (
              <button type="button" onClick={() => update({ freight_auto: true })} className="text-xs font-semibold text-teal">
                Use our estimate
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
                  <input type="number" className={smallInputCls} value={state.freight || ""} placeholder={est.ok ? String(est.mid) : "your quote"} onChange={(e) => update({ freight: Number(e.target.value) || 0, freight_auto: false })} />
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
              {est.ok ? (
                <div className={`mt-2.5 rounded-lg px-3 py-2 text-[11.5px] leading-snug ${est.tier === "index" ? "bg-teal-tint text-teal" : "bg-amber-tint text-amber"}`}>
                  <div className="font-semibold">
                    {auto ? "Using our estimate: " : "Our estimate: "}
                    {est.currency} {est.low.toLocaleString()}–{est.high.toLocaleString()}
                    {est.tier === "index" ? " · from published freight indices" : " · rough estimate, get a quote"}
                  </div>
                  <div className="mt-0.5 opacity-90">{est.basis}. {est.note ?? ""} Market week of {FREIGHT_AS_OF}
                    {Date.now() - Date.parse(FREIGHT_AS_OF_ISO) > 21 * 86400000 ? " (more than 3 weeks old: prices may have moved)" : ""}; excludes destination charges (below).</div>
                </div>
              ) : (
                <div className="mt-2.5 rounded-lg bg-amber-tint px-3 py-2 text-[11.5px] leading-snug text-amber">{est.reason} Leaving freight at 0 gives a duty-paid price without freight.</div>
              )}
            </>
          )}
        </Card>

        <Card>
          <div className="mb-2.5 text-sm font-semibold">{t("Local charges")}, {destLabel} ({cs()})</div>
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
            <span className="font-semibold">{cs()} {rm(localTotal, 0)}</span>
          </div>
        </Card>

        <div className="flex items-start gap-2.5 rounded-xl bg-teal-tint px-3.5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5E5A" strokeWidth="2" aria-hidden="true" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <div className="text-xs leading-snug text-teal">Permits, licences and stamps your products need are listed on the results page; nothing is charged for them.</div>
        </div>
      </div>
      <Footer>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => update({ step: 2 })} className="h-[54px] rounded-xl border border-line bg-white px-5 text-[15px] font-semibold">
            {t("Back")}
          </button>
          <PrimaryButton onClick={() => update({ step: 4 })}>{t("Calculate landed cost")}</PrimaryButton>
        </div>
      </Footer>
    </>
  );
}
