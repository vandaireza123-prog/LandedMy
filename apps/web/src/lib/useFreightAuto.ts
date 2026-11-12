"use client";
import { useEffect } from "react";
import type { AppState } from "./state";
import { freightFor } from "./freight";

/** Freight follows the estimate (route, mode, quantity, weight) until the user types their own figure. */
export const freightIsAuto = (s: AppState) => s.freight_auto ?? s.freight === 0;

export function useFreightAuto(state: AppState, update: (p: Partial<AppState>) => void) {
  const auto = freightIsAuto(state) && state.incoterm !== "CIF";
  const f = auto ? freightFor(state) : null;
  const target = f && f.ok ? f.mid : 0;
  useEffect(() => {
    if (!auto) return;
    if (state.freight !== target || state.freight_auto !== true) update({ freight: target, freight_auto: true });
  }, [auto, target, state.freight, state.freight_auto, update]);
}
