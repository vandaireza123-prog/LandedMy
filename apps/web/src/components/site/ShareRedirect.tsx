"use client";
import { useEffect } from "react";

/** Old share links pointed at the root (`/#s=…`). The calculator now lives at /calc/, so hand the hash over. */
export function ShareRedirect() {
  useEffect(() => {
    if (location.hash.startsWith("#s=")) location.replace(`/calc/${location.hash}`);
  }, []);
  return null;
}
