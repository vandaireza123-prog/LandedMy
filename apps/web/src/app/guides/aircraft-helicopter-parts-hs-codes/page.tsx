import type { Metadata } from "next";
import { Article, CtaCard, H2, Note, Table } from "@/components/site/Site";
import catalog from "@/lib/hs/catalogs/aviation.json";

const URL = "https://costavora.com/guides/aircraft-helicopter-parts-hs-codes/";
type Cat = { _meta: { as_of: string; rule: string; duty_note: string; basis: string }; groups: { id: string; name: string; items: { n: string; hs: string; c: string; note?: string }[] }[] };
const cat = catalog as unknown as Cat;
const count = cat.groups.reduce((a, g) => a + g.items.length, 0);
const dot = (hs: string) => `${hs.slice(0, 4)}.${hs.slice(4)}`;

export const metadata: Metadata = {
  title: `HS codes for aircraft and helicopter parts: ${count} parts classified, from rotor blades to screws (2026) — Costavora`,
  description:
    "Every aircraft and helicopter part with its HS code and the customs rule behind it: airframe, rotors, engines, landing gear, hydraulics, avionics, cabin, fasteners, seals and consumables. Why a screw is 7318 and not 8807, and where civil-aircraft parts are duty-free.",
  alternates: { canonical: URL },
  openGraph: { title: "HS codes for aircraft and helicopter parts, down to the screw", description: `${count} parts by aircraft system, with the classification rule for each.`, url: URL, type: "article", images: ["/og.png"] },
};

export default function AviationGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "HS codes for aircraft and helicopter parts, down to the screw",
    datePublished: "2026-11-12",
    dateModified: cat._meta.as_of,
    author: { "@type": "Organization", name: "Costavora" },
    mainEntityOfPage: URL,
  };
  return (
    <Article
      kicker="Guide · Aerospace"
      date="Updated November 2026"
      readTime="12 min read"
      title="HS codes for aircraft and helicopter parts, down to the screw"
      lede={`${count} parts by aircraft system, each with its HS 2022 code and the rule that puts it there. Customs does not give a screw an aircraft code: a screw is 7318 whatever it holds together, and this page shows which parts do and do not count as “parts of aircraft” under heading 8807.`}
      next={{ href: "/calc/", label: "Price a parts shipment to any of 213 countries" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <H2>The one rule that decides everything</H2>
      <p>{cat._meta.rule}</p>
      <Note>
        <strong>Duty.</strong> {cat._meta.duty_note}
      </Note>
      <p className="text-sm text-muted">
        Basis: {cat._meta.basis} Items marked <em>rulings vary</em> are defensible but have been classified differently by different customs administrations; get a binding tariff ruling for anything shipped regularly.
      </p>

      {cat.groups.map((g) => (
        <section key={g.id}>
          <H2 id={g.id}>{g.name}</H2>
          <Table
            head={["Part", { label: "HS code", num: true }, "Notes"]}
            rows={g.items.map((it) => [
              it.n,
              <span key="c" className="font-mono">{dot(it.hs)}</span>,
              <span key="n" className="text-sm text-muted">
                {it.c === "check" ? <em>Rulings vary. </em> : ""}
                {it.note ?? ""}
              </span>,
            ])}
          />
        </section>
      ))}

      <H2>How to use this in the calculator</H2>
      <p>
        Type the part name in the product search (“swashplate”, “Hi-Lok”, “Skydrol”, “landing gear actuator”) and the calculator proposes the code from this catalogue with the note attached, then pre-fills the duty for the destination you chose: the exact national line for the US, UK, EU, Brazil, China, Thailand and Vietnam, and the MFN average elsewhere. Search by code works too.
      </p>
      <CtaCard title="Price a parts shipment" body="Any part, any origin, any of 213 destinations. Duty, tax and port charges per piece and per shipment, with the source of every rate." label="Open the calculator" />
    </Article>
  );
}
