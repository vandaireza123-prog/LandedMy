"use client";
import { useEffect, useState } from "react";
import { fetchFx, type FxResponse } from "@/lib/api";
import type { AppState } from "@/lib/state";
import { FX_AS_OF, FX_DEFAULT, MODES, MODE_GROUPS, type Equipment } from "@/lib/lanes";
import { freightFor } from "@/lib/freight";
import { modeCount, shipmentKg } from "@/lib/shipment";
import { suggestModes } from "@/lib/modes";
import type { Port } from "@/lib/ports";
import { COUNTRIES, fxDefault, fxFromBnm, localChargesFor, type DestCountry } from "@/lib/country";
import { CountryPicker } from "./CountryPicker";
import { PortPicker } from "./PortPicker";
import { useT } from "@/lib/i18n";
import { Field, Footer, PrimaryButton, Progress, Title, inputCls } from "./ui";

const INCOTERMS: { v: AppState["incoterm"]; label: string }[] = [
  { v: "EXW", label: "EXW (ex-works)" },
  { v: "FOB", label: "FOB (on board)" },
  { v: "CIF", label: "CIF (delivered to port)" },
];

export function SetupStep({ state, update }: { state: AppState; update: (p: Partial<AppState>) => void }) {
  const t = useT();
  const [fx, setFx] = useState<FxResponse | null>(null);
  useEffect(() => {
    fetchFx().then((r) => {
      if (!r) return;
      setFx(r);
      const live = fxFromBnm(state.dest_country, r.rates, state.currency);
      if (!state.fx_source && live) update({ fx_rate: live, fx_source: `${r.source}, ${r.as_of}` });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const country = COUNTRIES[state.dest_country];
  const rateFor = (cur: string, c: DestCountry = state.dest_country) => (fx ? fxFromBnm(c, fx.rates, cur) : undefined) ?? fxDefault(c, cur, FX_DEFAULT);
  const sourceFor = (cur: string, c: DestCountry = state.dest_country) => (fx && fxFromBnm(c, fx.rates, cur) ? `${fx.source}, ${fx.as_of}${c === "SG" ? " (cross rate)" : ""}` : "");
  const onCountry = (c: DestCountry) => {
    if (c === state.dest_country) return;
    update({
      dest_country: c,
      dest_port: COUNTRIES[c].ports[0].code,
      fx_rate: rateFor(state.currency, c),
      fx_source: sourceFor(state.currency, c),
      local_charges: localChargesFor(c, state.equipment, modeCount(state)),
      local_touched: false,
    });
  };
  // FX follows the invoice currency picked on step 1.
  useEffect(() => {
    if (state.fx_source === "entered by you") return;
    update({ fx_rate: rateFor(state.currency), fx_source: sourceFor(state.currency) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currency, state.dest_country, fx]);
  const kg = shipmentKg(state.products);
  const suggestions = suggestModes(state.products, kg);
  const recount = (patch: Partial<AppState>) => {
    const next = { ...state, ...patch };
    update({ ...patch, local_charges: state.local_touched ? state.local_charges : localChargesFor(state.dest_country, next.equipment, modeCount(next)) });
  };
  // The invoice currency was chosen with the products; picking a port no longer changes it.
  const onPort = (p: Port) => update({ origin_port: p.code, origin_iso: p.iso, origin_label: `${p.name}, ${p.country}` });
  const onCustomPort = (name: string) => update({ origin_port: "CUSTOM", origin_label: name });
  const onEquip = (e: Equipment) => recount({ equipment: e });
  const mode = MODES[state.equipment] ?? MODES.pallet;

  return (
    <>
      <Progress step={2} />
      <Title step={2} title="From where, to where, how?" sub="Duty and tax are filled for the country you pick." />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <CountryPicker value={state.dest_country} onChange={onCountry} />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">{t("From port")}</span>
          <PortPicker value={state.origin_port} label={state.origin_label} onPick={onPort} onCustom={onCustomPort} />
        </div>
        <Field label={t("To port")}>
          <select className={inputCls} value={state.dest_port} onChange={(e) => update({ dest_port: e.target.value })}>
            {country.ports.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">{t("How is it shipped?")}</span>
          {suggestions.length > 0 && (
            <div className="rounded-[10px] bg-teal-tint px-3 py-2 text-[12px] leading-snug text-teal">
              Suggested for {kg ? `${kg.toLocaleString()} kg, ` : ""}
              {state.products.length} product{state.products.length === 1 ? "" : "s"}:{" "}
              {suggestions.map((sg, i) => (
                <span key={sg.mode}>
                  {i > 0 ? (i === suggestions.length - 1 ? " or " : ", ") : ""}
                  <button type="button" onClick={() => onEquip(sg.mode)} className="font-semibold underline decoration-dotted underline-offset-2">
                    {MODES[sg.mode].label}
                  </button>
                  {(() => {
                    const b = freightFor(state, sg.mode);
                    return b.ok ? ` (freight ≈ ${b.currency} ${b.low.toLocaleString()}–${b.high.toLocaleString()})` : "";
                  })()}
                </span>
              ))}
              . {suggestions[0].why}
            </div>
          )}
          {MODE_GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(MODES) as Equipment[])
                  .filter((e) => MODES[e].group === g)
                  .map((e) => {
                    const on = state.equipment === e;
                    const sug = suggestions.some((x) => x.mode === e);
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => onEquip(e)}
                        aria-pressed={on}
                        className={`rounded-[9px] px-2.5 py-1.5 text-[12px] ${on ? "border-2 border-teal bg-teal-tint font-semibold text-teal" : `border bg-white font-medium text-ink-2 ${sug ? "border-teal" : "border-line"}`}`}
                      >
                        {MODES[e].label}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {mode.measure === "pallets" && (
          <Field label={t("Number of pallets")}>
            <input type="number" min={1} className={inputCls} value={state.pallets} onChange={(e) => recount({ pallets: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        )}
        {(mode.measure === "containers" || mode.measure === "trucks" || mode.measure === "units") && (
          <Field label={mode.measure === "containers" ? t("Number of containers") : mode.measure === "trucks" ? t("Number of trucks") : state.equipment === "roro" ? t("Number of vehicles or units") : t("Number of pieces (crates, lifts)")}>
            <input type="number" min={1} className={inputCls} value={state.mode_qty ?? 1} onChange={(e) => recount({ mode_qty: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        )}
        {mode.measure === "cbm" && (
          <Field label={t("Volume (m³)")}>
            <input type="number" min={0.1} step="0.1" className={inputCls} value={state.cbm ?? 1} onChange={(e) => recount({ cbm: Math.max(0.1, Number(e.target.value) || 0.1) })} />
          </Field>
        )}
        {mode.measure === "kg" && (
          <Field label={t("Chargeable weight (kg)")}>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={state.chargeable_kg ?? kg ?? ""}
              placeholder="e.g. 450"
              onChange={(e) => recount({ chargeable_kg: e.target.value === "" ? undefined : Math.max(1, Number(e.target.value) || 1) })}
            />
            <span className="mt-1 text-[11px] text-muted">{kg ? `Your products weigh ${kg.toLocaleString()} kg. Airlines charge the greater of actual weight and volume weight (L × W × H cm ÷ 6,000).` : "Add a weight per item on step 1 to fill this in."}</span>
          </Field>
        )}
        {mode.measure === "none" && <p className="text-[12px] leading-snug text-muted">The aircraft is delivered under its own power. Enter the ferry-flight cost (crew, fuel, permits, insurance) on the next step; import duty and tax still apply on arrival.</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Price basis")}>
            <select className={inputCls} value={state.incoterm} onChange={(e) => update({ incoterm: e.target.value as AppState["incoterm"] })}>
              {INCOTERMS.map((i) => (
                <option key={i.v} value={i.v}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Invoice currency")}>
            <div className={`${inputCls} flex items-center justify-between bg-ground text-muted`}>
              {state.currency}
              <button type="button" onClick={() => update({ step: 1 })} className="text-[12px] font-semibold text-teal">
                {t("Change")}
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-1 flex items-center justify-between rounded-[10px] border border-line bg-white px-3.5 py-3">
          <div>
            <div className="text-xs text-muted">{t("Customs exchange rate")}</div>
            <div className="flex items-baseline gap-1 text-[15px] font-semibold">
              1 {state.currency} = {country.symbol}
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
          Lane: {state.origin_label} → {country.ports.find((p) => p.code === state.dest_port)?.label}
          {state.origin_port === "CUSTOM" ? " · origin country for duty: " : ""}
          {state.origin_port === "CUSTOM" && (
            <input className="w-10 border-b border-line bg-transparent text-center uppercase outline-none" maxLength={2} value={state.origin_iso} onChange={(e) => update({ origin_iso: e.target.value.toUpperCase() })} aria-label="Origin country code" />
          )}
        </div>
      </div>
      <Footer>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => update({ step: 1 })} className="h-[54px] rounded-xl border border-line bg-white px-5 text-[15px] font-semibold">
            {t("Back")}
          </button>
          <PrimaryButton onClick={() => update({ step: 3 })} disabled={!(state.fx_rate > 0)}>
            {t("Next: freight and charges")}
          </PrimaryButton>
        </div>
      </Footer>
    </>
  );
}
