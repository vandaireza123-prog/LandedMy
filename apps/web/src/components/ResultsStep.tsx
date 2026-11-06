"use client";
import { useMemo, useState } from "react";
import { computeShipment, preferenceNote, type LineResult, type Shipment, type ShipmentResult } from "@landedmy/engine";
import { tablesFor } from "@/lib/shipment";
import { COUNTRIES, TIER_LABEL, fxDefault, localChargesFor } from "@/lib/country";
import { FX_DEFAULT } from "@/lib/lanes";
import { CompareDest } from "./CompareDest";
import type { AppState } from "@/lib/state";
import { Card, Footer, Progress, SecondaryButton, cs, rm, smallInputCls } from "./ui";
import { QuoteGap } from "./QuoteGap";
import { ReverseCalc } from "./ReverseCalc";
import { Scenarios } from "./Scenarios";
import { useT } from "@/lib/i18n";
import type { User } from "@supabase/supabase-js";
import { saveShipment } from "@/lib/supabase";
import { snapshotOf } from "@/lib/state";
import { QuoteSheet } from "./QuoteSheet";
import { requirementsFor } from "@/lib/compliance";


function Row({ k, v }: { k: string; v: number }) {
  const t = useT();
  return (
    <div className="flex justify-between">
      <span className="text-muted">{t(k)}</span>
      <span>{rm(v)}</span>
    </div>
  );
}

