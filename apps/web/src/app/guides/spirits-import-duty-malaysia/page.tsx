import type { Metadata } from "next";
import { Article, CtaCard, Figure, H2, Note, Table, shareOf } from "@/components/site/Site";
import { SPIRITS_BASE, SPIRITS_VARIANTS, priceExample, rm2 } from "@/lib/examples";

const URL = "https://landedmy.netlify.app/guides/spirits-import-duty-malaysia/";

export const metadata: Metadata = {
  title: "Whisky, gin and spirits import duty in Malaysia: what a bottle really costs (2026) — LandedMY",
  description:
    "Malaysia charges RM58 per litre import duty on whisky and brandy, RM55 on gin, rum and vodka, plus RM165 excise per litre of pure alcohol and 10% SST on top. A €12 bottle of Scotch lands at about RM169. The full arithmetic, with 2026 rates.",
  alternates: { canonical: URL },
  openGraph: { title: "Spirits import duty in Malaysia: what a bottle of whisky really costs", description: "Duty, excise and SST on a €12 Scotch, line by line, with 2026 rates.", url: URL, type: "article" },
};

export default function SpiritsGuide() {
  const base = priceExample(SPIRITS_BASE);
  const b = base.per_unit;
  const rows = SPIRITS_VARIANTS.map((v) => {
    const r = priceExample(v.input).per_unit;
    return { label: v.label, duty: r.duty, excise: r.excise, landed: r.landed };
  });
  const tax = b.duty + b.excise + b.sst;
  const cheap = rows[0];
  const liqueur = rows[3];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Whisky, gin and spirits import duty in Malaysia: what a bottle really costs",
    datePublished: "2026-11-02",
    dateModified: "2026-11-02",
    author: { "@type": "Organization", name: "LandedMY" },
    mainEntityOfPage: URL,
  };

  return (
    <Article
      kicker="Guide · Spirits"
      date="Updated November 2026"
      readTime="6 min read"
      title="Whisky, gin and spirits import duty in Malaysia: what a bottle really costs"
      lede={`A €12 bottle of Scotch lands in Port Klang at ${rm2(b.landed)}. Around ${Math.round((tax / b.landed) * 100)}% of that is tax, and the tax is almost the same whether the bottle cost €8 or €40. Here is where every ringgit goes.`}
      next={{ href: "/guides/import-wine-malaysia-cost/", label: "Also read: how much does it cost to import wine?" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Figure meta="Scotch whisky 40% · 700 ml · €12.00 EXW · 100 cases of 6 · 1 pallet · Antwerp → Port Klang · EUR 5.00" value={rm2(b.landed)} unit="landed, per bottle" shares={shareOf(b)} />

      <H2>Spirits pay the highest specific duty in the tariff</H2>
      <p>
        Wine pays RM7 per litre of import duty and beer RM5. Whisky and brandy (HS 2208.20 and 2208.30) pay <strong>RM58 per litre</strong>; gin, rum and vodka (2208.40 to 2208.60) pay <strong>RM55</strong>. On top of that comes the same excise as wine, RM165 per litre of pure alcohol, and a 40% spirit has three times the alcohol of a 13% wine. Then SST at 10% on everything.
      </p>

      <H2>The example, step by step</H2>
      <Table
        head={["Step", "How it is calculated", { label: "Per 700 ml bottle", num: true }]}
        rows={[
          ["Goods", "€12.00 × RM5.00", rm2(b.goods)],
          ["Freight + insurance", "One pallet LCL, shared by 600 bottles", rm2(b.freight_insurance)],
          [<strong key="c">CIF value</strong>, "", <strong key="cv">{rm2(b.cif)}</strong>],
          ["Import duty", "0.7 L × RM58 per litre (HS 2208.30.90)", rm2(b.duty)],
          ["Excise duty", "0.7 L × 40% alc. × RM165 per litre of pure alcohol", rm2(b.excise)],
          ["Sales tax (SST)", "10% × (CIF + duty + excise)", rm2(b.sst)],
          ["Port, agent, haulage", "About RM1,800 per pallet, shared", rm2(b.local_charges)],
          [<strong key="l">Landed cost</strong>, "", <strong key="lv">{rm2(b.landed)}</strong>],
        ]}
      />
      <Note>
        Tax: {rm2(tax)} on a bottle that cost {rm2(b.goods)} at the distillery. Drop the price to €8 and the landed cost only falls to {rm2(cheap.landed)}, because the duty and excise do not move at all.
      </Note>

      <H2>Why price matters less than strength and size</H2>
      <p>
        Both duties are measured in litres, not ringgit. A cheaper bottle saves you the price difference plus 10% SST on it, and nothing more. A stronger or bigger bottle costs more in duty and excise whatever it cost you. The comparison below keeps everything else from the example the same.
      </p>
      <Table
        head={["Change", { label: "Duty", num: true }, { label: "Excise", num: true }, { label: "Landed per bottle", num: true }]}
        rows={[["Base: Scotch 40%, 700 ml, €12", rm2(b.duty), rm2(b.excise), rm2(b.landed)], ...rows.map((r) => [r.label, rm2(r.duty), rm2(r.excise), rm2(r.landed)])]}
      />

      <H2>Liqueurs are taxed differently</H2>
      <p>
        Liqueurs and cordials (HS 2208.70) and &ldquo;other spirituous beverages&rdquo; (2208.90) have their import duty set per litre of pure alcohol rather than per litre of liquid, RM93.50 for liqueurs up to 57%, and a lower excise of RM66 per litre of alcohol. A 20% liqueur in the example lands at {rm2(liqueur.landed)}: the low strength keeps both taxes down. This is why a 20% cream liqueur can retail for less than a 40% gin that cost the same to buy.
      </p>

      <H2>Classification traps</H2>
      <ul className="list-disc pl-5 text-[17px] leading-[1.65]">
        <li>Whisky and brandy are RM58/L; gin, rum, vodka RM55/L. A &ldquo;grain spirit&rdquo; or &ldquo;spirit drink&rdquo; that doesn&apos;t fit a named heading falls to 2208.90 and is taxed per litre of alcohol.</li>
        <li>Containers above 5 litres have their own lines (2208.30.10 for whisky) at the same rate; the split matters for the K1, not the bill.</li>
        <li>Duty is on actual alcohol content. Declare the ABV on the label; Customs can test it.</li>
        <li>Sample bottles and miniatures pay the same per-litre rates. There is no low-value relief for alcohol.</li>
      </ul>

      <H2>Before you order</H2>
      <p>Spirits need the same paperwork as wine: a Customs import licence for intoxicating liquor, excise tax stamps on every bottle, a liquor licence for wholesale or retail, and labelling under the Food Regulations 1985. The calculator lists each with a link to the authority.</p>

      <CtaCard title="Price a spirits list" body="Add each bottle with its size, ABV and price. The result shows duty, excise, SST and logistics per bottle and per case, and the reverse calculator tells you the most you can pay a supplier for a target shelf price." label="Open the calculator" />

      <H2 id="sources">Sources</H2>
      <ul className="list-disc pl-5 text-[15px] leading-[1.7] text-ink-2">
        <li>
          <a href="https://ezhs.customs.gov.my/" rel="noopener">Customs Duties Order 2022, P.U.(A) 114/2022</a>, heading 2208
        </li>
        <li><a href="https://www.customs.gov.my/images/06-prosedur/eksais/perintah/PUA389_2025.pdf" rel="noopener">Excise Duties Order 2025, P.U.(A) 389/2025</a>, in force 1 November 2025 (replacing P.U.(A) 163/2022)</li>
        <li>Sales Tax Act 2018, 10% standard rate on imports</li>
      </ul>
      <p className="text-sm text-muted">Estimates for planning. The final assessment is made by the Royal Malaysian Customs Department at the time of import.</p>
    </Article>
  );
}
