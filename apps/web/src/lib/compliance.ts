/**
 * "Before you ship" checklist by product type. Requirements are shown, never charged.
 * Links go to the authority's own portal. Items are deliberately short; the detail lives on the linked page.
 */
import type { Category } from "./products";

export interface Requirement {
  id: string;
  text: string;
  authority: string;
  url: string;
  /** Applies when any line matches. */
  when: (ctx: { categories: Set<Category>; hsPrefixes: Set<string>; groups: Set<string> }) => boolean;
}

const has = (s: Set<string>, ...pre: string[]) => Array.from(s).some((x) => pre.some((p) => x.startsWith(p)));

export const REQUIREMENTS: Requirement[] = [
  // Everyone
  { id: "k1", text: "K1 import declaration lodged by a licensed customs agent (uCustoms / SMK)", authority: "RMCD", url: "https://www.customs.gov.my/", when: () => true },
  { id: "ssm", text: "Importer registered with SSM and an SST registration if taxable sales exceed RM500,000/year", authority: "SSM / RMCD", url: "https://mysst.customs.gov.my/", when: () => true },
  { id: "coo", text: "Certificate of origin if claiming an FTA rate (ATIGA, MAFTA, MNZFTA, RCEP)", authority: "Origin country chamber", url: "https://fta.miti.gov.my/", when: () => true },

  // Alcohol (chapter 22, excisable)
  {
    id: "liquor-licence",
    text: "Import licence for intoxicating liquor under the Customs (Prohibition of Imports) Order 2023",
    authority: "RMCD",
    url: "https://www.customs.gov.my/en/pg/pg_pr/pr_import",
    when: (c) => has(c.hsPrefixes, "2203", "2204", "2205", "2206", "2208"),
  },
  {
    id: "tax-stamp",
    text: "Customs tax stamps on every bottle before release (duty-paid liquor)",
    authority: "RMCD",
    url: "https://myexcise.customs.gov.my/",
    when: (c) => has(c.hsPrefixes, "2203", "2204", "2205", "2206", "2208"),
  },
  {
    id: "food-label-alc",
    text: "Labels meet Food Regulations 1985 (alcoholic beverage standards amended, effective 1 Apr 2026): ABV, volume, importer name and address in BM/English",
    authority: "MOH Food Safety (FSQ)",
    url: "https://hq.moh.gov.my/fsq/",
    when: (c) => has(c.hsPrefixes, "2203", "2204", "2205", "2206", "2208"),
  },
  {
    id: "halal-sep",
    text: "Keep alcohol physically separated from halal goods in storage and transport",
    authority: "JAKIM (halal assurance)",
    url: "https://www.halal.gov.my/",
    when: (c) => has(c.hsPrefixes, "2203", "2204", "2205", "2206", "2208") && c.categories.has("general"),
  },

  // Food (chapters 02–21 and non-alcoholic 22.02)
  {
    id: "maqis",
    text: "MAQIS import permit and inspection at entry for food, meat, dairy, plants (apply via ePermit / FoSIM)",
    authority: "MAQIS / MOH",
    url: "https://www.maqis.gov.my/",
    when: (c) => c.groups.has("food"),
  },
  {
    id: "fosim",
    text: "Register the consignment on FoSIM (Food Safety Information System) before arrival",
    authority: "MOH FSQ",
    url: "https://fosim.moh.gov.my/",
    when: (c) => c.groups.has("food"),
  },
  {
    id: "halal-food",
    text: "Halal certificate from a JAKIM-recognised body if the product will be sold as halal; meat and dairy need it to clear",
    authority: "JAKIM",
    url: "https://www.halal.gov.my/",
    when: (c) => c.groups.has("food"),
  },
  {
    id: "dvs",
    text: "Veterinary import permit for meat, dairy and animal products (DVS), and approved-establishment status for the plant",
    authority: "DVS",
    url: "https://www.dvs.gov.my/",
    when: (c) => has(c.hsPrefixes, "02", "04", "16"),
  },

  // Cosmetics
  {
    id: "npra",
    text: "Cosmetic product notification on the NPRA Quest system before import or sale (company must be registered on Quest)",
    authority: "NPRA",
    url: "https://www.npra.gov.my/",
    when: (c) => c.groups.has("beauty"),
  },

  // Electrical / electronics
  {
    id: "sirim",
    text: "SIRIM certification and the ST (Energy Commission) Certificate of Approval for regulated electrical goods; SIRIM-ST label on each unit",
    authority: "SIRIM QAS / Suruhanjaya Tenaga",
    url: "https://www.sirim-qas.com.my/",
    when: (c) => c.groups.has("electronics") || has(c.hsPrefixes, "8516", "8508", "8528", "8418"),
  },
  {
    id: "mcmc",
    text: "MCMC type approval for anything with radio/Wi-Fi/Bluetooth (phones, routers, smart devices)",
    authority: "MCMC",
    url: "https://www.mcmc.gov.my/",
    when: (c) => has(c.hsPrefixes, "8517", "8471"),
  },

  // Furniture / wood
  {
    id: "mtib",
    text: "MTIB import licence for timber and wooden furniture; check CITES for protected species",
    authority: "MTIB",
    url: "https://www.mtib.gov.my/",
    when: (c) => c.groups.has("furniture") || has(c.hsPrefixes, "94", "44"),
  },

  // Apparel
  {
    id: "textile-label",
    text: "Fibre content, care and country-of-origin labelling under the Trade Descriptions Act",
    authority: "KPDN",
    url: "https://www.kpdn.gov.my/",
    when: (c) => c.groups.has("apparel"),
  },
];

export function requirementsFor(products: { category: Category; hs_code: string; general_group?: string }[]): Requirement[] {
  const ctx = {
    categories: new Set(products.map((p) => p.category)),
    hsPrefixes: new Set(products.map((p) => (p.hs_code || "").replace(/\./g, ""))),
    groups: new Set(products.filter((p) => p.category === "general").map((p) => p.general_group ?? "other")),
  };
  return REQUIREMENTS.filter((r) => r.when(ctx));
}
