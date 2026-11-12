"use client";
import { useMemo, useState } from "react";
import { COUNTRIES, DEST_COUNTRIES } from "@/lib/country";

const flag = (iso: string) => (/^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");

/** Homepage search: product, from, to → the calculator with the product search filled and the route set. */
export function HeroSearch() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("BE");
  const [to, setTo] = useState("MY");
  const countries = useMemo(() => DEST_COUNTRIES.map((c) => ({ c, name: COUNTRIES[c].name })).sort((a, b) => a.name.localeCompare(b.name)), []);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams({ from, to });
    if (q.trim()) p.set("q", q.trim());
    window.location.href = `/calc/?${p.toString()}`;
  };
  const sel = "w-full appearance-none bg-transparent text-base text-ink outline-none";
  return (
    <form onSubmit={go} className="mx-auto mt-9 grid max-w-[900px] gap-1 rounded-[20px] border border-line bg-white p-2 text-left shadow-[0_20px_40px_-28px_rgba(21,32,31,0.35)] md:grid-cols-[2.2fr_1fr_1fr_auto]">
      <label className="flex flex-col gap-0.5 rounded-xl px-4 py-2.5">
        <span className="text-xs font-semibold text-muted">What are you shipping?</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Wine, landing gear, solar panels, HS code…" className="w-full bg-transparent text-base text-ink outline-none placeholder:text-[#9AA3A1]" />
      </label>
      <label className="flex flex-col gap-0.5 rounded-xl border-line-2 px-4 py-2.5 md:border-l">
        <span className="text-xs font-semibold text-muted">From</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)} className={sel} aria-label="Shipping from">
          {countries.map(({ c, name }) => (
            <option key={c} value={c}>{`${flag(c)} ${name}`}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 rounded-xl border-line-2 px-4 py-2.5 md:border-l">
        <span className="text-xs font-semibold text-muted">To</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} className={sel} aria-label="Shipping to">
          {countries.map(({ c, name }) => (
            <option key={c} value={c}>{`${flag(c)} ${name}`}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="m-1 inline-flex min-h-12 items-center justify-center rounded-xl bg-teal px-6 text-[15px] font-semibold text-white hover:bg-teal-dark">
        Get landed cost →
      </button>
    </form>
  );
}
