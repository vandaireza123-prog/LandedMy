"use client";
import type { Category } from "./products";

const FN = "/.netlify/functions";

export interface FxResponse {
  rates: Record<string, number>;
  as_of: string;
  source: string;
  note: string;
}

export async function fetchFx(): Promise<FxResponse | null> {
  try {
    const r = await fetch(`${FN}/fx`);
    if (!r.ok) return null;
    return (await r.json()) as FxResponse;
  } catch {
    return null;
  }
}

export interface ExtractedLine {
  name: string;
  category: Category;
  volume_ml: number | null;
  abv: number | null;
  units_per_case: number | null;
  cases: number | null;
  unit_cost: number | null;
  /** Universal 6-digit HS 2022 code (digits only). */
  hs6?: string;
  hs_code: string;
  hs_confidence: number;
  hs_alternatives?: string[];
}
export interface ExtractResponse {
  currency: string | null;
  lines: ExtractedLine[];
  notes: string[];
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

/** Downscale big photos client-side so a phone camera shot stays under the size limit. */
async function shrinkImage(file: File, maxEdge = 1800): Promise<{ data: string; media_type: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 3_000_000) return { data: await toBase64(file), media_type: file.type || "image/jpeg" };
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.split(",")[1], media_type: "image/jpeg" };
}

export async function extractFromFile(file: File): Promise<ExtractResponse> {
  let payload: Record<string, string>;
  if (file.type === "application/pdf") {
    payload = { kind: "pdf", data: await toBase64(file) };
  } else if (file.type.startsWith("image/")) {
    const { data, media_type } = await shrinkImage(file);
    payload = { kind: "image", data, media_type };
  } else {
    payload = { kind: "text", text: await file.text() };
  }
  return post(payload);
}

export async function extractFromText(text: string): Promise<ExtractResponse> {
  return post({ kind: "text", text });
}

export async function classifyName(name: string): Promise<ExtractResponse> {
  return post({ kind: "classify", name });
}

async function post(payload: Record<string, string>): Promise<ExtractResponse> {
  const r = await fetch(`${FN}/extract-invoice`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`);
  return body as ExtractResponse;
}

/** Netlify Forms: the static HTML carries a hidden form named "quote-request"; submit via fetch. */
export async function submitLead(fields: Record<string, string>): Promise<boolean> {
  try {
    const body = new URLSearchParams({ "form-name": "quote-request", ...fields }).toString();
    const r = await fetch("/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    return r.ok;
  } catch {
    return false;
  }
}

// ---- World duty rates ----
export interface WorldRate {
  rate: { hs_code: string; hs_level: number; origin: string; rate_type: string; value: number | null; value_max?: number | null; compound_text: string | null; source_id: string; tier: string; year: number | null; description?: string | null } | null;
  source: { id: string; name: string; url: string; tier: string } | null;
  tier: string | null;
  note: string;
  /** US chapter-99 additional duties in force for this origin, when any. */
  additional?: { heading: string; pct: number | null; text: string; scope: string }[] | null;
}
const rateCache = new Map<string, Promise<WorldRate | null>>();
/** Best known duty for dest + HS-6 (+ origin). Null when the API is unreachable. */
export function fetchWorldRate(dest: string, hs6: string, origin: string): Promise<WorldRate | null> {
  const k = `${dest}:${hs6}:${origin}`;
  if (!rateCache.has(k)) {
    rateCache.set(
      k,
      fetch(`/api/rates?dest=${dest}&hs=${hs6}&origin=${origin}`)
        .then((r) => (r.ok ? (r.json() as Promise<WorldRate>) : null))
        .catch(() => null),
    );
  }
  return rateCache.get(k)!;
}
