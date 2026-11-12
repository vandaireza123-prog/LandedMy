"use client";
/**
 * Duty for one non-drink product on the result page. The rate is filled automatically for the chosen route; where
 * none is loaded the user types it here (this used to sit on the product step, before a destination existed).
 */
import { GENERAL_LINES } from "@landedmy/engine";
import { COUNTRIES, type DestCountry } from "@/lib/country";
import { dutyKey } from "@/lib/useDutyPrefill";
import { isManualLine, type ProductRow } from "@/lib/shipment";
import type { AppState } from "@/lib/state";
import { smallInputCls } from "./ui";

/** A non-drink product that still has no duty rate for this route. */
export function needsDuty(p: ProductRow, dest: DestCountry): boolean {
  if (p.category !== "general") return false;
  const indicative = COUNTRIES[dest].tier === "indicative";
  if (!indicative && !isManualLine(p, dest)) return false;
  return p.manual_duty_pct == null && (p.duty_source === "none" || !!p.duty_source?.includes("enter the %") || !p.hs6);
}

export function DutyEditor({ p, state, update }: { p: ProductRow; state: AppState; update: (patch: Partial<AppState>) => void }) {
  const country = COUNTRIES[state.dest_country];
  const indicative = country.tier === "indicative";
  const patch = (x: Partial<ProductRow>) => update({ products: state.products.map((r) => (r.id === p.id ? { ...r, ...x } : r)) });
  const typed = (v: string) => patch({ manual_duty_pct: v === "" ? undefined : Number(v) || 0, duty_source: v === "" ? "none" : "you", duty_for: dutyKey(state, p) });
  const code = p.hs6 ? `${p.hs6.slice(0, 4)}.${p.hs6.slice(4)}` : "the code";
  const missing = needsDuty(p, state.dest_country);
  const myLines = state.dest_country === "MY" ? GENERAL_LINES.filter((g) => (p.hs6 ? g.hs_code.replace(/\./g, "").startsWith(p.hs6.slice(0, 4)) : false) || g.group === (p.general_group ?? "other")) : [];

  return (
    <div id={`duty-${p.id}`} className={`mt-2.5 rounded-lg px-2.5 py-2 ${missing ? "bg-amber-tint" : "bg-ground"}`}>
      {myLines.length > 0 && (
        <label className="mb-2 flex flex-col gap-1">
          <span className="text-[11px] text-muted">Malaysian tariff line</span>
          <select
            className={smallInputCls}
            value={isManualLine(p, "MY") ? "MANUAL" : p.hs_code}
            onChange={(e) => {
              const line = GENERAL_LINES.find((g) => g.hs_code === e.target.value);
              patch(line ? { hs_code: line.hs_code, hs_confirmed: true, manual_duty_pct: line.duty_pct, manual_sst_pct: line.sst_pct, duty_source: "Customs Duties Order 2022 · verified", duty_for: dutyKey(state, p) } : { hs_code: "MANUAL", hs_confirmed: false });
            }}
          >
            <option value="MANUAL">Enter duty % myself</option>
            {myLines.map((g) => (
              <option key={g.hs_code} value={g.hs_code}>
                {g.hs_code} · {g.description} · duty {g.duty_pct}% · SST {g.sst_pct}%
              </option>
            ))}
          </select>
        </label>
      )}
      {(indicative || isManualLine(p, state.dest_country)) && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={`text-[11px] ${missing ? "font-semibold text-amber" : "text-muted"}`}>Import duty % into {country.name}</span>
            <input type="number" step="0.5" className={`${smallInputCls} ${missing ? "border-amber" : ""}`} value={p.manual_duty_pct ?? ""} placeholder={missing ? "enter %" : country.duty_default_pct != null ? String(country.duty_default_pct) : ""} onChange={(e) => typed(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted">{country.tax_name}</span>
            {state.dest_country === "MY" ? (
              <select className={smallInputCls} value={p.manual_sst_pct ?? 10} onChange={(e) => patch({ manual_sst_pct: Number(e.target.value) })}>
                <option value={0}>0% (exempt)</option>
                <option value={5}>5%</option>
                <option value={10}>10%</option>
              </select>
            ) : (
              <div className={`${smallInputCls} flex items-center bg-white/60 text-muted`}>{country.tax_name === "Tax" ? "none at import" : `${country.tax_pct}% · applied`}</div>
            )}
          </label>
        </div>
      )}
      <div className="mt-1.5 text-[10px] leading-snug text-muted">
        {missing
          ? `No rate loaded for ${code} into ${country.name} yet${country.duty_default_pct != null ? ` — ${country.duty_default_pct}% common rate used until you enter it` : ""}.`
          : p.duty_source === "you"
            ? "Entered by you."
            : p.duty_source
              ? `Filled: ${p.duty_source}`
              : ""}{" "}
        <a href={country.lookup} target="_blank" rel="noreferrer" className="font-semibold text-teal">
          Look up {code} on {country.customs_name}&apos;s tariff tool →
        </a>
      </div>
      {p.duty_notes && p.duty_notes.length > 0 && (
        <div className="mt-1.5 text-[10px] leading-snug text-amber">
          <strong>Additional duties for this origin (not in the rate above):</strong> {p.duty_notes.slice(0, 3).join(" · ")}
          {p.duty_notes.length > 3 ? ` · and ${p.duty_notes.length - 3} more` : ""}
        </div>
      )}
    </div>
  );
}
