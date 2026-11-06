"use client";
import { useState } from "react";
import type { AppState, ProductRow } from "@/lib/state";
import { CATEGORY_HS, CATEGORY_LABEL, hsForCategory, searchLibrary, type Category, type LibraryProduct } from "@/lib/products";
import { Card, Footer, PrimaryButton, Progress, Title, smallInputCls } from "./ui";
import { ScanSheet } from "./ScanSheet";
import { FX_DEFAULT } from "@/lib/lanes";
import { GENERAL_GROUPS, GENERAL_LINES, GENERAL_VERIFY_URL } from "@landedmy/engine";
import { SENSITIVE_CHAPTERS, searchHs, type HsHit } from "@/lib/hs/search";
import { useEffect } from "react";
import { COUNTRIES } from "@/lib/country";
import { fetchWorldRate } from "@/lib/api";
import { useT } from "@/lib/i18n";

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

function fromHs(h: HsHit, name: string, indicative = false): ProductRow {
  const dotted = `${h.code6.slice(0, 4)}.${h.code6.slice(4)}`;
  const line = indicative ? undefined : GENERAL_LINES.find((g) => g.hs_code.startsWith(dotted));
  return {
    id: uid(),
    name: name || h.description.split(";")[0],
    category: "general",
    general_group: line?.group ?? groupForChapter(h.chapter),
    hs6: h.code6,
    hs6_desc: h.description,
    hs_code: line ? line.hs_code : indicative ? dotted : "MANUAL",
    volume_ml: 0,
    abv: 0,
    units_per_case: 1,
    cases: 100,
    unit_cost: 0,
    hs_confirmed: !!line,
    manual_duty_pct: line ? line.duty_pct : indicative ? undefined : 0,
    manual_sst_pct: line ? line.sst_pct : 10,
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
  const t = useT();
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const hits = searchLibrary(q);
  const [hsHits, setHsHits] = useState<HsHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHsHits([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => searchHs(q, 6).then((r) => live && setHsHits(r)), 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const rows = state.products;
  const country = COUNTRIES[state.dest_country];
  const indicative = country.tier === "indicative";

  const setRows = (next: ProductRow[]) => update({ products: next });

  // Indicative destinations: pre-fill duty % from the world rates database for lines that have an HS-6 and no user-entered duty.
  useEffect(() => {
    if (!indicative) return;
    const todo = rows.filter((r) => r.category === "general" && r.hs6 && r.manual_duty_pct == null && !r.duty_source);
    if (!todo.length) return;
    let live = true;
    Promise.all(todo.map((r) => fetchWorldRate(state.dest_country, r.hs6!, state.origin_iso).then((w) => [r.id, w] as const))).then((res) => {
      if (!live) return;
      const byId = new Map(res);
      update({
        products: rows.map((r) => {
          const w = byId.get(r.id);
          if (w === undefined) return r;
          if (!w || !w.rate || w.rate.value == null) return { ...r, duty_source: "none" };
          const label = `${w.rate.origin === "MFN" ? "MFN" : `${w.rate.origin} preferential`} ${w.rate.year ?? ""} · ${w.source?.name?.split(" (")[0] ?? w.rate.source_id} · ${w.rate.tier}${w.rate.rate_type === "compound" ? " · average, some lines specific" : ""}`;
          return { ...r, manual_duty_pct: w.rate.value, duty_source: label };
        }),
      });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicative, state.dest_country, state.origin_iso, rows.map((r) => `${r.id}:${r.hs6}:${r.manual_duty_pct ?? ""}:${r.duty_source ?? ""}`).join("|")]);
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
    setRows([...rows, p ? fromLibrary(p) : blankRow()]);
    setQ("");
  };
  const addHs = (h: HsHit) => {
    setRows([...rows, fromHs(h, q.trim(), indicative)]);
    setQ("");
  };

  const units = rows.reduce((a, r) => a + r.units_per_case * r.cases, 0);
  const goods = rows.reduce((a, r) => a + r.units_per_case * r.cases * r.unit_cost, 0);
  const ready = rows.length > 0 && rows.every((r) => r.name && r.unit_cost > 0 && r.cases > 0 && (r.category === "general" || r.volume_ml > 0));

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
            placeholder={t("Search product, e.g. Duvel 330ml")}
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
              {r.category !== "general" ? (
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
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted">{t("Group")}</span>
                  <select className={smallInputCls} value={r.general_group ?? "other"} onChange={(e) => patchRow(r.id, { general_group: e.target.value, hs_code: "MANUAL", hs_confirmed: false })}>
                    {GENERAL_GROUPS.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {r.category === "general" && (
              <div className="mt-2 flex flex-col gap-2">
                {r.hs6 && (
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-ground px-2.5 py-2 text-[11px]">
                    <span className="min-w-0">
                      <span className="font-mono font-semibold text-teal">HS {r.hs6.slice(0, 4)}.{r.hs6.slice(4)}</span> <span className="text-muted">{r.hs6_desc}</span>
                      {SENSITIVE_CHAPTERS[r.hs6.slice(0, 2)] && <span className="mt-0.5 block text-amber">{SENSITIVE_CHAPTERS[r.hs6.slice(0, 2)]}</span>}
                    </span>
                    <a href={`${GENERAL_VERIFY_URL}`} target="_blank" rel="noopener" className="shrink-0 font-semibold text-teal">
                      {state.dest_country === "SG" ? "SG rate" : "MY rate"} →
                    </a>
                  </div>
                )}
                {indicative ? (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">Import duty % into {country.name}</span>
                      <input type="number" step="0.5" className={`${smallInputCls} border-teal`} value={r.manual_duty_pct ?? country.duty_default_pct ?? ""} placeholder={country.duty_default_pct != null ? String(country.duty_default_pct) : "e.g. 20"} onChange={(e) => patchRow(r.id, { manual_duty_pct: e.target.value === "" ? undefined : Number(e.target.value) || 0, duty_source: "you" })} />
                      {r.duty_source && r.duty_source !== "none" && r.duty_source !== "you" && <span className="text-[10px] leading-snug text-muted">Pre-filled: {r.duty_source}</span>}
                      {r.duty_source === "none" && <span className="text-[10px] leading-snug text-muted">No rate loaded yet for this code — enter it from the tariff tool.</span>}
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">{country.tax_name}</span>
                      <div className={`${smallInputCls} flex items-center bg-ground text-muted`}>{country.tax_name === "Tax" ? "none at import" : `${country.tax_pct}% · applied`}</div>
                    </label>
                  </div>
                ) : (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted">Tariff line (pick one, or enter rates yourself)</span>
                  <select
                    className={smallInputCls}
                    value={r.hs_code}
                    onChange={(e) => {
                      const code = e.target.value;
                      const line = GENERAL_LINES.find((g) => g.hs_code === code);
                      patchRow(r.id, { hs_code: code, hs_confirmed: !!line, manual_duty_pct: line ? line.duty_pct : r.manual_duty_pct, manual_sst_pct: line ? line.sst_pct : r.manual_sst_pct });
                    }}
                  >
                    <option value="MANUAL">Enter duty % and SST % myself</option>
                    {GENERAL_LINES.filter((g) => (r.hs6 ? g.hs_code.replace(/\./g, "").startsWith(r.hs6.slice(0, 4)) : false) || g.group === (r.general_group ?? "other")).map((g) => (
                      <option key={g.hs_code} value={g.hs_code}>
                        {g.hs_code} · {g.description} · duty {g.duty_pct}% · SST {g.sst_pct}%
                      </option>
                    ))}
                  </select>
                </label>
                )}
                {!indicative && r.hs_code === "MANUAL" && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">Import duty % of CIF</span>
                      <input type="number" step="0.5" className={smallInputCls} value={r.manual_duty_pct ?? 0} onChange={(e) => patchRow(r.id, { manual_duty_pct: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">SST %</span>
                      <select className={smallInputCls} value={r.manual_sst_pct ?? 10} onChange={(e) => patchRow(r.id, { manual_sst_pct: Number(e.target.value) })}>
                        <option value={0}>0% (exempt)</option>
                        <option value={5}>5%</option>
                        <option value={10}>10%</option>
                      </select>
                    </label>
                  </div>
                )}
                <a href={country.lookup} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-teal">
                  {indicative ? `Look up ${r.hs6 ? `${r.hs6.slice(0, 4)}.${r.hs6.slice(4)}` : "the code"} on ${country.customs_name}'s tariff tool →` : "Look up the official rate on JKDM's tariff tool →"}
                </a>
              </div>
            )}

            {indicative && r.category !== "general" && (
              <div className="mt-2 rounded-lg bg-amber-tint px-2.5 py-2 text-[11px] leading-snug text-amber">
                Alcohol into {country.name} isn&apos;t priced yet (excise not loaded). Set the destination to Malaysia or Singapore, or change the type to non-alcohol goods.
              </div>
            )}
            <div className={`mt-2 grid gap-2 ${r.category === "general" ? "grid-cols-3" : "grid-cols-5"}`}>
              {r.category !== "general" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted">ml</span>
                    <input type="number" className={smallInputCls} value={r.volume_ml} onChange={(e) => patchRow(r.id, { volume_ml: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted">ABV %</span>
                    <input type="number" step="0.1" className={smallInputCls} value={r.abv} onChange={(e) => patchRow(r.id, { abv: Number(e.target.value) || 0 })} />
                  </label>
                </>
              )}
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
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
              <span>
                {r.units_per_case * r.cases} units{r.category !== "general" ? ` · ${((r.volume_ml / 1000) * r.units_per_case * r.cases).toFixed(1)} L` : ""}
              </span>
              <span className={`rounded-md px-2 py-0.5 font-semibold ${r.hs_confirmed ? "bg-teal-tint text-teal" : "bg-amber-tint text-amber"}`}>
                {r.hs_confirmed ? t("Code confirmed") : r.hs_code === "MANUAL" ? t("Your rates, verify") : t("Check customs code")}
              </span>
            </div>
          </Card>
        ))}
        <button type="button" onClick={() => add()} className="h-12 rounded-xl border border-dashed border-[#B8BAB2] text-sm font-semibold text-teal hover:bg-teal-tint">
          {t("+ Add another product")}
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
            {t("Back")}
          </button>
          <PrimaryButton onClick={() => update({ step: 3 })} disabled={!ready}>
            {t("Next: freight and charges")}
          </PrimaryButton>
        </div>
      </Footer>
    </>
  );
}
