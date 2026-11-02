"use client";
import { useState } from "react";
import type { AppState, ProductRow } from "@/lib/state";
import { CATEGORY_HS, CATEGORY_LABEL, hsForCategory, searchLibrary, type Category, type LibraryProduct } from "@/lib/products";
import { Card, Footer, PrimaryButton, Progress, Title, smallInputCls } from "./ui";
import { ScanSheet } from "./ScanSheet";
import { FX_DEFAULT } from "@/lib/lanes";

const uid = () => Math.random().toString(36).slice(2, 9);

function blankRow(): ProductRow {
  return {
    id: uid(),
    name: "",
    category: "still_wine",
    hs_code: "2204.21.11",
    volume_ml: 750,
    abv: 13,
    units_per_case: 6,
    cases: 100,
    unit_cost: 0,
    hs_confirmed: false,
  };
}

function fromLibrary(p: LibraryProduct): ProductRow {
  return {
    id: uid(),
    name: p.name,
    category: p.category,
    hs_code: p.hs_code,
    volume_ml: p.volume_ml,
    abv: p.abv,
    units_per_case: p.units_per_case,
    cases: p.category === "beer" ? 60 : 100,
    unit_cost: 0,
    hs_confirmed: true,
  };
}

export function ProductsStep({ state, update }: { state: AppState; update: (p: Partial<AppState>) => void }) {
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const hits = searchLibrary(q);
  const rows = state.products;

  const setRows = (next: ProductRow[]) => update({ products: next });
  const patchRow = (id: string, patch: Partial<ProductRow>) =>
    setRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        const n = { ...r, ...patch };
        if ((patch.category !== undefined || patch.abv !== undefined) && !patch.hs_code) {
          const auto = hsForCategory(n.category, n.abv);
          if (auto !== r.hs_code) {
            n.hs_code = auto;
            n.hs_confirmed = false;
          }
        }
        return n;
      }),
    );

  const add = (p?: LibraryProduct) => {
    setRows([...rows, p ? fromLibrary(p) : blankRow()]);
    setQ("");
  };

  const units = rows.reduce((a, r) => a + r.units_per_case * r.cases, 0);
  const goods = rows.reduce((a, r) => a + r.units_per_case * r.cases * r.unit_cost, 0);
  const ready = rows.length > 0 && rows.every((r) => r.name && r.unit_cost > 0 && r.cases > 0 && r.volume_ml > 0);

  return (
    <>
      <Progress step={2} />
      <Title step={2} title="What are you bringing?" sub="Type a name. Size, strength and customs code fill themselves." />

      <div className="relative px-5 pt-4">
        <div className="flex h-[50px] items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 focus-within:border-teal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6664" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="flex-1 bg-transparent text-[15px] outline-none"
            placeholder="Search product, e.g. Duvel 330ml"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add(hits[0]);
            }}
          />
        </div>
        {q && (
          <div className="absolute left-5 right-5 z-10 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
            {hits.map((h) => (
              <button
                key={h.name}
                type="button"
                onClick={() => add(h)}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left hover:bg-teal-tint"
              >
                <span className="text-sm font-medium">{h.name}</span>
                <span className="text-xs text-muted">
                  {CATEGORY_LABEL[h.category]} · {h.abv}%
                </span>
              </button>
            ))}
            <button type="button" onClick={() => add()} className="flex w-full px-3.5 py-3 text-left text-sm font-semibold text-teal hover:bg-teal-tint">
              + Add “{q}” as a new product
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pt-2.5">
        <button type="button" onClick={() => setScan(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal bg-teal-tint text-sm font-semibold text-teal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16"/></svg>
          Scan invoice, price list or photo
        </button>
      </div>
      {scan && (
        <ScanSheet
          currency={state.currency}
          onClose={() => setScan(false)}
          onAdd={(newRows) => setRows([...rows, ...newRows])}
          onCurrency={(c) => update({ currency: c, fx_rate: FX_DEFAULT[c] ?? state.fx_rate, fx_source: "" })}
        />
      )}

      <div className="flex flex-1 flex-col gap-2.5 px-5 pt-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <input
                className="min-w-0 flex-1 border-b border-transparent bg-transparent text-[15px] font-semibold outline-none focus:border-teal"
                placeholder="Product name"
                value={r.name}
                onChange={(e) => patchRow(r.id, { name: e.target.value })}
              />
              <button type="button" aria-label="Remove" onClick={() => setRows(rows.filter((x) => x.id !== r.id))} className="text-muted hover:text-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Type</span>
                <select className={smallInputCls} value={r.category} onChange={(e) => patchRow(r.id, { category: e.target.value as Category })}>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Customs code</span>
                <select className={smallInputCls} value={r.hs_code} onChange={(e) => patchRow(r.id, { hs_code: e.target.value, hs_confirmed: true })}>
                  {CATEGORY_HS[r.category].map((h) => (
                    <option key={h.hs_code} value={h.hs_code}>
                      {h.hs_code} · {h.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-2 grid grid-cols-5 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">ml</span>
                <input type="number" className={smallInputCls} value={r.volume_ml} onChange={(e) => patchRow(r.id, { volume_ml: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">ABV %</span>
                <input type="number" step="0.1" className={smallInputCls} value={r.abv} onChange={(e) => patchRow(r.id, { abv: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Cost / unit</span>
                <input type="number" step="0.01" className={smallInputCls} placeholder={state.currency} value={r.unit_cost || ""} onChange={(e) => patchRow(r.id, { unit_cost: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Per case</span>
                <input type="number" className={smallInputCls} value={r.units_per_case} onChange={(e) => patchRow(r.id, { units_per_case: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Cases</span>
                <input type="number" className={smallInputCls} value={r.cases} onChange={(e) => patchRow(r.id, { cases: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span>{r.units_per_case * r.cases} units · {((r.volume_ml / 1000) * r.units_per_case * r.cases).toFixed(1)} L</span>
              <span className={`rounded-md px-2 py-0.5 font-semibold ${r.hs_confirmed ? "bg-teal-tint text-teal" : "bg-amber-tint text-amber"}`}>
                {r.hs_confirmed ? "Code confirmed" : "Check customs code"}
              </span>
            </div>
          </Card>
        ))}
        <button type="button" onClick={() => add()} className="h-12 rounded-xl border border-dashed border-[#B8BAB2] text-sm font-semibold text-teal hover:bg-teal-tint">
          + Add another product
        </button>
      </div>

      <Footer>
        <div className="flex justify-between text-[13px] text-muted">
          <span>
            {rows.length} product{rows.length === 1 ? "" : "s"} · {units.toLocaleString()} units
          </span>
          <span className="font-semibold text-ink">
            {state.currency} {goods.toLocaleString(undefined, { maximumFractionDigits: 0 })} goods
          </span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => update({ step: 1 })} className="h-[54px] rounded-xl border border-line bg-white px-5 text-[15px] font-semibold">
            Back
          </button>
          <PrimaryButton onClick={() => update({ step: 3 })} disabled={!ready}>
            Next: freight and charges
          </PrimaryButton>
        </div>
      </Footer>
    </>
  );
}
