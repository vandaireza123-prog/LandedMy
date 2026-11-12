"use client";
import { useState } from "react";
import type { AppState } from "@/lib/state";
import { EQUIPMENT_LABEL } from "@/lib/lanes";
import { freightFor } from "@/lib/freight";
import { modeCount } from "@/lib/shipment";
import { DEST_PORTS } from "@/lib/ports";
import { submitLead } from "@/lib/api";
import { Card, rm, smallInputCls } from "./ui";
import { useT } from "@/lib/i18n";

export function QuoteGap({ state, shareUrl, landedTotal }: { state: AppState; shareUrl: string; landedTotal: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "" });

  const est = freightFor(state);
  const bench = est.ok ? est : null;
  const units = modeCount(state);
  const quote = state.forwarder_quote;
  const gapPct = bench && quote > 0 ? (quote > bench.high ? ((quote - bench.high) / bench.high) * 100 : quote < bench.low ? ((quote - bench.low) / bench.low) * 100 : 0) : 0;
  const dest = DEST_PORTS.find((p) => p.code === state.dest_port)?.label.split(" (")[0];

  const send = async () => {
    setSent("sending");
    const ok = await submitLead({
      ...f,
      lane: `${state.origin_label} → ${dest}`,
      equipment: `${EQUIPMENT_LABEL[state.equipment]} × ${units}`,
      products: state.products.map((p) => `${p.name} × ${p.units_per_case * p.cases}`).join("; "),
      landed_total_rm: rm(landedTotal, 0),
      forwarder_quote: quote ? `${state.currency} ${quote}` : "none",
      share_link: shareUrl,
    });
    setSent(ok ? "ok" : "fail");
  };

  return (
    <Card>
      <div className="text-sm font-semibold">{t("Freight check")}</div>
      {state.incoterm === "CIF" ? (
        <p className="mt-1 text-[13px] text-muted">Your price is CIF, so freight is inside the supplier price. Ask them to split it out and you'll know whether their shipping line is fair.</p>
      ) : quote > 0 && bench ? (
        <div className="mt-2">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted">Your forwarder</span>
            <span className="font-semibold">
              {state.currency} {rm(quote, 0)}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted">Our estimate{bench.tier === "rough" ? " (rough)" : ""}</span>
            <span>
              {bench.currency} {rm(bench.low, 0)}–{rm(bench.high, 0)}
            </span>
          </div>
          <div className={`mt-2 rounded-lg px-3 py-2 text-[13px] font-semibold ${gapPct > 15 ? "bg-amber-tint text-amber" : "bg-teal-tint text-teal"}`}>
            {gapPct > 10
              ? `${Math.round(gapPct)}% above the top of our range — worth getting a second quote.`
              : gapPct < -10
                ? `${Math.round(-gapPct)}% below the bottom of our range — good price, check what's excluded.`
                : "Within the normal range for this route."}
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-muted">
          {bench ? "Enter your forwarder's quote on the previous step and we'll tell you if it's fair." : "No freight estimate for this mode. Request quotes and compare them here."}
        </p>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 h-11 w-full rounded-[10px] border border-teal text-[13px] font-semibold text-teal hover:bg-teal-tint">
          {t("Get quotes from forwarders and customs agents")}
        </button>
      ) : sent === "ok" ? (
        <p className="mt-3 rounded-lg bg-teal-tint px-3 py-2 text-[13px] text-teal">Sent. You'll hear back within one working day.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <input className={smallInputCls} placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={smallInputCls} placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          <input className={smallInputCls} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className={smallInputCls} type="tel" placeholder="WhatsApp / phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <p className="text-[11px] text-muted">We send this shipment summary (not your prices) to vetted partners. No spam, no account needed.</p>
          <button type="button" disabled={!f.email || sent === "sending"} onClick={send} className="h-11 rounded-[10px] bg-teal text-[13px] font-semibold text-white disabled:opacity-40">
            {sent === "sending" ? "Sending…" : sent === "fail" ? "Failed, try again" : "Send request"}
          </button>
        </div>
      )}
    </Card>
  );
}
