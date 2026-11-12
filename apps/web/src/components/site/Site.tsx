import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./Brand";

export const CALC = "/calc/";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Costavora home" className={`no-underline ${className}`}>
      <Wordmark size={24} />
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="border-b border-line-2 bg-ground">
      <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between gap-4 px-6">
        <Logo />
        <nav className="hidden gap-7 text-sm font-medium text-muted md:flex">
          <Link href={CALC}>Calculator</Link>
          <Link href="/#coverage">Coverage</Link>
          <Link href="/guides/import-wine-malaysia-cost/">Guides</Link>
          <Link href="/#api">API</Link>
        </nav>
        <Link href={CALC} className="inline-flex min-h-10 items-center rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-dark">
          Open calculator
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter({ next }: { next?: { href: string; label: string } }) {
  return (
    <footer className="border-t border-line-2">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-6 py-7 text-[13px] text-muted">
        <span>Costavora · Estimates for planning. Final assessment is by the customs authority of the importing country.</span>
        {next ? (
          <Link href={next.href} className="text-teal">{next.label} →</Link>
        ) : (
          <span className="flex gap-4">
            <Link href="/guides/import-wine-malaysia-cost/">Guides</Link>
            <Link href="/#api">API</Link>
            <Link href={CALC}>Bahasa Malaysia</Link>
          </span>
        )}
      </div>
    </footer>
  );
}

export function Btn({ href, children, ghost = false, className = "" }: { href: string; children: ReactNode; ghost?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-[22px] text-[15px] font-semibold no-underline ${
        ghost ? "border border-line bg-white text-ink hover:bg-line-2" : "bg-teal text-white hover:bg-teal-dark"
      } ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`rounded-2xl border border-line-2 bg-white ${className}`}>{children}</div>;
}

/** Article page shell: nav, measure-width body, footer. */
export function Article({
  kicker,
  date,
  readTime,
  title,
  lede,
  children,
  next,
}: {
  kicker: string;
  date: string;
  readTime: string;
  title: string;
  lede: string;
  children: ReactNode;
  next: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5 px-6 pt-16">
          <div className="flex flex-wrap gap-3 text-[13px] text-muted">
            <span className="font-semibold uppercase tracking-wider text-teal">{kicker}</span>
            <span>{date}</span>
            <span>{readTime}</span>
          </div>
          <h1 className="font-display text-[38px] font-bold leading-[1.05] tracking-tight md:text-[46px]">{title}</h1>
          <p className="text-lg leading-relaxed text-muted md:text-xl">{lede}</p>
        </div>
        <div className="article mx-auto flex max-w-[720px] flex-col gap-5 px-6 pb-16 pt-8 text-[17px] leading-[1.65]">{children}</div>
      </main>
      <SiteFooter next={next} />
    </div>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-5 font-display text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">
      {children}
    </h2>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-teal-tint px-[18px] py-4 text-[15px] leading-[1.55] text-teal-dark">{children}</div>;
}

export function Table({ head, rows }: { head: (string | { label: string; num?: boolean })[]; rows: (string | ReactNode)[][] }) {
  const cols = head.map((h) => (typeof h === "string" ? { label: h, num: false } : { label: h.label, num: !!h.num }));
  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.label} className={`border-b border-line-2 px-3.5 py-3 text-xs font-semibold uppercase tracking-wider text-muted ${c.num ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={`border-b border-line-2 px-3.5 py-3 align-top last:border-b-0 ${cols[j]?.num ? "text-right font-mono tabular-nums" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Hero figure card used at the top of a worked example. */
export function Figure({ meta, value, unit, shares }: { meta: string; value: string; unit: string; shares: { label: string; pct: number; color: string }[] }) {
  return (
    <Card className="flex flex-col gap-4 p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-teal">Worked example</span>
        <span className="text-[13px] text-muted">{meta}</span>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[44px] font-bold leading-none tabular-nums md:text-[52px]">{value}</span>
        <span className="text-[15px] text-muted">{unit}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
        {shares.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-[13px] text-muted">
        {shares.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label} {Math.round(s.pct)}%
          </span>
        ))}
      </div>
    </Card>
  );
}

export function CtaCard({ title, body, label }: { title: string; body: string; label: string }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-teal p-7 text-white">
      <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight">{title}</h2>
      <p className="text-base text-[#D6E6E4]">{body}</p>
      <Link href={CALC} className="inline-flex min-h-12 items-center self-start rounded-xl bg-white px-[22px] text-[15px] font-semibold text-teal no-underline">
        {label}
      </Link>
    </div>
  );
}

export function shareOf(l: { goods: number; freight_insurance: number; local_charges: number; duty: number; excise: number; sst: number; landed: number }) {
  const p = (n: number) => (n / l.landed) * 100;
  return [
    { label: "Goods + logistics", pct: p(l.goods + l.freight_insurance + l.local_charges), color: "#B7D5D1" },
    { label: "Duty", pct: p(l.duty), color: "#5FA39D" },
    { label: "Excise", pct: p(l.excise), color: "#0B5E5A" },
    { label: "SST", pct: p(l.sst), color: "#15201F" },
  ];
}
