"use client";
import { useMemo, useState } from "react";
import { computeShipment, manualRates, mergeRates, ratesFor, withoutFta, type ShipmentResult } from "@landedmy/engine";
import { buildShipment, manualLinesOf, snapshotOf, type AppState, type Scenario } from "@/lib/state";
import { EQUIPMENT_LABEL } from "@/lib/lanes";
import { Card, cs, rm, smallInputCls } from "./ui";
import { useT } from "@/lib/i18n";

const uid = () => Math.random().toString(36).slice(2, 9);

function compute(snap: Scenario["snapshot"]): ShipmentResult | null {
  try {
    const base = ratesFor(snap.dest_country ?? "MY");
    const merged = mergeRates(snap.fta_claim === false ? withoutFta(base) : base, ...manualLinesOf(snap).map((m) => manualRates(m.hs_code, m.name, m.duty_pct, m.sst_pct)));
    return computeShipment(buildShipment(snap), merged);
  } catch {
    return null;
  }
}

export function Scenarios({ state, update, current }: { state: AppState; update: (p: Partial<AppState>) => void; current: ShipmentResult }) {
  const t = useT();
  const [name, setName] = useState("");
  const saved = state.scenarios;

  const rows = useMemo(() => {
    const live = { id: "live", name: t("This shipment"), snap: snapshotOf(state), res: current };
    return [live, ...saved.map((s) => ({ id: s.id, name: s.name, snap: s.snapshot, res: compute(s.snapshot) }))];
  }, [state, saved, current]);

  const save = () => {
    const sc: Scenario = {
      id: uid(),
      name: name.trim() || `${state.origin_label.split(",")[0]} · ${EQUIPMENT_LABEL[state.equipment]} · ${state.incoterm}`,
      saved_at: new Date().toISOString(),
      snapshot: snapshotOf(state),
    };
    update({ scenarios: [...saved, sc].slice(-3) });
    setName("");
  };
  const load = (sc: Scenario) => update({ ...sc.snapshot, step: 4 });
  const remove = (id: string) => update({ scenarios: saved.filter((s) => s.id !== id) });

  // product names across scenarios, for the per-unit rows
  const productNames = Array.from(new Set(rows.flatMap((r) => r.res?.lines.map((l) => l.name) ?? [])));

  return (
    <Card>
      <div className="text-sm font-semibold">{t("Compare scenarios")}</div>
      <p className="mt-1 text-[12px] text-muted">Save this shipment, change the origin, container or supplier price, and see the options side by side. Up to 3 saved.</p>
      <div className="mt-2 flex gap-2">
        <input className={smallInputCls} placeholder="Name, e.g. France pallet" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" onClick={save} disabled={saved.length >= 3} className="h-10 shrink-0 rounded-lg bg-teal px-3 text-[13px] font-semibold text-white disabled:opacity-40">
          {t("Save")}
        </button>
      </div>

      {saved.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-1 pr-2 font-medium"></th>
                {rows.map((r) => (
                  <th key={r.id} className="pb-1 pr-2 font-semibold text-ink">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-2 text-muted">Route</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-1 pr-2">
                    {r.snap.origin_label.split(",")[0]} · {EQUIPMENT_LABEL[r.snap.equipment].replace(" (LCL)", "")} · {r.snap.incoterm}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-line-2">
                <td className="py-1 pr-2 text-muted">Shipment landed</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-1 pr-2 font-semibold">
                    {r.res ? `${cs()} ${rm(r.res.totals.landed, 0)}` : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted">Tax share</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-1 pr-2">
                    {r.res ? `${Math.round(r.res.totals.tax_share_pct)}%` : "—"}
                  </td>
                ))}
              </tr>
              {productNames.map((pn) => (
                <tr key={pn} className="border-t border-line-2">
                  <td className="py-1 pr-2 text-muted">{pn} / unit</td>
                  {rows.map((r) => {
                    const l = r.res?.lines.find((x) => x.name === pn);
                    return (
                      <td key={r.id} className="py-1 pr-2">
                        {l ? `${cs()} ${rm(l.per_unit.landed)}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-line-2">
                <td></td>
                {rows.map((r) =>
                  r.id === "live" ? (
                    <td key={r.id}></td>
                  ) : (
                    <td key={r.id} className="py-1.5 pr-2">
                      <button type="button" onClick={() => load(saved.find((s) => s.id === r.id)!)} className="mr-2 font-semibold text-teal">
                        {t("Load")}
                      </button>
                      <button type="button" onClick={() => remove(r.id)} className="text-muted">
                        {t("Remove")}
                      </button>
                    </td>
                  ),
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
