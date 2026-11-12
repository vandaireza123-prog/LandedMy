"use client";
import { useAppState } from "@/lib/state";
import { useFreightAuto } from "@/lib/useFreightAuto";
import { Shell, setCurrencySymbol } from "@/components/ui";
import { COUNTRIES } from "@/lib/country";
import { SetupStep } from "@/components/SetupStep";
import { ProductsStep } from "@/components/ProductsStep";
import { LogisticsStep } from "@/components/LogisticsStep";
import { ResultsStep } from "@/components/ResultsStep";
import { DEST_PORTS } from "@/lib/ports";
import { LangProvider, type Lang } from "@/lib/i18n";
import { useUser } from "@/lib/supabase";
import { AccountSheet } from "@/components/AccountSheet";
import { useState } from "react";
import { useDutyPrefill } from "@/lib/useDutyPrefill";

export default function Page() {
  const { state, update, patchProducts, reset, hydrated, shareUrl, shipment, manualRateLines } = useAppState();
  useDutyPrefill(state, patchProducts);
  useFreightAuto(state, update);
  const dest = DEST_PORTS.find((p) => p.code === state.dest_port);
  setCurrencySymbol(COUNTRIES[state.dest_country].symbol);
  const right = state.step <= 2 ? undefined : `${state.origin_label.split(",")[0]} → ${dest?.label.split(" (")[0] ?? ""}`;

  const toggleLang = (l: Lang) => update({ lang: l });
  const { user } = useUser();
  const [account, setAccount] = useState(false);

  if (!hydrated) {
    return (
      <Shell>
        <div className="p-5 text-sm text-muted">Loading…</div>
      </Shell>
    );
  }

  return (
    <LangProvider lang={state.lang}>
    <Shell right={right} onLang={toggleLang} lang={state.lang} onAccount={() => setAccount(true)} signedIn={!!user}>
      {account && <AccountSheet user={user} onClose={() => setAccount(false)} update={update} />}
      {state.step === 1 && <ProductsStep state={state} update={update} />}
      {state.step === 2 && <SetupStep state={state} update={update} />}
      {state.step === 3 && <LogisticsStep state={state} update={update} />}
      {state.step === 4 && <ResultsStep state={state} update={update} reset={reset} shipment={shipment} shareUrl={shareUrl} manualRateLines={manualRateLines} user={user} onAccount={() => setAccount(true)} />}
    </Shell>
    </LangProvider>
  );
}
