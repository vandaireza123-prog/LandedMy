"use client";
import { useRef, useState } from "react";
import type { AppState, ProductRow } from "@/lib/state";
import { CATEGORY_HS, CATEGORY_LABEL, hsForCategory, searchLibrary, type Category, type LibraryProduct } from "@/lib/products";
import { Card, Footer, PrimaryButton, Progress, Title, smallInputCls } from "./ui";
import { ScanSheet } from "./ScanSheet";
import { FX_DEFAULT } from "@/lib/lanes";
import { GENERAL_LINES } from "@landedmy/engine";
import { SENSITIVE_CHAPTERS, describeHs, searchHs, type HsHit } from "@/lib/hs/search";
import { searchCatalogs, type CatalogHit } from "@/lib/hs/catalogs";
import { useEffect } from "react";
import { COUNTRIES } from "@/lib/country";
import { fetchWorldRate } from "@/lib/api";
import { shipmentKg } from "@/lib/shipment";
import { useT } from "@/lib/i18n";
import { UOMS, defaultQuantity, quantitySummary, uomName, uomOf, type Uom } from "@/lib/quantity";

const uid = () => Math.random().toString(36).slice(2, 9);
const INVOICE_CURRENCIES = ["USD", "EUR", "GBP", "MYR", "SGD", "CNY", "JPY", "AUD", "NZD", "CAD", "CHF", "HKD", "THB", "IDR", "VND", "INR", "AED", "KRW", "BRL", "ZAR"];

const DRINK_WORDS = /\b(beer|lager|ale|stout|porter|ipa|pilsner|wine|champagne|prosecco|cava|cider|perry|whisky|whiskey|gin|vodka|rum|brandy|cognac|tequila|mezcal|liqueur|sake|soju|spirit|spirits|mead)\b/i;

/** A non-drink product with no customs code yet: the card asks for one. */
function blankGoods(name: string): ProductRow {
  return { id: uid(), name, category: "general", general_group: "other", hs_code: "MANUAL", volume_ml: 0, abv: 0, unit_cost: 0, hs_confirmed: false, manual_sst_pct: 10, ...defaultQuantity() };
}

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

/** Chapter → our general-goods group, for the default compliance list and tariff shortlist. */
function groupForChapter(ch: string): string {
  const n = Number(ch);
  if (n <= 24) return "food";
  if (n === 33 || n === 34) return "beauty";
  if (n === 69 || n === 70 || n === 73 || n === 82) return "kitchen";
  if (n === 84 || n === 85 || n === 90) return "electronics";
  if (n === 94) return "furniture";
  if (n >= 61 && n <= 65) return "apparel";
  return "other";
}

function fromHs(h: HsHit, name: string, indicative = false, hint?: Uom): ProductRow {
  const dotted = `${h.code6.slice(0, 4)}.${h.code6.slice(4)}`;
  void indicative; // the destination is chosen after products; Malaysian lines only apply when it is Malaysia
  const line = GENERAL_LINES.find((g) => g.hs_code.startsWith(dotted));
  return {
    id: uid(),
    name: name || h.description.split(";")[0],
    category: "general",
    general_group: line?.group ?? groupForChapter(h.chapter),
    hs6: h.code6,
    hs6_desc: h.description,
    hs_code: line ? line.hs_code : "MANUAL",
    volume_ml: 0,
    abv: 0,
    ...defaultQuantity(h.code6, hint),
    unit_cost: 0,
    hs_confirmed: !!line,
    manual_duty_pct: line ? line.duty_pct : undefined,
    manual_sst_pct: line ? line.sst_pct : 10,
  };
}

function codeFields(p: CatalogHit): Pick<ProductRow, "code_source" | "code_note" | "code_check"> {
  return { code_source: `${p.catalog} catalogue · ${p.group}`, code_note: p.item.note, code_check: p.item.c === "check" };
}

