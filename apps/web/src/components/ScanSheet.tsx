"use client";
import { useRef, useState } from "react";
import { extractFromFile, extractFromText, type ExtractedLine, type ExtractResponse } from "@/lib/api";
import { CATEGORY_LABEL, hsForCategory, type Category } from "@/lib/products";
import type { ProductRow } from "@/lib/state";
import { smallInputCls } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_ML: Record<Category, number> = { beer: 330, still_wine: 750, sparkling: 750, cider: 330, spirits: 700, other: 700, general: 0 };
const DEFAULT_CASE: Record<Category, number> = { beer: 24, still_wine: 6, sparkling: 6, cider: 24, spirits: 6, other: 6, general: 1 };

export function toRows(lines: ExtractedLine[]): ProductRow[] {
  return lines.map((l) => {
    const cat = (l.category ?? "other") as Category;
    const abv = l.abv ?? 0;
    return {
      id: uid(),
      name: l.name,
      category: cat,
      hs_code: l.hs_code || hsForCategory(cat, abv),
      volume_ml: l.volume_ml ?? DEFAULT_ML[cat],
      abv,
      units_per_case: l.units_per_case ?? DEFAULT_CASE[cat],
      cases: l.cases ?? 1,
      unit_cost: l.unit_cost ?? 0,
      hs_confirmed: (l.hs_confidence ?? 0) >= 0.85,
    };
  });
}

export function ScanSheet({ currency, onAdd, onClose, onCurrency }: { currency: string; onAdd: (rows: ProductRow[]) => void; onClose: () => void; onCurrency: (c: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<ExtractResponse | null>(null);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (p: Promise<ExtractResponse>) => {
    setBusy(true);
    setErr("");
    try {
      const r = await p;
      const rs = toRows(r.lines);
      setRes(r);
      setRows(rs);
      setPicked(new Set(rs.map((x) => x.id)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patch = (id: string, p: Partial<ProductRow>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const toggle = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setPicked(n);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-ground" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="font-display text-lg font-bold">Scan an invoice or price list</div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!res && (
            <>
              <p className="text-sm text-muted">A photo of the supplier's price list, a PDF invoice, or pasted text. We read the lines; you check them before they're added.</p>
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.txt,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && run(extractFromFile(e.target.files[0]))} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="h-12 rounded-[10px] bg-teal text-sm font-semibold text-white disabled:opacity-40">
                  Photo or PDF
                </button>
                <button type="button" disabled={busy || text.trim().length < 10} onClick={() => run(extractFromText(text))} className="h-12 rounded-[10px] border border-teal text-sm font-semibold text-teal disabled:opacity-40">
                  Read pasted text
                </button>
              </div>
              <textarea className="mt-2 h-32 w-full rounded-[10px] border border-line bg-white p-3 text-sm outline-none focus:border-teal" placeholder="…or paste the price list here" value={text} onChange={(e) => setText(e.target.value)} />
              {busy && <p className="mt-3 text-sm text-teal">Reading… this takes 5–15 seconds.</p>}
              {err && <p className="mt-3 rounded-lg bg-amber-tint px-3 py-2 text-sm text-amber">{err}</p>}
            </>
          )}

          {res && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {rows.length} line{rows.length === 1 ? "" : "s"} found{res.currency ? ` · prices in ${res.currency}` : ""}
                </span>
                <button type="button" onClick={() => setRes(null)} className="text-xs font-semibold text-teal">
                  Scan another
                </button>
              </div>
              {res.currency && res.currency !== currency && (
                <button type="button" onClick={() => onCurrency(res.currency!)} className="mt-2 w-full rounded-lg bg-amber-tint px-3 py-2 text-left text-xs text-amber">
                  Document is in {res.currency} but your shipment is set to {currency}. Tap to switch the shipment to {res.currency}.
                </button>
              )}
              <div className="mt-3 flex flex-col gap-2">
                {rows.map((r) => (
                  <div key={r.id} className={`rounded-xl border bg-white p-3 ${picked.has(r.id) ? "border-teal" : "border-line opacity-60"}`}>
                    <label className="flex items-start gap-2.5">
                      <input type="checkbox" className="mt-1 h-[18px] w-[18px] accent-teal" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                      <div className="min-w-0 flex-1">
                        <input className="w-full border-b border-transparent bg-transparent text-sm font-semibold outline-none focus:border-teal" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
                        <div className="mt-1 text-[11px] text-muted">
                          {CATEGORY_LABEL[r.category]} · HS {r.hs_code}{" "}
                          <span className={r.hs_confirmed ? "text-teal" : "text-amber"}>{r.hs_confirmed ? "✓" : "check"}</span>
                        </div>
                      </div>
                    </label>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {(
                        [
                          ["ml", "volume_ml", 1],
                          ["ABV", "abv", 0.1],
                          ["Cost", "unit_cost", 0.01],
                          ["/case", "units_per_case", 1],
                          ["Cases", "cases", 1],
                        ] as const
                      ).map(([lab, key, step]) => (
                        <label key={key} className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted">{lab}</span>
                          <input type="number" step={step} className={`${smallInputCls} !h-9 !px-1.5 ${!r[key] ? "border-amber" : ""}`} value={r[key] || ""} onChange={(e) => patch(r.id, { [key]: Number(e.target.value) || 0 })} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {res.notes.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-[11px] text-muted">
                  {res.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {res && (
          <div className="border-t border-line bg-ground px-5 pb-8 pt-3">
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={() => {
                onAdd(rows.filter((r) => picked.has(r.id)));
                onClose();
              }}
              className="h-[54px] w-full rounded-xl bg-teal text-base font-semibold text-white disabled:opacity-40"
            >
              Add {picked.size} product{picked.size === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
