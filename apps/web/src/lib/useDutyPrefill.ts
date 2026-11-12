"use client";
/**
 * Fills each non-drink product's duty % for the chosen route from the bundled schedules / WITS / database, once a
 * destination is known. Runs again when the route or the code changes; a duty the user typed for this route is kept.
 */
import { useEffect } from "react";
import { fetchWorldRate } from "./api";
import { COUNTRIES } from "./country";
import { isManualLine, type ProductRow } from "./shipment";
import type { AppState } from "./state";

export const dutyKey = (s: Pick<AppState, "dest_country" | "origin_iso">, r: ProductRow) => `${s.dest_country}:${s.origin_iso}:${r.hs6 ?? ""}`;

export function useDutyPrefill(state: AppState, patchProducts: (fn: (rows: ProductRow[]) => ProductRow[]) => void) {
  const indicative = COUNTRIES[state.dest_country].tier === "indicative";
  const sig = state.products.map((r) => `${r.id}:${r.hs6}:${r.hs_code}:${r.duty_for ?? ""}`).join("|");
  useEffect(() => {
    // Route or code changed since the duty was set: forget it (including one the user typed for another route).
    const stale = state.products.filter((r) => r.category === "general" && r.duty_for && r.duty_for !== dutyKey(state, r));
    if (stale.length) {
      const ids = new Set(stale.map((r) => r.id));
      patchProducts((rows) => rows.map((r) => (ids.has(r.id) ? { ...r, manual_duty_pct: undefined, duty_source: undefined, duty_notes: undefined, duty_for: undefined } : r)));
      return;
    }
    const todo = state.products.filter((r) => r.category === "general" && r.hs6 && (indicative || isManualLine(r, state.dest_country)) && !r.duty_for);
    if (!todo.length) return;
    let live = true;
    Promise.all(todo.map((r) => fetchWorldRate(state.dest_country, r.hs6!, state.origin_iso).then((w) => [r.id, w, dutyKey(state, r)] as const))).then((res) => {
      if (!live) return;
      const byId = new Map(res.map(([id, w, key]) => [id, { w, key }]));
      patchProducts((rows) =>
        rows.map((r) => {
          const hit = byId.get(r.id);
          if (!hit || r.duty_for || dutyKey(state, r) !== hit.key) return r;
          const { w, key } = hit;
          const notes = (w?.additional ?? []).map((a) => `${a.text} (${a.heading})`);
          if (!w || !w.rate || w.rate.value == null) return { ...r, manual_duty_pct: undefined, duty_source: w?.rate ? `${w.note.split(" · ")[0]} — enter the % after checking the specific rate` : "none", duty_notes: notes, duty_for: key };
          const label = `${w.rate.origin === "MFN" ? "MFN" : `${w.rate.origin} preferential`} ${w.rate.year ?? ""} · ${w.source?.name?.split(" (")[0] ?? w.rate.source_id} · ${w.rate.tier}${w.rate.rate_type === "range" ? ` · ${w.rate.value}–${w.rate.value_max}% range, lowest used` : w.rate.rate_type === "compound" ? " · average, some lines specific" : w.rate.source_id === "wits-trains" ? " · average of national lines at HS-6, check the exact line" : ""}`;
          return { ...r, manual_duty_pct: w.rate.value, duty_source: label, duty_notes: notes, duty_for: key };
        }),
      );
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicative, state.dest_country, state.origin_iso, sig]);
}
