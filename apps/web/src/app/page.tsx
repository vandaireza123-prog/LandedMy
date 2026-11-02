import type { Metadata } from "next";
import Link from "next/link";
import { Btn, CALC, Card, SiteFooter, SiteNav } from "@/components/site/Site";
import { ShareRedirect } from "@/components/site/ShareRedirect";
import { WINE_BASE, priceExample, rm2 } from "@/lib/examples";

export const metadata: Metadata = {
  title: "LandedMY — free landed cost calculator for importing into Malaysia",
  description:
    "Import duty, excise, SST and port charges for wine, beer, cider, spirits and general goods coming into Malaysia, to the sen. Per bottle, per case, per pallet. Verified against real customs K1 declarations.",
  alternates: { canonical: "https://landedmy.netlify.app/" },
  openGraph: { title: "LandedMY — know your landed cost before you order", description: "Free Malaysian import duty, excise and SST calculator. Exact to the sen, every rate linked to its gazette.", url: "https://landedmy.netlify.app/", type: "website" },
};

export default function Landing() {
  const w = priceExample(WINE_BASE);
  const pu = w.per_unit;
  const share = (n: number) => `${Math.round((n / pu.landed) * 100)}%`;

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <ShareRedirect />
      <SiteNav />
      <main className="flex-1">
        {/* Hero */}
        <section id="top" className="mx-auto max-w-[1120px] px-6 pb-14 pt-14 md:pt-[72px]">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="flex flex-col gap-5">
              <span className="inline-flex self-start rounded-full bg-teal-tint px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal">Free · Malaysia · Rates in force 1 Nov 2025</span>
              <h1 className="font-display text-[42px] font-bold leading-[1.02] tracking-tight md:text-[56px]">Know your landed cost before you order.</h1>
              <p className="max-w-[520px] text-lg leading-relaxed text-muted">
                Import duty, excise, SST and port charges for goods coming into Malaysia, to the sen. Wine, beer, cider, spirits and general goods. Enter the product, cost and quantity; get the exact cost per bottle, per case, per pallet.
              </p>
              <div className="flex flex-wrap gap-3">
                <Btn href={CALC}>Calculate a shipment</Btn>
                <Btn href="#install" ghost>Add to home screen</Btn>
              </div>
              <div className="flex flex-wrap gap-6 text-[13px] text-muted">
                <span>No login needed</span>
                <span>Bahasa Malaysia available</span>
                <span>Every rate links to its gazette</span>
              </div>
            </div>

            {/* Phone mock, real numbers from the engine */}
            <div className="flex justify-center">
              <div className="flex w-[340px] max-w-full flex-col gap-3.5 rounded-[28px] border border-line-2 bg-white p-5 shadow-[0_30px_60px_-30px_rgba(21,32,31,0.25)]">
                <div className="flex justify-between text-xs text-muted">
                  <span className="font-display text-[15px] font-bold text-ink">
                    Landed<span className="text-teal">MY</span>
                  </span>
                  <span>Antwerp → Port Klang</span>
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal">Landed cost</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[44px] font-bold leading-none tabular-nums">{rm2(pu.landed)}</span>
                  <span className="text-[13px] text-muted">per bottle</span>
                </div>
                <div className="text-[13px] text-muted">Still wine 13% · €5.00 · 60 cases · 1 pallet</div>
                <div className="flex h-2 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
                  <div style={{ width: share(pu.cif + pu.local_charges), background: "#B7D5D1" }} />
                  <div style={{ width: share(pu.duty), background: "#5FA39D" }} />
                  <div style={{ width: share(pu.excise), background: "#0B5E5A" }} />
                  <div style={{ width: share(pu.sst), background: "#15201F" }} />
                </div>
                <dl className="flex flex-col text-sm">
                  {[
                    ["Goods (CIF)", pu.cif],
                    ["Import duty RM7/L", pu.duty],
                    ["Excise RM165/L alc.", pu.excise],
                    ["SST 10%", pu.sst],
                    ["Port, agent, haulage", pu.local_charges],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between border-b border-line-2 py-2.5 last:border-b-0">
                      <dt>{k}</dt>
                      <dd className="font-mono tabular-nums">{rm2(v as number)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2 text-[13px] font-semibold">
                  <span className="flex-1 rounded-[10px] bg-teal py-2.5 text-center text-white">PDF quote</span>
                  <span className="flex-1 rounded-[10px] border border-line py-2.5 text-center">Share</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Proof strip */}
        <section id="verified" className="bg-ink text-ground">
          <div className="mx-auto grid max-w-[1120px] gap-8 px-6 py-11 md:grid-cols-3">
            {[
              ["50 / 50", "lines on real customs K1 declarations matched to the sen"],
              ["RM0.00", "to use. No account for the calculator; one optional for saved shipments"],
              ["4 steps", "route, products, logistics, result. Under two minutes on a phone"],
            ].map(([n, t]) => (
              <div key={n} className="flex flex-col gap-1.5">
                <span className="font-display text-[40px] font-bold leading-none tabular-nums">{n}</span>
                <span className="text-sm text-[#B9C1BE]">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto flex max-w-[1120px] flex-col gap-7 px-6 pb-6 pt-[72px]">
          <div className="flex max-w-[640px] flex-col gap-2">
            <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight md:text-[36px]">The tax stack, done the way Customs does it</h2>
            <p className="leading-relaxed text-muted">
              Most online calculators apply a flat percentage. Malaysian alcohol duty is per litre and excise is per litre of pure alcohol, and SST is charged on top of both. LandedMY follows that order exactly.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["01", "Pick the route", "Any origin port in the world to nine Malaysian ports. Pallet or container, reefer or dry. Live Bank Negara exchange rate."],
              ["02", "Add products", "Search the library, or photograph the supplier invoice and let the reader fill the lines. Customs codes are suggested, you confirm."],
              ["03", "See every ringgit", "Duty, excise, SST, freight, port and clearance per bottle, case, pallet and shipment. Check a forwarder quote. Reverse it to a maximum supplier price."],
            ].map(([n, h, t]) => (
              <Card key={n} className="flex flex-col gap-2.5 p-6">
                <span className="font-mono text-xs font-semibold text-teal">{n}</span>
                <h3 className="font-display text-xl font-semibold">{h}</h3>
                <p className="text-sm leading-relaxed text-muted">{t}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-[1120px] px-6 pb-[72px] pt-10">
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="flex flex-col gap-3.5 p-7">
              <h3 className="font-display text-[22px] font-semibold">Built for importers, not accountants</h3>
              <ul className="list-disc pl-[18px] text-[15px] leading-[1.7] text-ink-2">
                <li>Margin check against your shelf price</li>
                <li>Three saved scenarios side by side</li>
                <li>Branded PDF quote for your customers</li>
                <li>Compliance checklist with the right authority for each product</li>
                <li>Rate-change alerts on saved shipments</li>
              </ul>
            </Card>
            <div className="flex flex-col gap-3.5 rounded-2xl bg-teal p-7 text-white">
              <h3 className="font-display text-[22px] font-semibold">Where the numbers come from</h3>
              <p className="text-[15px] leading-relaxed text-[#D6E6E4]">
                Customs Duties Order 2022, Excise Duties Order 2022 with the Budget 2026 increase from 1 November 2025, Sales Tax Act 2018. Every result shows the rate it used and links to the source. If a rate isn&apos;t in the database, the app says so instead of guessing.
              </p>
              <Link href="/guides/import-wine-malaysia-cost/#sources" className="text-sm font-semibold text-white">See the sources →</Link>
            </div>
          </div>
        </section>

        {/* Guides */}
        <section id="guides" className="border-y border-line-2 bg-white">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-6 py-16">
            <h2 className="font-display text-[32px] font-bold tracking-tight">Guides</h2>
            <div className="grid gap-5 md:grid-cols-3">
              <Link href="/guides/import-wine-malaysia-cost/" className="flex flex-col gap-2 rounded-2xl border border-line-2 bg-ground p-6 text-ink no-underline hover:border-teal">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">Wine · 2026</span>
                <span className="font-display text-xl font-semibold leading-tight">How much does it cost to import wine into Malaysia?</span>
                <span className="text-sm text-muted">A €5 bottle lands at {rm2(pu.landed)}. Here is every line of that number.</span>
              </Link>
              <Link href="/guides/beer-import-duty-excise-malaysia/" className="flex flex-col gap-2 rounded-2xl border border-line-2 bg-ground p-6 text-ink no-underline hover:border-teal">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">Beer · 2026</span>
                <span className="font-display text-xl font-semibold leading-tight">Beer import duty and excise in Malaysia: a worked example</span>
                <span className="text-sm text-muted">Why a €1 can costs about RM12 landed, and what changes with alcohol strength.</span>
              </Link>
              <Link href="/guides/spirits-import-duty-malaysia/" className="flex flex-col gap-2 rounded-2xl border border-line-2 bg-ground p-6 text-ink no-underline hover:border-teal">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">Spirits · 2026</span>
                <span className="font-display text-xl font-semibold leading-tight">Whisky, gin and spirits: what a bottle really costs</span>
                <span className="text-sm text-muted">A €12 Scotch lands at about RM169, and a cheaper bottle barely changes that.</span>
              </Link>
            </div>
          </div>
        </section>

        {/* API + install */}
        <section className="mx-auto max-w-[1120px] px-6 py-16">
          <div className="grid gap-5 md:grid-cols-2">
            <div id="api" className="flex flex-col gap-3">
              <h2 className="font-display text-[28px] font-bold tracking-tight">For forwarders and developers</h2>
              <p className="text-[15px] leading-relaxed text-muted">The same engine over a public API. POST a shipment, get the priced result with every rate&apos;s source. Free during beta.</p>
              <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[13px] leading-relaxed text-[#D6E6E4]">{`GET  /api/calc        → schema
POST /api/calc
{ "origin_iso": "BE", "dest_port": "MYPKG",
  "currency": "EUR", "lines": [ … ] }`}</pre>
            </div>
            <Card id="install" className="flex flex-col justify-center gap-3 p-7">
              <h2 className="font-display text-[28px] font-bold tracking-tight">Works like an app</h2>
              <p className="text-[15px] leading-relaxed text-muted">Open on your phone, choose &ldquo;Add to Home Screen&rdquo;. It loads offline and keeps your last shipment.</p>
              <Btn href={CALC} className="self-start">Open calculator</Btn>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
