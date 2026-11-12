"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Shipment } from "@landedmy/engine";
import { buildShipment as _build, manualLinesOf as _manual, type ProductRow } from "./shipment";
import type { Category } from "./products";
import type { Lang } from "./i18n";
import type { Equipment } from "./lanes";
import { FX_DEFAULT } from "./lanes";
import { COUNTRIES, countryOfPort, fxDefault, localChargesFor, type DestCountry } from "./country";
import { PORTS } from "./ports";
import { modeCount } from "./shipment";

export type { ProductRow } from "./shipment";
export { buildShipment, manualLinesOf } from "./shipment";

export interface AppState {
  step: 1 | 2 | 3 | 4;
  origin_iso: string;
  origin_port: string;
  /** Display name; for ports not in the list this is what the user typed. */
  origin_label: string;
  /** Destination country: decides rate tables, currency and tax name. */
  dest_country: DestCountry;
  dest_port: string;
  equipment: Equipment;
  pallets: number;
  /** Containers, trucks or units for modes counted that way. */
  mode_qty?: number;
  /** Cubic metres for LCL by m³. */
  cbm?: number;
  /** Chargeable weight for air, courier and post when the user overrides the products' total weight. */
  chargeable_kg?: number;
  incoterm: Shipment["incoterm"];
  currency: string;
  fx_rate: number;
  fx_source: string;
  /** The freight your forwarder actually quoted, in shipment currency (0 = none). */
  forwarder_quote: number;
  freight: number;
  /** true: freight follows our estimate; false: the user typed it. Undefined on older saves (= auto if 0). */
  freight_auto?: boolean;
  insurance_pct: number;
  local_charges: Record<string, number>;
  local_touched: boolean;
  products: ProductRow[];
  sell_price: number;
  /** Claim FTA preferential duty where it exists (needs a certificate of origin). */
  fta_claim: boolean;
  /** Saved scenarios for side-by-side comparison (max 3). */
  scenarios: Scenario[];
  lang: Lang;
  /** Id/name of the account-saved shipment this state was loaded from, if any. */
  saved_id?: string;
  saved_name?: string;
  /** Product typed on the homepage search, consumed once by step 1. */
  search_q?: string;
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
  dest_country: "MY",
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
  local_charges: localChargesFor("MY", "pallet", 1),
  local_touched: false,
  products: [],
  sell_price: 0,
  fta_claim: true,
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
    return { ...initialState, ...obj, dest_country: obj.dest_country ?? countryOfPort(obj.dest_port ?? "MYPKG") };
  } catch {
    return null;
  }
}

/** Homepage hand-off: /calc/?q=…&from=BE&to=MY sets the route and pre-fills the product search. */
function applyHandoff(s: AppState, qs: URLSearchParams): AppState {
  const next: AppState = { ...s, step: 1 };
  const from = (qs.get("from") ?? "").toUpperCase();
  if (from) {
    const port = PORTS.find((p) => p.iso === from);
    if (port) {
      Object.assign(next, { origin_port: port.code, origin_iso: port.iso, origin_label: `${port.name}, ${port.country}` });
      if (!s.products.length) next.currency = port.currency;
    } else if (COUNTRIES[from]) {
      Object.assign(next, { origin_port: "CUSTOM", origin_iso: from, origin_label: COUNTRIES[from].name });
    }
  }
  const to = (qs.get("to") ?? "").toUpperCase();
  if (to && COUNTRIES[to]) {
    Object.assign(next, {
      dest_country: to,
      dest_port: COUNTRIES[to].ports[0].code,
      local_charges: localChargesFor(to, next.equipment, modeCount(next)),
      local_touched: false,
    });
  }
  next.fx_rate = fxDefault(next.dest_country, next.currency, FX_DEFAULT);
  next.fx_source = "";
  const q = qs.get("q")?.trim();
  if (q) next.search_q = q.slice(0, 120);
  return next;
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
        if (raw) {
          const saved = JSON.parse(raw) as Partial<AppState>;
          setState({ ...initialState, ...saved, dest_country: saved.dest_country ?? countryOfPort(saved.dest_port ?? "MYPKG") });
        }
      }
    } catch {
      /* storage unavailable: run in memory */
    }
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.has("q") || qs.has("from") || qs.has("to")) {
        setState((s) => applyHandoff(s, qs));
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      }
    } catch {
      /* ignore malformed links */
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
  /** Change products against the latest state (for async work such as rate look-ups). */
  const patchProducts = useCallback((fn: (rows: ProductRow[]) => ProductRow[]) => setState((s) => ({ ...s, products: fn(s.products) })), []);
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

  return { state, update, patchProducts, reset, hydrated, shareUrl, shipment, manualRateLines };
}
