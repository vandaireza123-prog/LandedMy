"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ShipmentResult } from "@landedmy/engine";
import type { AppState } from "@/lib/state";
import { getProfile, type Profile } from "@/lib/supabase";
import { DEST_PORTS } from "@/lib/ports";
import { COUNTRIES } from "@/lib/country";
import { EQUIPMENT_LABEL } from "@/lib/lanes";
import { cs, rm, smallInputCls } from "./ui";

const LS = "landedmy:quote";

/** Branded A4 quote. Renders a print-only document; the on-screen sheet collects the header fields. */
export function QuoteSheet({ state, result, user, onClose }: { state: AppState; result: ShipmentResult; user: User | null; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile>({ company_name: "", logo_url: "" });
  const [preparedFor, setPreparedFor] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) {
        const j = JSON.parse(raw);
        setProfile({ company_name: j.company_name ?? "", logo_url: j.logo_url ?? "" });
        setNotes(j.notes ?? "");
      }
    } catch {
      /* ignore */
    }
    if (user) getProfile().then((p) => p && (p.company_name || p.logo_url) && setProfile({ company_name: p.company_name ?? "", logo_url: p.logo_url ?? "" })).catch(() => {});
  }, [user]);

  const print = () => {
    try {
      localStorage.setItem(LS, JSON.stringify({ ...profile, notes }));
    } catch {
      /* ignore */
    }
    document.body.classList.add("print-quote");
    const done = () => document.body.classList.remove("print-quote");
    window.addEventListener("afterprint", done, { once: true });
    setTimeout(() => window.print(), 50);
  };

  const dest = DEST_PORTS.find((p) => p.code === state.dest_port)?.label.split(" (")[0];
  const t = result.totals;
  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 print:hidden" onClick={onClose}>
        <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-ground" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <div className="font-display text-lg font-bold">Quote as PDF</div>
            <button type="button" aria-label="Close" onClick={onClose} className="text-muted">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-8">
            <p className="text-[12px] text-muted">An A4 quote with your name and logo. In the print dialog choose “Save as PDF”.</p>
            <input className={smallInputCls} placeholder="Your company name" value={profile.company_name ?? ""} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} />
            <div className="flex items-center gap-3">
              {profile.logo_url ? <img src={profile.logo_url} alt="Logo" className="h-10 max-w-[120px] object-contain" /> : <span className="text-[11px] text-muted">No logo</span>}
              <label className="cursor-pointer text-[12px] font-semibold text-teal">
                {profile.logo_url ? "Change logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fr = new FileReader();
                    fr.onload = () => setProfile({ ...profile, logo_url: String(fr.result) });
                    fr.readAsDataURL(f);
                  }}
                />
              </label>
            </div>
            <input className={smallInputCls} placeholder="Prepared for (customer)" value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)} />
            <input className={smallInputCls} placeholder="Reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
            <textarea className="h-20 w-full rounded-lg border border-line bg-white p-2.5 text-sm outline-none focus:border-teal" placeholder="Notes or terms (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" onClick={print} className="mt-1 h-[54px] rounded-xl bg-teal text-base font-semibold text-white">
              Open print / save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Print-only document */}
      <div id="quote-doc" className="hidden print:block" style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#15201F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0B5E5A", paddingBottom: 12 }}>
          <div>
            {profile.logo_url && <img src={profile.logo_url} alt="" style={{ height: 48, maxWidth: 180, objectFit: "contain", marginBottom: 6 }} />}
            <div style={{ fontSize: 18, fontWeight: 700 }}>{profile.company_name || "Landed cost quote"}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#5B6664" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#15201F" }}>Landed cost quote</div>
            <div>{today}</div>
            {ref && <div>Ref: {ref}</div>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 32, marginTop: 14, fontSize: 12 }}>
          <div>
            <div style={{ color: "#5B6664" }}>Prepared for</div>
            <div style={{ fontWeight: 600 }}>{preparedFor || "—"}</div>
          </div>
          <div>
            <div style={{ color: "#5B6664" }}>Route</div>
            <div style={{ fontWeight: 600 }}>
              {state.origin_label} → {dest} · {EQUIPMENT_LABEL[state.equipment]}
              {state.equipment === "pallet" && state.pallets > 1 ? ` × ${state.pallets}` : ""} · {state.incoterm}
            </div>
          </div>
          <div>
            <div style={{ color: "#5B6664" }}>Exchange rate</div>
            <div style={{ fontWeight: 600 }}>
              1 {state.currency} = {cs()} {state.fx_rate}
            </div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18, fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: "#E6F1F0" }}>
              {["Product", "Units", "Goods", "Freight+Ins", "Duty", "Excise", COUNTRIES[state.dest_country].tax_name, "Local", "Landed", "Per unit"].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px 6px", fontWeight: 600, borderBottom: "1px solid #D9DAD3" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: "6px 6px", borderBottom: "1px solid #ECEDE8" }}>{l.name}</td>
                {[l.units, l.goods, l.freight + l.insurance, l.duty, l.excise, l.sst, l.local_charges, l.landed].map((v, i) => (
                  <td key={i} style={{ textAlign: "right", padding: "6px 6px", borderBottom: "1px solid #ECEDE8" }}>
                    {i === 0 ? v.toLocaleString() : rm(v)}
                  </td>
                ))}
                <td style={{ textAlign: "right", padding: "6px 6px", borderBottom: "1px solid #ECEDE8", fontWeight: 700 }}>{rm(l.per_unit.landed)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td style={{ padding: "8px 6px" }}>Total ({cs()})</td>
              <td style={{ textAlign: "right", padding: "8px 6px" }}>{result.lines.reduce((a, l) => a + l.units, 0).toLocaleString()}</td>
              {[t.goods, t.freight + t.insurance, t.duty, t.excise, t.sst, t.local_charges, t.landed].map((v, i) => (
                <td key={i} style={{ textAlign: "right", padding: "8px 6px" }}>
                  {rm(v)}
                </td>
              ))}
              <td></td>
            </tr>
          </tbody>
        </table>

        {notes && (
          <div style={{ marginTop: 16, fontSize: 11.5, whiteSpace: "pre-wrap" }}>
            <div style={{ color: "#5B6664", marginBottom: 2 }}>Notes</div>
            {notes}
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 10, color: "#5B6664", lineHeight: 1.5 }}>
          Rates: {COUNTRIES[state.dest_country].rates_note} Estimate only; final assessment by {COUNTRIES[state.dest_country].customs_name}. Tax share of landed cost: {Math.round(t.tax_share_pct)}%.
          <div style={{ marginTop: 6, fontWeight: 600, color: "#0B5E5A" }}>Made with LandedMY · landedmy.netlify.app</div>
        </div>
      </div>
    </>
  );
}
