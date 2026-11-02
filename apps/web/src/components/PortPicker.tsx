"use client";
import { useEffect, useRef, useState } from "react";
import { BENCHMARKS } from "@/lib/lanes";
import { searchPorts, type Port } from "@/lib/ports";
import { inputCls } from "./ui";

export function PortPicker({
  value,
  label,
  onPick,
  onCustom,
}: {
  value: string;
  label: string;
  onPick: (p: Port) => void;
  onCustom: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const hits = searchPorts(q).slice(0, 40);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={`${inputCls} flex items-center justify-between text-left`} aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate">{label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-muted">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <input
            autoFocus
            className="h-11 w-full border-b border-line px-3.5 text-[15px] outline-none"
            placeholder="Search port or country"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (hits[0]) onPick(hits[0]);
                else if (q.trim()) onCustom(q.trim());
                setOpen(false);
                setQ("");
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {hits.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-teal-tint ${p.code === value ? "bg-teal-tint font-semibold" : ""}`}
                >
                  <span>
                    {p.name}, {p.country}
                  </span>
                  <span className="text-[11px] text-muted">{BENCHMARKS[p.code] ? "benchmark" : p.code}</span>
                </button>
              </li>
            ))}
            {q.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onCustom(q.trim());
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full px-3.5 py-2.5 text-left text-sm font-semibold text-teal hover:bg-teal-tint"
                >
                  Use “{q.trim()}” as the origin port
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