function LineCard({ l, currency, fx, unitCost, originIso }: { l: LineResult; currency: string; fx: number; unitCost: number; originIso: string }) {
  const t = useT();
  const prefNote = preferenceNote(originIso, l.hs_code);
  const [open, setOpen] = useState(false);
  const ex = l.rates_used.excise;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-[15px] font-semibold">{l.name}</div>
        <div className="shrink-0 font-display text-[22px] font-bold text-teal">
          {cs()} {rm(l.per_unit.landed)}
          <span className="text-xs font-medium text-muted"> {t("/ unit")}</span>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        <Row k={`Goods ${currency}${unitCost} × ${fx}`} v={l.per_unit.goods} />
        <Row k="Freight + insurance" v={l.per_unit.freight_insurance} />
        <Row k={l.rates_used.duty.value === 0 ? "Import duty · nil" : "Import duty"} v={l.per_unit.duty} />
        <Row k="Excise" v={l.per_unit.excise} />
        <Row k={`${l.rates_used.sst_name ?? "SST"} ${l.rates_used.sst_pct}%`} v={l.per_unit.sst} />
        <Row k="Local charges" v={l.per_unit.local_charges} />
      </div>
      <div className="mt-2.5 flex justify-between border-t border-line-2 pt-2.5 text-xs text-muted">
        <span>
          Case {cs()} {rm(l.per_case)}
          {l.per_pallet ? ` · Pallet ${cs()} ${rm(l.per_pallet, 0)}` : ""} · line {cs()} {rm(l.landed, 0)}
        </span>
        <button type="button" onClick={() => setOpen(!open)} className="font-semibold text-teal">
          {open ? t("Hide formula") : t("Show formula")}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg bg-ground p-2.5 font-mono text-[11px] leading-relaxed text-ink-2">
          {l.litres > 0 && <div>litres = {l.litres} L for {l.units} units</div>}
          <div>
            duty = {l.rates_used.duty.type === "per_litre" ? `${l.litres} L × ${cs()}${l.rates_used.duty.value}` : l.rates_used.duty.type === "per_litre_pure_alcohol" ? `${l.litres} L × ABV × ${cs()}${l.rates_used.duty.value}` : `CIF × ${l.rates_used.duty.value}%`} = {rm(l.duty)}
          </div>
          {ex && (
            <div>
              excise = {ex.type === "per_litre_pure_alcohol" ? `${l.litres} L × ABV × ${cs()}${ex.value}` : `${cs()}${ex.value}`} = {rm(l.excise)}
            </div>
          )}
          <div>{l.rates_used.sst_name ?? "SST"} = {l.rates_used.sst_pct}% × (CIF {rm(l.cif)} + duty + excise) = {rm(l.sst)}</div>
          <div className="mt-1 text-muted">
            Duty: {l.rates_used.duty.source_doc}
            {ex ? ` · Excise: ${ex.source_doc} (from ${ex.effective_from})` : ""}
            {l.rates_used.fta_agreement ? ` · ${l.rates_used.fta_agreement} preference` : ""}
            {prefNote ? ` · ${prefNote}` : ""}
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
  manualRateLines,
  user,
  onAccount,
}: {
  state: AppState;
  update: (p: Partial<AppState>) => void;
  reset: () => void;
  shipment: Shipment;
  shareUrl: string;
  manualRateLines: { hs_code: string; name: string; duty_pct: number; sst_pct: number }[];
  user: User | null;
  onAccount: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "fail">("idle");
  const [quote, setQuote] = useState(false);
  const result = useMemo<ShipmentResult | { error: string }>(() => {
    try {
      return computeShipment(shipment, tablesFor(state));
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [shipment, state]);

  if ("error" in result) {
    return (
      <>
        <Progress step={4} />
        <div className="p-5">
          <Card>
            <div className="text-sm font-semibold">Can’t price this shipment yet</div>
            <p className="mt-1 text-sm text-muted">
              {/excise/i.test(result.error) && COUNTRIES[state.dest_country].tier === "indicative"
                ? `Alcohol into ${COUNTRIES[state.dest_country].name} isn't priced yet: its excise rates haven't been loaded, and we don't guess them. Choose Malaysia or Singapore as the destination, or remove the alcohol lines.`
                : /fx_rate must be/i.test(result.error)
                  ? `Enter the exchange rate on step 1: how many ${COUNTRIES[state.dest_country].symbol} per 1 ${state.currency}. We have no feed for ${COUNTRIES[state.dest_country].currency} yet.`
                  : /No effective tariff/i.test(result.error) && COUNTRIES[state.dest_country].tier === "indicative"
                  ? `Enter the import duty % for every product (step 2) — ${COUNTRIES[state.dest_country].name} has no default rate we can safely apply.`
                  : result.error}
            </p>
          </Card>
        </div>
        <Footer>
          <SecondaryButton onClick={() => update({ step: 2 })}>Back to products</SecondaryButton>
        </Footer>
      </>
    );
  }

  const tot = result.totals;
  const units = result.lines.reduce((a, l) => a + l.units, 0);
  const pct = (n: number) => (tot.landed > 0 ? (n / tot.landed) * 100 : 0);
  const segs = [
    { k: t("Goods"), v: pct(tot.goods), c: "#FFFFFF" },
    { k: t("Duty"), v: pct(tot.duty), c: "#9ED3CE" },
    { k: t("Excise"), v: pct(tot.excise), c: "#5FB5AE" },
    { k: COUNTRIES[state.dest_country].tax_name, v: pct(tot.sst), c: "#2E8A84" },
    { k: t("Freight & local"), v: pct(tot.freight + tot.insurance + tot.local_charges), c: "#CFE9E6" },
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
  const saveToAccount = async () => {
    if (!user) return onAccount();
    if ("error" in result) return;
    setSaving("saving");
    try {
      const name = state.saved_name || prompt("Name this shipment", `${state.origin_label.split(",")[0]} ${result.date}`) || `Shipment ${result.date}`;
      const id = await saveShipment({ id: state.saved_id, name, snapshot: snapshotOf(state) as unknown as Record<string, unknown>, result, landed_total: result.totals.landed, alert: true, rate_version: "2025-11-01-budget2026" });
      update({ saved_id: id, saved_name: name });
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1500);
    } catch {
      setSaving("fail");
    }
  };
  const exportCsv = () => {
    const head = ["Product", "HS", "Units", "Litres", `Goods ${cs()}`, `Freight+Ins ${cs()}`, `CIF ${cs()}`, `Duty ${cs()}`, `Excise ${cs()}`, `${COUNTRIES[state.dest_country].tax_name} ${cs()}`, `Local ${cs()}`, `Landed ${cs()}`, `Landed/unit ${cs()}`];
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
      {!COUNTRIES[state.dest_country].verified && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-[10px] bg-amber-tint px-3 py-2.5 text-[12px] leading-snug text-amber">
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>{TIER_LABEL[COUNTRIES[state.dest_country].tier]}{COUNTRIES[state.dest_country].tier === "indicative" ? "" : " · verify"}.</strong> {COUNTRIES[state.dest_country].verify_note}
          </span>
        </div>
      )}
      <div className="mx-5 mt-3 rounded-2xl bg-teal p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-85">{t("Shipment landed at your warehouse")} · {COUNTRIES[state.dest_country].name}</div>
        <div className="mt-1.5 font-display text-[40px] font-bold leading-[1.05] tracking-tight">{cs()} {rm(tot.landed, 0)}</div>
        <div className="mt-1 text-[13px] opacity-85">
          {result.lines.length} product{result.lines.length === 1 ? "" : "s"} · {units.toLocaleString()} units · {t("tax is {n}% of it", { n: Math.round(tot.tax_share_pct) })}
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
          <LineCard key={l.id} l={l} currency={state.currency} fx={state.fx_rate} unitCost={state.products.find((p) => p.id === l.id)?.unit_cost ?? 0} originIso={state.origin_iso} />
        ))}

        <CompareDest
          state={state}
          shipment={shipment}
          manualRateLines={manualRateLines}
          onSwitch={(c) =>
            update({
              dest_country: c,
              dest_port: COUNTRIES[c].ports[0].code,
              fx_rate: fxDefault(c, state.currency, FX_DEFAULT),
              fx_source: "",
              local_charges: localChargesFor(c, state.equipment, state.pallets),
              local_touched: false,
              step: 1,
            })
          }
        />

        <Card>
          <div className="mb-2 text-sm font-semibold">{t("Margin check")}</div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="sell" className="text-[13px] text-muted">
              Sell {first?.name ?? "it"} at ({cs()} / unit)
            </label>
            <input id="sell" type="number" className={`${smallInputCls} !w-24 text-right`} value={state.sell_price || ""} onChange={(e) => update({ sell_price: Number(e.target.value) || 0 })} />
          </div>
          {state.sell_price > 0 && first && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">{t("Gross margin")}</span>
              <span className={`font-semibold ${margin >= 0 ? "text-teal" : "text-red-700"}`}>
                {cs()} {rm(margin)} · {Math.round((margin / state.sell_price) * 100)}%
              </span>
            </div>
          )}
        </Card>

        {first && <ReverseCalc line={first} currency={state.currency} fx={state.fx_rate} unitCost={state.products.find((p) => p.id === first.id)?.unit_cost ?? 0} />}

        <Scenarios state={state} update={update} current={result} />

        <QuoteGap state={state} shareUrl={shareUrl} landedTotal={tot.landed} />

        <Card>
          <div className="mb-2 text-sm font-semibold">{t("Before you ship")}</div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            {requirementsFor(state.products, state.dest_country).map((r) => (
              <label key={r.id} className="flex items-start gap-2.5">
                <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-teal" />
                <span>
                  {r.text}{" "}
                  <a href={r.url || COUNTRIES[state.dest_country].lookup} target="_blank" rel="noreferrer" className="whitespace-nowrap text-[11px] font-semibold text-teal">
                    {r.authority} →
                  </a>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">Shown for the product types in this shipment. Requirements, not costs; confirm with your customs agent.</p>
        </Card>

        {result.lines.some((l) => l.rates_used.fta_agreement) || !state.fta_claim ? (
          <label className="flex items-start gap-2 px-0.5 text-[12px] leading-snug text-ink-2">
            <input type="checkbox" className="mt-0.5 accent-teal" checked={state.fta_claim} onChange={(e) => update({ fta_claim: e.target.checked })} />
            <span>Claim FTA preferential duty (I will have the certificate of origin, e.g. ATIGA Form D). Untick to price at the MFN rate.</span>
          </label>
        ) : null}
        <div className="px-0.5 text-[11px] leading-relaxed text-muted">
          Rates: {COUNTRIES[state.dest_country].rates_note} Customs FX {cs()} {state.fx_rate}/{state.currency}. {COUNTRIES[state.dest_country].verify_note} Estimate only; final assessment by {COUNTRIES[state.dest_country].customs_name}.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={saveToAccount} className="h-11 rounded-[10px] bg-teal text-[13px] font-semibold text-white">
            {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "fail" ? "Failed, retry" : user ? (state.saved_id ? "Update in account" : "Save to account") : "Sign in to save"}
          </button>
          <button type="button" onClick={() => setQuote(true)} className="h-11 rounded-[10px] border border-teal bg-teal-tint text-[13px] font-semibold text-teal">
            {t("PDF / print")} quote
          </button>
          <button type="button" onClick={copy} className="h-11 rounded-[10px] border border-line bg-white text-[13px] font-semibold">
            {copied ? t("Copied") : t("Share link")}
          </button>
          <button type="button" onClick={exportCsv} className="h-11 rounded-[10px] border border-line bg-white text-[13px] font-semibold">
            CSV
          </button>
        </div>
        {quote && <QuoteSheet state={state} result={result} user={user} onClose={() => setQuote(false)} />}
      </div>

      <Footer>
        <div className="grid grid-cols-2 gap-2.5">
          <SecondaryButton onClick={() => update({ step: 3 })}>{t("Edit")}</SecondaryButton>
          <SecondaryButton onClick={reset}>{t("New shipment")}</SecondaryButton>
        </div>
      </Footer>
    </>
  );
}
