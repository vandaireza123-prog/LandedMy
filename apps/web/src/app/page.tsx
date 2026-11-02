"use client";
import { useAppState } from "@/lib/state";
import { Shell } from "@/components/ui";
import { SetupStep } from "@/components/SetupStep";
import { ProductsStep } from "@/components/ProductsStep";
import { LogisticsStep } from "@/components/LogisticsStep";
import { ResultsStep } from "@/components/ResultsStep";
import { DEST_PORTS } from "@/lib/ports";

export default function Page() {
  const { state, update, reset, hydrated, shareUrl, shipment } = useAppState();
  const dest = DEST_PORTS.find((p) => p.code === state.dest_port);
  const right = state.step === 1 ? undefined : `${state.origin_label.split(",")[0]} → ${dest?.label.split(" (")[0] ?? ""}`;

  if (!hydrated) {
    return (
      <Shell>
        <div className="p-5 text-sm text-muted">Loading…</div>
      </Shell>
    );
  }

  return (
    <Shell right={right}>
      {state.step === 1 && <SetupStep state={state} update={update} />}
      {state.step === 2 && <ProductsStep state={state} update={update} />}
      {state.step === 3 && <LogisticsStep state={state} update={update} />}
      {state.step === 4 && <ResultsStep state={state} update={update} reset={reset} shipment={shipment} shareUrl={shareUrl} />}
    </Shell>
  );
}
