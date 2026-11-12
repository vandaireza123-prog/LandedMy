import type { Metadata } from "next";
import { Article, CtaCard, Figure, H2, Note, Table, shareOf } from "@/components/site/Site";
import { WINE_BASE, WINE_VARIANTS, priceExample, rm2 } from "@/lib/examples";

const URL = "https://costavora.com/guides/import-wine-malaysia-cost/";

export const metadata: Metadata = {
  title: "How much does it cost to import wine into Malaysia? (2026 rates) — Costavora",
  description:
    "A €5 bottle of wine lands in Port Klang at about RM58. Import duty RM7/L, excise RM165 per litre of alcohol, SST 10% on top, port charges: every line of the landed cost, with the rates in force since 1 November 2025.",
  alternates: { canonical: URL },
  openGraph: { title: "How much does it cost to import wine into Malaysia?", description: "Every line of the landed cost of a €5 bottle, with 2026 duty, excise and SST rates.", url: URL, type: "article", images: ["/og.png"] },
};

export default function WineGuide() {
  const base = priceExample(WINE_BASE);
  const b = base.per_unit;
  const variants = WINE_VARIANTS.map((v) => ({ label: v.label, landed: priceExample(v.input).per_unit.landed }));
  const tax = b.duty + b.excise + b.sst;
  const abv145 = priceExample({ ...WINE_BASE, abv: 14.5 }).per_unit.excise;
  const abv11 = priceExample({ ...WINE_BASE, abv: 11 }).per_unit.excise;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How much does it cost to import wine into Malaysia?",
    datePublished: "2026-11-02",
    dateModified: "2026-11-02",
    author: { "@type": "Organization", name: "Costavora" },
    mainEntityOfPage: URL,
  };

  return (
    <Article
      kicker="Guide · Wine"
      date="Updated November 2026"
      readTime="7 min read"
      title="How much does it cost to import wine into Malaysia?"
      lede={`A bottle that costs €5 at the winery lands in Port Klang at about ${rm2(b.landed)}. Just under half of that is tax. This guide walks through every line, using the rates in force since 1 November 2025.`}
      next={{ href: "/guides/beer-import-duty-excise-malaysia/", label: "Next: beer duty and excise, a worked example" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Figure meta="Still wine 13% · 750 ml · €5.00 EXW · 60 cases of 12 · 1 pallet · Antwerp → Port Klang · EUR 5.00" value={rm2(b.landed)} unit="landed, per bottle" shares={shareOf(b)} />

      <H2>The four taxes and charges, in the order Customs applies them</H2>
      <p>Malaysia does not tax wine with one percentage. There are two specific duties measured in litres, a sales tax on top of them, and then the port. The order matters because each step is calculated on the result of the one before.</p>

      <Table
        head={["Step", "How it is calculated", { label: "Per bottle", num: true }]}
        rows={[
          ["Goods", "€5.00 × RM5.00", rm2(b.goods)],
          ["Freight + insurance", "One pallet LCL, about RM2,900, shared by 720 bottles", rm2(b.freight_insurance)],
          [<strong key="c">CIF value</strong>, "Goods + freight + insurance", <strong key="cv">{rm2(b.cif)}</strong>],
          ["Import duty", "0.75 L × RM7 per litre (HS 2204.21)", rm2(b.duty)],
          ["Excise duty", "0.75 L × 13% alc. × RM165 per litre of pure alcohol", rm2(b.excise)],
          ["Sales tax (SST)", "10% × (CIF + duty + excise)", rm2(b.sst)],
          ["Port, agent, haulage", "About RM1,800 per pallet, shared", rm2(b.local_charges)],
          [<strong key="l">Landed cost</strong>, "", <strong key="lv">{rm2(b.landed)}</strong>],
        ]}
      />

      <Note>
        Tax share: {rm2(tax)} of {rm2(b.landed)}, or {((tax / b.landed) * 100).toFixed(1)}%. Buy a cheaper wine and the share rises; the excise is the same {rm2(b.excise)} whether the bottle cost €2 or €20.
      </Note>

      <H2>1. Import duty: RM7 per litre, not a percentage</H2>
      <p>
        Under the Customs Duties Order 2022, still wine in bottles (HS 2204.21) carries a specific duty of RM7.00 per litre. A 750 ml bottle pays {rm2(b.duty)} regardless of its price. Sparkling wine (HS 2204.10) pays RM23 per litre. Australian and New Zealand wine may qualify for a preferential rate under MAFTA or MNZFTA with a certificate of origin; without the certificate it pays the full rate, as the K1 declarations we checked show.
      </p>

      <H2>2. Excise: the big one, and it rose on 1 November 2025</H2>
      <p>
        Excise on wine is RM165 per litre of pure alcohol, up from RM150 after the 10% increase announced in Budget 2026. For a 13% bottle that is 0.75 × 0.13 × 165 = {rm2(b.excise)}. A 14.5% wine pays {rm2(abv145)}; an 11% Moscato pays {rm2(abv11)}. This is why alcohol strength matters more than price for cheap wine, and why the calculator asks for ABV on every line.
      </p>

      <H2>3. SST: 10% on everything so far</H2>
      <p>Sales tax is charged at 10% on the CIF value plus the import duty plus the excise. Not on the goods alone. Many spreadsheets get this wrong and under-estimate by two or three ringgit per bottle.</p>

      <H2>4. Port and clearance</H2>
      <p>Port handling, customs agent, documentation and haulage to your warehouse are not taxes but they are real. For a single pallet through Port Klang expect RM1,500 to RM2,200 all in; spread across 720 bottles it is a few ringgit each. A full 20-foot container brings the per-bottle logistics down to under RM1.</p>

      <H2>What changes the number most</H2>
      <Table
        head={["Change", { label: "Landed per bottle", num: true }, { label: "vs. base", num: true }]}
        rows={[
          ["Base: €5, 13%, 1 pallet", rm2(b.landed), "—"],
          ...variants.map((v) => {
            const d = v.landed - b.landed;
            return [v.label, rm2(v.landed), `${d < 0 ? "−" : "+"}${rm2(Math.abs(d))}`];
          }),
        ]}
      />

      <H2>Licences and paperwork you will need</H2>
      <p>
        An import licence for intoxicating liquor from Customs, a wholesale or retail liquor licence from the local council, excise tax stamps on every bottle, and labelling that meets the Food Regulations 1985 (Malay or English, alcohol content, volume, importer&apos;s name). The calculator lists these under &ldquo;Before you ship&rdquo; with a link to each authority.
      </p>

      <CtaCard title="Run your own numbers" body="Enter your wine, your price and your pallet count. The result shows every line above for your shipment, with the gazette each rate came from." label="Open the calculator" />

      <H2 id="sources">Sources</H2>
      <ul className="list-disc pl-5 text-[15px] leading-[1.7] text-ink-2">
        <li>
          <a href="https://ezhs.customs.gov.my/" rel="noopener">Customs Duties Order 2022, P.U.(A) 114/2022</a>, Chapter 22
        </li>
        <li><a href="https://www.customs.gov.my/images/06-prosedur/eksais/perintah/PUA389_2025.pdf" rel="noopener">Excise Duties Order 2025, P.U.(A) 389/2025</a>, in force 1 November 2025 (replacing P.U.(A) 163/2022)</li>
        <li>Sales Tax Act 2018, 10% standard rate on imports</li>
        <li>Two Royal Malaysian Customs K1 declarations (Australian and French still wine, 2026), used to verify the engine line by line</li>
      </ul>
      <p className="text-sm text-muted">Estimates for planning. The final assessment is made by the Royal Malaysian Customs Department at the time of import.</p>
    </Article>
  );
}
