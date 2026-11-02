"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Shipment } from "@landedmy/engine";
import { buildShipment as _build, manualLinesOf as _manual, type ProductRow } from "./shipment";
import type { Category } from "./products";
import type { Equipment } from "./lanes";
import { FX_DEFAULT, defaultLocalCharges } from "./lanes";

export type { ProductRow } from "./shipment";
export { buildShipment, manualLinesOf } from "./shipment";

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
  /** Saved scenarios for side-by-side comparison (max 3). */
  scenarios: Scenario[];
  lang: "en" | "ms";
  /** Id/name of the account-saved shipment this state was loaded from, if any. */
  saved_id?: string;
  saved_name?: string;
}

export interface Scenario {
  id: string;
  name: string;
  saved_at: string;
  snapshot: Omit<AppState, "scenarios" | "step" | "lang" | "saved_id" | "saved_name">;
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
  scenarios: [],
  lang: "en",
};

export function snapshotOf(state: AppState): Scenario["snapshot"] {
  const { scenarios: _s, step: _st, lang: _l, saved_id: _i, saved_name: _n, ...rest } = state;
  return rest;
}

const KEY = "landedmy:v1";

function encodeShare(s: AppState): string {
  const slim = { ...s, step: 4, scenarios: [] };
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

  const shipment: Shipment = useMemo(() => _build(state), [state]);
  const manualRateLines = useMemo(() => _manual(state), [state.products]);

  return { state, update, reset, hydrated, shareUrl, shipment, manualRateLines };
}
