"use client";
import { useEffect, useState } from "react";
import { fetchFx, type FxResponse } from "@/lib/api";
import type { AppState } from "@/lib/state";
import { EQUIPMENT_LABEL, FX_AS_OF, FX_DEFAULT, defaultLocalCharges, type Equipment } from "@/lib/lanes";
import { DEST_PORTS, type Port } from "@/lib/ports";
import { PortPicker } from "./PortPicker";
import { Field, Footer, PrimaryButton, Progress, Title, inputCls } from "./ui";

const INCOTERMS: { v: AppState["incoterm"]; label: string }[] = [
  { v: "EXW", label: "EXW (ex-works)" },
  { v: "FOB", label: "FOB (on board)" },
  { v: "CIF", label: "CIF (delivered to port)" },
];

export function SetupStep({ state, update }: { state: AppState; update: (p: Partial<AppState>) => void }) {
  const [fx, setFx] = useState<FxResponse | null>(null);
  useEffect(() => {
    fetchFx().then((r) => {
      if (!r) return;
      setFx(r);
      if (!state.fx_source && r.rates[state.currency]) update({ fx_rate: r.rates[state.currency], fx_source: `${r.source}, ${r.as_of}` });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rateFor = (cur: string) => fx?.rates[cur] ?? FX_DEFAULT[cur] ?? state.fx_rate;
  const sourceFor = (cur: string) => (fx?.rates[cur] ? `${fx.source}, ${fx.as_of}` : "");
  const onPort = (p: Port) =>
    update({ origin_port: p.code, origin_iso: p.iso, origin_label: `${p.name}, ${p.country}`, currency: p.currency, fx_rate: rateFor(p.currency), fx_source: sourceFor(p.currency) });
  const onCustomPort = (name: string) => update({ origin_port: "CUSTOM", origin_label: name });
  const onEquip = (e: Equipment) =>
    update({ equipment: e, local_charges: state.local_touched ? state.local_charges : defaultLocalCharges(e, state.pallets) });

  return (
    <>
      <Progress step={1} />
      <Title step={1} title="Where is it coming from?" sub="Set the lane once. Every product you add next shares it." />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">From port</span>
          <PortPicker value={state.origin_port} label={state.origin_label} onPick={onPort} onCustom={onCustomPort} />
        </div>
        <Field label="To port">
          <select className={inputCls} value={state.dest_port} onChange={(e) => update({ dest_port: e.target.value })}>
            {DEST_PORTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Shipment type</span>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => {
              const on = state.equipment === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => onEquip(e)}
                  className={`h-12 rounded-[10px] text-[13px] ${on ? "border-2 border-teal bg-teal-tint font-semibold text-teal" : "border border-line bg-white font-medium text-ink-2"}`}
                >
                  {EQUIPMENT_LABEL[e].replace(" (LCL)", "")}
                </button>
              );
            })}
          </div>
        </div>

        {state.equipment === "pallet" && (
          <Field label="Number of pallets">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={state.pallets}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value) || 1);
                update({ pallets: n, local_charges: state.local_touched ? state.local_charges : defaultLocalCharges("pallet", n) });
              }}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price basis">
            <select className={inputCls} value={state.incoterm} onChange={(e) => update({ incoterm: e.target.value as AppState["incoterm"] })}>
              {INCOTERMS.map((i) => (
                <option key={i.v} value={i.v}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select
              className={inputCls}
              value={state.currency}
              onChange={(e) => update({ currency: e.target.value, fx_rate: rateFor(e.target.value), fx_source: sourceFor(e.target.value) })}
            >
              {Object.keys(FX_DEFAULT)
                .filter((c) => c !== "MYR")
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </Field>
        </div>

        <div className="mt-1 flex items-center justify-between rounded-[10px] border border-line bg-white px-3.5 py-3">
          <div>
            <div className="text-xs text-muted">Customs exchange rate</div>
            <div className="flex items-baseline gap-1 text-[15px] font-semibold">
              1 {state.currency} = RM
              <input
                type="number"
                step="0.0001"
                className="w-24 border-b border-line bg-transparent text-[15px] font-semibold outline-none focus:border-teal"
                value={state.fx_rate}
                onChange={(e) => update({ fx_rate: Number(e.target.value) || 0, fx_source: "entered by you" })}
              />
            </div>
          </div>
          <div className="max-w-[45%] text-right text-[11px] leading-tight text-muted">{state.fx_source || FX_AS_OF}</div>
        </div>
        <div className="text-[11px] text-muted">
          Lane: {state.origin_label} → {DEST_PORTS.find((p) => p.code === state.dest_port)?.label}
          {state.origin_port === "CUSTOM" ? " · origin country for duty: " : ""}
          {state.origin_port === "CUSTOM" && (
            <input className="w-10 border-b border-line bg-transparent text-center uppercase outline-none" maxLength={2} value={state.origin_iso} onChange={(e) => update({ origin_iso: e.target.value.toUpperCase() })} aria-label="Origin country code" />
          )}
        </div>
      </div>
      <Footer>
        <PrimaryButton onClick={() => update({ step: 2 })} disabled={!(state.fx_rate > 0)}>
          Add products
        </PrimaryButton>
      </Footer>
    </>
  );
}
