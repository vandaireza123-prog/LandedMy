import type { Metadata } from "next";
import Link from "next/link";
import { Btn, CALC, Card, SiteFooter, SiteNav } from "@/components/site/Site";
import { ShareRedirect } from "@/components/site/ShareRedirect";
import { HeroSearch } from "@/components/site/HeroSearch";
import { WINE_BASE, priceExample, rm2 } from "@/lib/examples";
import { DEST_COUNTRIES, dutyCoverage } from "@/lib/country";
import { MODES } from "@/lib/lanes";

const N_DEST = DEST_COUNTRIES.length;
const N_DUTY = DEST_COUNTRIES.filter((c) => dutyCoverage(c).kind !== "none").length;
const N_MODES = Object.keys(MODES).length;

export const metadata: Metadata = {
  title: "Costavora — free landed cost calculator: duty, tax and freight for any product, any country",
  description: `Import duty, tax, excise, freight and port charges for any product shipped into ${N_DEST} countries. Free, no login, and every rate shows its source and whether it is exact or an estimate.`,
  alternates: { canonical: "https://costavora.com/" },
  openGraph: { title: "Costavora — the landed cost of anything, anywhere", description: `Duty, tax, freight and port charges for any product into ${N_DEST} countries. Free.`, url: "https://costavora.com/", type: "website", siteName: "Costavora", images: [{ url: "/og.png", width: 1200, height: 630 }] },
};

export default function Landing() {
  const w = priceExample(WINE_BASE);
  const pu = w.per_unit;

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <ShareRedirect />
      <SiteNav />
      <main className="flex-1">
        {/* Hero */}
        <section id="top" className="mx-auto max-w-[1120px] px-6 pb-10 pt-12 text-center md:pt-16">
          <span className="inline-flex rounded-full bg-teal-tint px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-teal">Free · {N_DEST} countries · every product</span>
          <h1 className="mx-auto mb-4 mt-5 max-w-[860px] font-display text-[44px] font-bold leading-[1.02] tracking-[-0.04em] md:text-[68px]">
            The landed cost of <span className="text-teal">anything</span>, anywhere.
          </h1>
          <p className="mx-auto max-w-[700px] text-lg leading-relaxed text-muted md:text-[19px]">
            Duty, tax, excise, freight and port charges for any product shipped into any country. Every rate shows its source, and says plainly when it is only an estimate.
          </p>
          <HeroSearch />
          <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[13.5px] text-muted">
            <span>No login</span>
            <span>9 languages</span>
            <span>Official tariffs updated weekly</span>
            <span>Free API</span>
          </div>
        </section>

        {/* Coverage */}
        <section id="coverage" className="mx-auto max-w-[1120px] px-6">
          <div className="grid gap-6 border-t border-line py-8 sm:grid-cols-2 md:grid-cols-4">
            {[
              [String(N_DEST), "destination countries and territories"],
              [String(N_DUTY), "with the duty rate filled in for you"],
              [String(N_MODES), "ways to ship, from courier to ISO tank"],
              ["Weekly", "official schedules: US, UK, EU, Brazil, China and more"],
            ].map(([n, t]) => (
              <div key={t} className="flex flex-col gap-1">
                <span className="font-display text-[34px] font-bold leading-none tracking-tight tabular-nums">{n}</span>
                <span className="text-sm text-muted">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto flex max-w-[1120px] flex-col gap-7 px-6 pb-6 pt-[72px]">
          <div className="flex max-w-[640px] flex-col gap-2">
            <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight md:text-[36px]">The tax stack, done the way customs does it</h2>
            <p className="leading-relaxed text-muted">
              Most online calculators apply one flat percentage. Real tariffs are per litre, per kilo or per litre of alcohol, with excise and VAT or sales tax charged on top in a set order. Costavora follows that order for each country.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-4">
            {[
              ["01", "Add your products", "Type a product, part name or HS code, or photograph the supplier invoice. As many lines as the shipment has, each in its own unit."],
              ["02", "Pick the route and mode", `Any origin to ${N_DEST} destinations, by any of ${N_MODES} modes: courier, air, LCL, every container type, truck, rail, ro-ro, ISO tank.`],
              ["03", "Freight and charges", "Typical freight and port charges for the mode, or your forwarder's own quote."],
              ["04", "See every cost", "Duty, excise, tax, freight and local charges per unit and per shipment, with the source of each rate. PDF quote, share link, margin check."],
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
                <li>Aircraft and helicopter parts catalogue, down to the screw</li>
                <li>Rate-change alerts on saved shipments</li>
              </ul>
            </Card>
            <div className="flex flex-col gap-3.5 rounded-2xl bg-teal p-7 text-white">
              <h3 className="font-display text-[22px] font-semibold">Where the numbers come from</h3>
              <p className="text-[15px] leading-relaxed text-[#D6E6E4]">
                Official national tariff schedules where they are published (US HTS, UK Trade Tariff, EU TARIC, Brazil TEC, China, Thailand, Vietnam, Malaysia), refreshed every week; WTO/UNCTAD MFN averages elsewhere, marked as indicative. Every result shows the rate it used and links to the source. If a rate isn&apos;t known, the app says so instead of guessing.
              </p>
              <Link href="/guides/import-wine-malaysia-cost/#sources" className="text-sm font-semibold text-white">See the sources →</Link>
            </div>
          </div>
        </section>

        {/* Guides */}
        <section id="guides" className="border-y border-line-2 bg-white">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-6 py-16">
            <h2 className="font-display text-[32px] font-bold tracking-tight">Guides</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <Link href="/guides/aircraft-helicopter-parts-hs-codes/" className="flex flex-col gap-2 rounded-2xl border border-line-2 bg-ground p-6 text-ink no-underline hover:border-teal">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal">Aerospace · 2026</span>
                <span className="font-display text-xl font-semibold leading-tight">HS codes for aircraft and helicopter parts, down to the screw</span>
                <span className="text-sm text-muted">Every part by aircraft system, and why a screw is 7318 and not an aircraft part.</span>
              </Link>
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
              <p className="text-[15px] leading-relaxed text-muted">The same engine over a public API. POST a shipment, get the priced result with every rate&apos;s source. Free during beta; create a key under Account for the higher limit.</p>
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
