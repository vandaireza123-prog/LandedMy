"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Shipment, ShipmentLine } from "@landedmy/engine";
import type { Category } from "./products";
import type { Equipment } from "./lanes";
import { FX_DEFAULT, defaultLocalCharges } from "./lanes";

export interface ProductRow extends ShipmentLine {
  category: Category;
  hs_confirmed: boolean;
}

export interface AppState {
  step: 1 | 2 | 3 | 4;
  origin_iso: string;
  origin_port: string;
  /** Display name; for ports not in the list this is what the user typed. */
  origin_label: string;
  dest_port: string;
  equipment: Equipment;
  pallets: number;
  incoterm: Shipment["incoterm"];
  currency: string;
  fx_rate: number;
  fx_source: string;
  /** The freight your forwarder actually quoted, in shipment currency (0 = none). */
  forwarder_quote: number;
  freight: number;
  insurance_pct: number;
  local_charges: Record<string, number>;
  local_touched: boolean;
  products: ProductRow[];
  sell_price: number;
}

export const initialState: AppState = {
  step: 1,
  origin_iso: "BE",
  origin_port: "BEANR",
  origin_label: "Antwerp, Belgium",
  dest_port: "MYPKG",
  equipment: "pallet",
  pallets: 1,
  incoterm: "EXW",
  currency: "EUR",
  fx_rate: FX_DEFAULT.EUR,
  fx_source: "",
  forwarder_quote: 0,
  freight: 0,
  insurance_pct: 0.3,
  local_charges: defaultLocalCharges("pallet", 1),
  local_touched: false,
  products: [],
  sell_price: 0,
};

const KEY = "landedmy:v1";

function encodeShare(s: AppState): string {
  const slim = { ...s, step: 4 };
  return btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
}
function decodeShare(h: string): AppState | null {
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(h))));
    return { ...initialState, ...obj };
  } catch {
    return null;
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const hash = window.location.hash.startsWith("#s=") ? window.location.hash.slice(3) : "";
      const shared = hash ? decodeShare(hash) : null;
      if (shared) {
        setState(shared);
      } else {
        const raw = localStorage.getItem(KEY);
        if (raw) setState({ ...initialState, ...JSON.parse(raw) });
      }
    } catch {
      /* storage unavailable: run in memory */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => {
    setState(initialState);
    try {
      localStorage.removeItem(KEY);
      history.replaceState(null, "", location.pathname);
    } catch {
      /* ignore */
    }
  }, []);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${location.origin}${location.pathname}#s=${encodeShare(state)}`;
  }, [state]);

  const shipment: Shipment = useMemo(
    () => ({
      date: new Date().toISOString().slice(0, 10),
      origin_iso: state.origin_iso,
      dest_port: state.dest_port,
      currency: state.currency,
      fx_rate: state.fx_rate,
      incoterm: state.incoterm,
      freight: state.freight,
      insurance: { pct_of_goods: state.insurance_pct },
      local_charges_myr: state.local_charges,
      allocation: "volume",
      lines: state.products.map((p) => ({
        id: p.id,
        name: p.name,
        hs_code: p.hs_code,
        volume_ml: p.volume_ml,
        abv: p.abv,
        units_per_case: p.units_per_case,
        cases: p.cases,
        unit_cost: p.unit_cost,
        cases_per_pallet: p.cases_per_pallet,
      })),
    }),
    [state],
  );

  return { state, update, reset, hydrated, shareUrl, shipment };
}
