"use client";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function Shell({ children, right, onLang, lang }: { children: ReactNode; right?: ReactNode; onLang?: () => void; lang?: string }) {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ground">
      <header className="flex items-center justify-between px-5 pb-3 pt-12">
        <div className="font-display text-lg font-bold tracking-tight">
          Landed<span className="text-teal">MY</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          <span>{right ?? t("Free · no login")}</span>
          {onLang && (
            <button type="button" onClick={onLang} className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink" aria-label="Switch language">
              {lang === "ms" ? "EN" : "BM"}
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5 px-5 pb-2" aria-label={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-teal" : "bg-line"}`} />
      ))}
    </div>
  );
}

export function Title({ step, title, sub }: { step: number; title: string; sub: string }) {
  const t = useT();
  return (
    <div className="px-5 pt-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-teal">{t("Step {n} of 4", { n: step })}</div>
      <h1 className="mt-1.5 font-display text-[28px] font-bold leading-[1.1] tracking-tight">{t(title)}</h1>
      <p className="mt-1 text-sm leading-snug text-muted">{t(sub)}</p>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-[10px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20";
export const smallInputCls =
  "h-10 w-full rounded-lg border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white p-3.5 ${className}`}>{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[54px] w-full items-center justify-center rounded-xl bg-teal text-base font-semibold text-white transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[54px] w-full items-center justify-center rounded-xl border border-line bg-white text-[15px] font-semibold text-ink transition hover:bg-line-2"
    >
      {children}
    </button>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2 px-5 pb-8 pt-3">{children}</div>;
}

export const rm = (n: number, d = 2) =>
  new Intl.NumberFormat("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