/** In-card customs-code picker: part catalogues first, then the full HS 2022 list. */
function CodePicker({ onPick, onCancel }: { onPick: (p: { hs: HsHit } | { part: CatalogHit }) => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const [hs, setHs] = useState<HsHit[]>([]);
  const [parts, setParts] = useState<CatalogHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHs([]);
      setParts([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchHs(q, 5).then((r) => live && setHs(r));
      searchCatalogs(q, 4).then((r) => live && setParts(r));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const Row = ({ code, title, sub, onClick }: { code: string; title: string; sub: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex w-full items-start justify-between gap-3 border-t border-line-2 px-3 py-2 text-left hover:bg-teal-tint">
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted">{sub}</span>
      </span>
      <span className="shrink-0 font-mono text-[12px] text-teal">{code.slice(0, 4)}.{code.slice(4)}</span>
    </button>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-teal bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <input autoFocus className="h-8 min-w-0 flex-1 text-[13px] outline-none" placeholder="Part name, product or HS code" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={onCancel} className="text-[12px] font-semibold text-muted">
          Cancel
        </button>
      </div>
      {parts.map((p) => (
        <Row key={"p" + p.group + p.item.n} code={p.item.hs} title={p.item.n} sub={`${p.group}${p.item.c === "check" ? " · rulings vary" : ""}`} onClick={() => onPick({ part: p })} />
      ))}
      {hs.map((h) => (
        <Row key={"h" + h.code6} code={h.code6} title={h.description} sub={h.heading} onClick={() => onPick({ hs: h })} />
      ))}
    </div>
  );
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
  const t = useT();
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const hits = searchLibrary(q);
  const [hsHits, setHsHits] = useState<HsHit[]>([]);
  const [partHits, setPartHits] = useState<CatalogHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHsHits([]);
      setPartHits([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchHs(q, 6).then((r) => live && setHsHits(r));
      searchCatalogs(q, 4).then((r) => live && setPartHits(r));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const rows = state.products;
  const country = COUNTRIES[state.dest_country];
  const indicative = country.tier === "indicative";

  const setRows = (next: ProductRow[]) => update({ products: next });

  const patchRow = (id: string, patch: Partial<ProductRow>) =>
    setRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        const n = { ...r, ...patch };
        if (patch.category === "general") {
          n.abv = 0;
          n.volume_ml = 0;
          n.hs_code = "MANUAL";
          n.manual_sst_pct = n.manual_sst_pct ?? 10;
          n.manual_duty_pct = n.manual_duty_pct ?? 0;
          n.hs_confirmed = false;
          return n;
        }
        if (patch.category !== undefined && r.category === "general") {
          n.volume_ml = 750;
          n.abv = 13;
          n.hs_code = hsForCategory(n.category, n.abv);
          n.hs_confirmed = false;
          return n;
        }
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
    const name = q.trim();
    setRows([...rows, p ? fromLibrary(p) : DRINK_WORDS.test(name) ? { ...blankRow(), name } : blankGoods(name)]);
    setQ("");
  };
  /** Enter in the search box: best drink match, else best part, else best HS line, else a new named product. */
  const addBest = () => {
    if (hits[0]) return add(hits[0]);
    if (partHits[0]) return addPart(partHits[0]);
    if (hsHits[0]) return addHs(hsHits[0]);
    if (q.trim()) add();
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchRef.current?.focus({ preventScroll: true });
  };
  const addHs = (h: HsHit) => {
    setRows([...rows, fromHs(h, q.trim(), indicative)]);
    setQ("");
  };
  const addPart = async (p: CatalogHit) => {
    const h = await describeHs(p.item.hs);
    if (!h) return;
    setRows([...rows, { ...fromHs(h, p.item.n, indicative, p.item.u), ...codeFields(p) }]);
    setQ("");
  };
  /** Replace a row's customs code (from the in-card picker); the duty pre-fill runs again for the new code. */
  const setCode = async (id: string, pick: { hs: HsHit } | { part: CatalogHit }) => {
    const h = "hs" in pick ? pick.hs : await describeHs(pick.part.item.hs);
    if (!h) return;
    const base = fromHs(h, "", indicative, "part" in pick ? pick.part.item.u : undefined);
    const cur = rows.find((x) => x.id === id);
    // keep the quantity when the unit stays the same; otherwise start from the new item's usual unit
    const qty = cur && uomOf(cur) === base.uom ? {} : { uom: base.uom, units_per_case: base.units_per_case, cases: base.cases, weight_per_uom: undefined };
    patchRow(id, {
      ...qty,
      name: "part" in pick ? pick.part.item.n : base.name,
      hs6: base.hs6, hs6_desc: base.hs6_desc, hs_code: base.hs_code, hs_confirmed: base.hs_confirmed, general_group: base.general_group,
      manual_duty_pct: base.manual_duty_pct, manual_sst_pct: base.manual_sst_pct ?? 10, duty_source: undefined, duty_notes: undefined, duty_for: undefined,
      ...("part" in pick ? codeFields(pick.part) : { code_source: undefined, code_note: undefined, code_check: undefined }),
    });
    setPicking(null);
  };
  const [picking, setPicking] = useState<string | null>(null);

  const units = rows.reduce((a, r) => a + (r.category === "general" ? (uomOf(r) === "box" ? r.units_per_case * r.cases : r.cases) : r.units_per_case * r.cases), 0);
  const goods = rows.reduce((a, r) => a + (r.category === "general" ? r.cases * r.unit_cost : r.units_per_case * r.cases * r.unit_cost), 0);
  const ready = rows.length > 0 && rows.every((r) => r.name && r.unit_cost > 0 && r.cases > 0 && (r.category === "general" || r.volume_ml > 0));

  return (
    <>
      <Progress step={1} />
      <Title step={1} title="What are you shipping?" sub="Any product, part or HS code. Add as many as you like." />

      <div className="relative px-5 pt-4">
        <div className="flex h-[50px] items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 focus-within:border-teal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6664" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            className="flex-1 bg-transparent text-[15px] outline-none"
            placeholder={t("Search any product, part or HS code")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addBest();
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
            {partHits.length > 0 && (
              <div className="border-t border-line-2">
                <div className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{partHits[0].catalog} · part catalogue</div>
                {partHits.map((p) => (
                  <button key={p.group + p.item.n} type="button" onClick={() => addPart(p)} className="flex w-full items-start justify-between gap-3 px-3.5 py-2 text-left hover:bg-teal-tint">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{p.item.n}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {p.group}
                        {p.item.c === "check" ? " · rulings vary" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-teal">{p.item.hs.slice(0, 4)}.{p.item.hs.slice(4)}</span>
                  </button>
                ))}
              </div>
            )}
            {hsHits.length > 0 && (
              <div className="border-t border-line-2">
                <div className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Any product · world HS code</div>
                {hsHits.map((h) => (
                  <button key={h.code6} type="button" onClick={() => addHs(h)} className="flex w-full items-start justify-between gap-3 px-3.5 py-2 text-left hover:bg-teal-tint">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{h.description}</span>
                      <span className="block truncate text-[11px] text-muted">{h.heading}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-teal">{h.code}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => add()} className="flex w-full px-3.5 py-3 text-left text-sm font-semibold text-teal hover:bg-teal-tint">
              + Add “{q}” as a new product
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pt-2.5">
        <button type="button" onClick={() => setScan(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal bg-teal-tint text-sm font-semibold text-teal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16"/></svg>
          {t("Scan invoice, price list or photo")}
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
                placeholder={t("Product name")}
                value={r.name}
                onChange={(e) => patchRow(r.id, { name: e.target.value })}
              />
              <button type="button" aria-label="Remove" onClick={() => setRows(rows.filter((x) => x.id !== r.id))} className="text-muted hover:text-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {r.category !== "general" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">{t("Type")}</span>
                <select className={smallInputCls} value={r.category} onChange={(e) => patchRow(r.id, { category: e.target.value as Category })}>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">{t("Customs code")}</span>
                <select className={smallInputCls} value={r.hs_code} onChange={(e) => patchRow(r.id, { hs_code: e.target.value, hs_confirmed: true })}>
                  {CATEGORY_HS[r.category].map((h) => (
                    <option key={h.hs_code} value={h.hs_code}>
                      {h.hs_code} · {h.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            )}

            {r.category === "general" && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted">{t("Customs code")}</span>
                  {picking === r.id ? (
                    <CodePicker onPick={(p) => setCode(r.id, p)} onCancel={() => setPicking(null)} />
                  ) : r.hs6 ? (
                    <div className="rounded-lg bg-ground px-2.5 py-2 text-[12px]">
                      <span className="font-mono font-semibold text-teal">{r.hs6.slice(0, 4)}.{r.hs6.slice(4)}</span> <span className="text-muted">{r.hs6_desc}</span>
                      <div className="mt-1 flex items-start justify-between gap-2 text-[11px]">
                        <span className="min-w-0 leading-snug text-muted">
                          {r.code_source ? `From the ${r.code_source.charAt(0).toLowerCase()}${r.code_source.slice(1)}` : "From the HS 2022 list"}
                          {r.code_check ? " · customs administrations classify this differently, confirm before you ship" : ""}
                          {r.code_note ? <span className="mt-0.5 block">{r.code_note}</span> : null}
                          {SENSITIVE_CHAPTERS[r.hs6.slice(0, 2)] && <span className="mt-0.5 block text-amber">{SENSITIVE_CHAPTERS[r.hs6.slice(0, 2)]}</span>}
                        </span>
                        <button type="button" onClick={() => setPicking(r.id)} className="shrink-0 font-semibold text-teal">
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPicking(r.id)} className="flex h-10 items-center justify-between rounded-lg border border-dashed border-teal px-3 text-[13px] font-semibold text-teal">
                      Find the customs code <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {r.category === "general" ? (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted">{t("Quantity")}</span>
                    <input type="number" className={smallInputCls} value={r.cases || ""} onChange={(e) => patchRow(r.id, { cases: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted">{t("Unit")}</span>
                    <select
                      className={smallInputCls}
                      value={uomOf(r)}
                      onChange={(e) => {
                        const u = e.target.value as Uom;
                        patchRow(r.id, { uom: u, units_per_case: u === "box" ? (r.units_per_case > 1 ? r.units_per_case : 100) : 1 });
                      }}
                    >
                      {UOMS.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.many}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted">
                      {t("Cost per")} {uomName(uomOf(r))}
                    </span>
                    <input type="number" step="0.01" className={smallInputCls} placeholder={state.currency} value={r.unit_cost || ""} onChange={(e) => patchRow(r.id, { unit_cost: Number(e.target.value) || 0 })} />
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {uomOf(r) === "box" && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">{t("Pieces per box")}</span>
                      <input type="number" className={smallInputCls} value={r.units_per_case || ""} onChange={(e) => patchRow(r.id, { units_per_case: Math.max(1, Number(e.target.value) || 1) })} />
                    </label>
                  )}
                  {uomOf(r) !== "kg" && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">
                        {t("Weight per")} {uomName(uomOf(r))} ({t("optional")})
                      </span>
                      <div className={`${smallInputCls} flex items-center gap-1`}>
                        <input type="number" step="0.01" className="min-w-0 flex-1 bg-transparent outline-none" value={r.weight_per_uom ?? ""} placeholder="—" onChange={(e) => patchRow(r.id, { weight_per_uom: e.target.value === "" ? undefined : Number(e.target.value) || 0 })} />
                        <span className="text-muted">kg</span>
                      </div>
                    </label>
                  )}
                </div>
              </>
            ) : (
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
                <span className="text-[11px] text-muted">{t("Cost / unit")}</span>
                <input type="number" step="0.01" className={smallInputCls} placeholder={state.currency} value={r.unit_cost || ""} onChange={(e) => patchRow(r.id, { unit_cost: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">{t("Per case")}</span>
                <input type="number" className={smallInputCls} value={r.units_per_case} onChange={(e) => patchRow(r.id, { units_per_case: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">{t("Cases")}</span>
                <input type="number" className={smallInputCls} value={r.cases} onChange={(e) => patchRow(r.id, { cases: Number(e.target.value) || 0 })} />
              </label>
            </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span>
                {r.category === "general" ? quantitySummary(r) : `${r.units_per_case * r.cases} units · ${((r.volume_ml / 1000) * r.units_per_case * r.cases).toFixed(1)} L`}
                {r.category === "general" && (
                  <>
                    {" · "}
                    <button type="button" onClick={() => patchRow(r.id, { category: "still_wine", hs6: undefined, hs6_desc: undefined, code_source: undefined, code_note: undefined, code_check: undefined, duty_source: undefined, duty_notes: undefined })} className="font-semibold text-teal">
                      It&apos;s an alcoholic drink
                    </button>
                  </>
                )}
              </span>
              {r.category === "general" ? (
                <span className={`rounded-md px-2 py-0.5 font-semibold ${!r.hs6 ? "bg-amber-tint text-amber" : r.code_check ? "bg-amber-tint text-amber" : "bg-teal-tint text-teal"}`}>
                  {!r.hs6 ? t("No code yet") : r.code_source ? (r.code_check ? t("Catalogue · confirm") : t("Code from catalogue")) : t("Code you chose")}
                </span>
              ) : (
                <span className={`rounded-md px-2 py-0.5 font-semibold ${r.hs_confirmed ? "bg-teal-tint text-teal" : "bg-amber-tint text-amber"}`}>
                  {r.hs_confirmed ? t("Code confirmed") : t("Check customs code")}
                </span>
              )}
            </div>
          </Card>
        ))}
        <button type="button" onClick={focusSearch} className="h-12 rounded-xl border border-dashed border-[#B8BAB2] text-sm font-semibold text-teal hover:bg-teal-tint">
          {rows.length ? t("+ Add another product") : t("+ Add a product")}
        </button>
      </div>

      <Footer>
        <div className="flex items-center justify-between gap-2 text-[13px] text-muted">
          <span>
            {rows.length} product{rows.length === 1 ? "" : "s"}
            {rows.every((r) => r.category !== "general") ? ` · ${units.toLocaleString()} units` : ""}
            {rows.length && shipmentKg(rows) ? ` · ${shipmentKg(rows)!.toLocaleString()} kg` : ""}
          </span>
          <span className="flex items-center gap-1 font-semibold text-ink">
            <select aria-label="Invoice currency" className="rounded-md border border-line bg-white px-1 py-0.5 text-[13px] font-semibold" value={state.currency} onChange={(e) => update({ currency: e.target.value, fx_source: "" })}>
              {INVOICE_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {goods.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <PrimaryButton onClick={() => update({ step: 2 })} disabled={!ready}>
          {t("Next: where from, where to")}
        </PrimaryButton>
      </Footer>
    </>
  );
}
