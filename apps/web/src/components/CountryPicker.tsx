"use client";
import { useMemo, useState } from "react";
import { COUNTRIES, EXACT_COUNTRIES, INDICATIVE_COUNTRIES, TIER_LABEL, type DestCountry } from "@/lib/country";
import { useT } from "@/lib/i18n";

const BADGE: Record<string, string> = {
  verified: "bg-teal-tint text-teal",
  official: "bg-teal-tint text-teal",
  indicative: "bg-amber-tint text-amber",
};

export function TierBadge({ tier }: { tier: keyof typeof TIER_LABEL }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BADGE[tier]}`}>{TIER_LABEL[tier]}</span>;
}

/** Searchable destination picker: exact (national schedule) countries first, then indicative ones. */
export function CountryPicker({ value, onChange }: { value: DestCountry; onChange: (c: DestCountry) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cur = COUNTRIES[value];

  const match = (c: DestCountry) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const i = COUNTRIES[c];
    return i.name.toLowerCase().includes(s) || i.code.toLowerCase() === s || i.currency.toLowerCase().includes(s) || i.region.toLowerCase().includes(s);
  };
  const exact = useMemo(() => EXACT_COUNTRIES.filter(match), [q]);
  const indicative = useMemo(() => INDICATIVE_COUNTRIES.filter(match), [q]);

  const pick = (c: DestCountry) => {
    onChange(c);
    setOpen(false);
    setQ("");
  };

  const Row = ({ c }: { c: DestCountry }) => {
    const i = COUNTRIES[c];
    const on = c === value;
    return (
      <button type="button" onClick={() => pick(c)} className={`flex w-full items-center justify-between gap-3 border-b border-line-2 px-3 py-2.5 text-left text-sm last:border-b-0 ${on ? "bg-ground" : "hover:bg-teal-tint"}`}>
        <span className="min-w-0 truncate">
          {i.name} · {i.symbol}
        </span>
        {i.tier === "indicative" ? (
          <span className="shrink-0 text-[12px] text-muted">
            {i.tax_name === "Tax" ? "no VAT" : `${i.tax_name} ${i.tax_pct}%`}
            {i.duty_default_pct != null ? ` · duty ${i.duty_default_pct}%` : ""}
          </span>
        ) : (
          <TierBadge tier={i.tier} />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-2">{t("Destination country")}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-11 items-center justify-between rounded-[10px] border bg-white px-3 text-[15px] ${open ? "border-teal" : "border-line"}`}
      >
        <span className="flex items-center gap-2">
          {cur.name} · {cur.symbol} {cur.currency}
          <TierBadge tier={cur.tier} />
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-muted">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="border-b border-line-2 p-2.5">
            <input autoFocus className="h-9 w-full rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-teal" placeholder="Search country, currency or region…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {exact.length > 0 && <div className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Exact · national schedule loaded</div>}
            {exact.map((c) => (
              <Row key={c} c={c} />
            ))}
            {indicative.length > 0 && <div className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Indicative · you enter duty %, tax applied</div>}
            {indicative.map((c) => (
              <Row key={c} c={c} />
            ))}
            {exact.length + indicative.length === 0 && <div className="px-3 py-3 text-[13px] text-muted">No destination matches. {Object.keys(COUNTRIES).length} are available; more are added on request.</div>}
          </div>
          <div className="bg-ground px-3 py-2 text-[11px] leading-snug text-muted">
            {Object.keys(COUNTRIES).length} destinations. Indicative results use the country&apos;s standard import tax and the duty % you enter; alcohol needs the exact categories (Malaysia and Singapore only, for now).
          </div>
        </div>
      )}
      <span className="text-[11px] leading-snug text-muted">{cur.verify_note}</span>
    </div>
  );
}
