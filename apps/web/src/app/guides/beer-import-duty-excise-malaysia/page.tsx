import type { Metadata } from "next";
import { Article, CtaCard, Figure, H2, Note, Table, shareOf } from "@/components/site/Site";
import { BEER_BASE, BEER_VARIANTS, EXAMPLE_DATE, priceExampleOn, rm2 } from "@/lib/examples";

const URL = "https://landedmy.netlify.app/guides/beer-import-duty-excise-malaysia/";

export const metadata: Metadata = {
  title: "Beer import duty and excise in Malaysia: a worked example (2026) — LandedMY",
  description:
    "Malaysia charges RM5 per litre import duty on beer and RM192.50 per litre of pure alcohol in excise, plus 10% SST on top. A €1 can of lager lands at about RM12. Step-by-step arithmetic, with the 5.8% ABV split, strong ales, kegs and cider.",
  alternates: { canonical: URL },
  openGraph: { title: "Beer import duty and excise in Malaysia: a worked example", description: "Why a €1 can of lager lands at about RM12, line by line, with 2026 rates.", url: URL, type: "article" },
};

export default function BeerGuide() {
  const base = priceExampleOn(BEER_BASE, EXAMPLE_DATE);
  const b = base.per_unit;
  const rows = BEER_VARIANTS.map((v) => {
    const r = priceExampleOn(v.input, v.date ?? EXAMPLE_DATE).per_unit;
    return { label: v.label, duty: r.duty, excise: r.excise, landed: r.landed };
  });
  const ale = rows[0];
  const tax = b.duty + b.excise + b.sst;
  const cheap = priceExampleOn({ ...BEER_BASE, unit_cost: 0.6 }, EXAMPLE_DATE).per_unit;
  const cheapShare = ((cheap.duty + cheap.excise + cheap.sst) / cheap.landed) * 100;
  const keg = priceExampleOn({ ...BEER_BASE, name: "Keg 5%", volume_ml: 30000, units_per_case: 1, cases: 40 }, EXAMPLE_DATE).per_unit;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Beer import duty and excise in Malaysia: a worked example",
    datePublished: "2026-11-02",
    dateModified: "2026-11-02",
    author: { "@type": "Organization", name: "LandedMY" },
    mainEntityOfPage: URL,
  };

  return (
    <Article
      kicker="Guide · Beer"
      date="Updated November 2026"
      readTime="6 min read"
      title="Beer import duty and excise in Malaysia: a worked example"
      lede={`A €1 can of lager lands at ${rm2(b.landed)}. Half of it is tax, and most of that tax depends on alcohol strength rather than price. Here is the arithmetic Customs uses, line by line.`}
      next={{ href: "/guides/spirits-import-duty-malaysia/", label: "Next: whisky, gin and spirits, what a bottle really costs" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Figure meta="Lager 5.0% · 330 ml can · €1.00 EXW · 1 pallet · Antwerp → Port Klang · EUR 5.00" value={rm2(b.landed)} unit="landed, per can" shares={shareOf(b)} />

      <H2>The two rates every beer importer should memorise</H2>
      <div className="rounded-xl bg-ink px-5 py-4 font-mono text-[14px] leading-[1.8] text-[#D6E6E4] md:text-[15px]">
        <div>Import duty = litres × <strong className="text-white">RM5.00</strong></div>
        <div>Excise = litres × ABV × <strong className="text-white">RM192.50</strong> (per litre of pure alcohol, since 1 Nov 2025)</div>
        <div>SST = 10% × (CIF + duty + excise)</div>
      </div>
      <p>Beer, ale, stout and porter (HS 2203) all pay RM5 per litre import duty whatever their strength or price. The excise is where strength bites: RM192.50 for every litre of pure alcohol in the shipment, up from RM175 before Budget 2026.</p>

      <H2>The example, step by step</H2>
      <Table
        head={["Step", "How it is calculated", { label: "Per 330 ml can", num: true }]}
        rows={[
          ["Goods", "€1.00 × RM5.00", rm2(b.goods)],
          ["Freight + insurance", "One pallet LCL, shared by about 4,000 cans", rm2(b.freight_insurance)],
          [<strong key="c">CIF value</strong>, "", <strong key="cv">{rm2(b.cif)}</strong>],
          ["Import duty", "0.33 L × RM5", rm2(b.duty)],
          ["Excise duty", "0.33 L × 5.0% × RM192.50", rm2(b.excise)],
          ["Sales tax (SST)", `10% × (${b.cif.toFixed(2)} + ${b.duty.toFixed(2)} + ${b.excise.toFixed(2)})`, rm2(b.sst)],
          ["Port, agent, haulage", "About RM1,600 per pallet, shared", rm2(b.local_charges)],
          [<strong key="l">Landed cost</strong>, "", <strong key="lv">{rm2(b.landed)}</strong>],
        ]}
      />
      <Note>
        Tax share {Math.round((tax / b.landed) * 100)}%: {rm2(tax)} of every {rm2(b.landed)} goes to Customs. On a €0.60 supermarket lager the share reaches {Math.round(cheapShare)}%.
      </Note>

      <H2>Why a Belgian strong ale costs so much more to land</H2>
      <p>
        Move from a 5% lager to an 8% abbey ale and the duty does not change, but the excise jumps from {rm2(b.excise)} to {rm2(ale.excise)} a can. Add a higher supplier price and SST on all of it, and the same can lands at {rm2(ale.landed)}.
      </p>
      <Table
        head={["Beer", { label: "Duty", num: true }, { label: "Excise", num: true }, { label: "Landed per can", num: true }]}
        rows={[["Lager 5.0%, €1.00", rm2(b.duty), rm2(b.excise), rm2(b.landed)], ...rows.map((r) => [r.label, rm2(r.duty), rm2(r.excise), rm2(r.landed)])]}
      />

      <H2>The 5.8% line</H2>
      <p>
        The tariff splits beer at 5.8% ABV: HS 2203.00.91 for beer not exceeding 5.8% and 2203.00.99 above it (stout and porter have their own pair). Both sides currently pay the same RM5 per litre and the same excise rate, so the split changes your declaration, not your cost. It matters for classification on the K1, and the calculator picks the right code from the ABV you enter.
      </p>

      <H2>Cans, bottles and kegs</H2>
      <p>
        The duty is on litres, so pack size changes nothing per litre. A 30-litre keg at 5% pays {rm2(keg.duty)} duty and {rm2(keg.excise)} excise, exactly 91 cans&apos; worth. Where kegs win is logistics: more beer per pallet position, so the freight and port charge per litre falls.
      </p>

      <H2>Before you order</H2>
      <p>Alcohol imports need a Customs import licence, excise tax stamps and labelling that meets the Food Regulations 1985. Halal-certified warehouses require separate storage. The calculator&apos;s &ldquo;Before you ship&rdquo; list links each item to its authority.</p>

      <CtaCard title="Price your own beer list" body="Add every SKU with its ABV and supplier price. The result shows duty, excise, SST and logistics per can, per case and per pallet, and lets you compare a pallet against a container." label="Open the calculator" />

      <H2 id="sources">Sources</H2>
      <ul className="list-disc pl-5 text-[15px] leading-[1.7] text-ink-2">
        <li>
          <a href="https://ezhs.customs.gov.my/" rel="noopener">Customs Duties Order 2022, P.U.(A) 114/2022</a>, headings 2203 and 2206
        </li>
        <li>Excise Duties Order 2022, P.U.(A) 163/2022, and the Budget 2026 alcohol excise increase effective 1 November 2025</li>
        <li>Sales Tax Act 2018, 10% standard rate on imports</li>
      </ul>
      <p className="text-sm text-muted">Estimates for planning. The final assessment is made by the Royal Malaysian Customs Department at the time of import.</p>
    </Article>
  );
}
