/**
 * Bundled world duty maps (netlify/data/world/*.json) built by scripts/load/build-world.mjs from open datasets.
 * lookup(dest, hs, origin) → best known MFN/preferential duty with provenance, or null.
 */
import US from "../data/world/US.json";
import EU from "../data/world/EU.json";
import TH from "../data/world/TH.json";

export const EU27 = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

export interface WorldHit {
  hs_code: string;
  hs_level: number;
  origin: string;
  rate_type: "ad_valorem" | "specific" | "compound" | "range";
  value: number | null;
  value_max?: number | null;
  text: string;
  description?: string;
  source_id: string;
  source_name: string;
  source_url: string;
  as_of: string;
  tier: "official" | "indicative";
  note?: string;
  additional?: { heading: string; pct: number | null; text: string; scope: string }[];
}

type UsLine = { d: string; g: number | null; gt: string; s?: string; c2?: string };
type EuEntry = { lo: number | null; hi: number | null; lot?: string; hit?: string; ad?: 1 };
type ThLine = { d: string; g: number | null; gt: string; src: string };

function usSpecial(s: string | undefined, origin: string): { text: string } | null {
  if (!s || origin === "MFN") return null;
  // "Free (A+,AU,BH,...) 2.8¢/liter (JO)" → find the group containing the origin code
  const re = /([^()]+?)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) if (m[2].split(",").map((x) => x.trim()).includes(origin)) return { text: m[1].trim() };
  return null;
}

export function lookup(dest: string, hsDigits: string, origin = "MFN"): WorldHit | null {
  const hs = hsDigits.replace(/\D/g, "");
  if (dest === "US") {
    const lines = US.lines as Record<string, UsLine>;
    // longest matching 8-digit line under the HS-6 (prefer exact 8, else first line under the 6)
    const code = lines[hs.slice(0, 8)] ? hs.slice(0, 8) : Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 6)));
    if (!code) return null;
    const l = lines[code];
    const sp = usSpecial(l.s, origin);
    const meta = US._meta;
    const add = (US.additional as WorldHit["additional"])!.filter((a) => a.scope.toLowerCase().includes("product of") && a.scope.toLowerCase().includes(originName(origin)));
    return {
      hs_code: code, hs_level: 8, origin: sp ? origin : "MFN",
      rate_type: sp ? (/^free$/i.test(sp.text) ? "ad_valorem" : /%$/.test(sp.text) ? "ad_valorem" : "specific") : l.g != null ? "ad_valorem" : /\+/.test(l.gt) ? "compound" : "specific",
      value: sp ? (/^free$/i.test(sp.text) ? 0 : Number((sp.text.match(/^(\d+(?:\.\d+)?)%$/) ?? [])[1] ?? NaN) || null) : l.g,
      text: sp ? `${sp.text} (preferential for ${origin})` : l.gt, description: l.d,
      source_id: "us-hts", source_name: `USITC HTS ${meta.revision}`, source_url: meta.url, as_of: meta.as_of, tier: "official",
      note: "General (column 1) rate. Origin-based additional duties under chapter 99 are listed separately and are NOT in the rate.",
      additional: add.length ? add : undefined,
    };
  }
  if (dest === "EU" || EU27.includes(dest)) {
    const e = (EU.lines as Record<string, Record<string, EuEntry>>)[hs.slice(0, 6)];
    if (!e) return null;
    const pref = e[origin];
    const use = pref ?? e.MFN;
    if (!use) return null;
    const meta = EU._meta;
    const range = use.lo != null && use.hi != null && use.lo !== use.hi;
    return {
      hs_code: hs.slice(0, 6), hs_level: 6, origin: pref ? origin : "MFN",
      rate_type: use.lo == null ? (use.lot?.includes("+") ? "compound" : "specific") : range ? "range" : "ad_valorem",
      value: use.lo, value_max: use.hi, text: use.lo == null ? `${use.lot}${use.hit && use.hit !== use.lot ? ` to ${use.hit}` : ""}` : range ? `${use.lo}% to ${use.hi}% depending on the 8-digit line` : `${use.lo}%`,
      source_id: "eu-taric", source_name: "EU Common Customs Tariff / TARIC", source_url: meta.url, as_of: meta.as_of, tier: "official",
      note: (use.ad ? "Anti-dumping or countervailing duty may apply to this origin. " : "") + (range ? "Pick the exact CN line on TARIC to narrow the range." : ""),
    };
  }
  if (dest === "TH") {
    const lines = TH.lines as Record<string, ThLine>;
    const code = lines[hs.slice(0, 8)] ? hs.slice(0, 8) : Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 6)));
    if (!code) return null;
    const l = lines[code];
    const meta = TH._meta;
    return { hs_code: code, hs_level: 8, origin: "MFN", rate_type: l.g != null ? "ad_valorem" : "specific", value: l.g, text: l.gt, description: l.d, source_id: "th-itd", source_name: `Thai Customs tariff (${l.src})`, source_url: meta.url, as_of: meta.as_of, tier: "official", note: meta.note };
  }
  return null;
}

const NAMES: Record<string, string> = { CN: "china", MY: "malaysia", TH: "thailand", VN: "vietnam", ID: "indonesia", IN: "india", JP: "japan", KR: "korea", TW: "taiwan", DE: "germany", FR: "france", IT: "italy", GB: "united kingdom", BE: "belgium", NL: "netherlands", ES: "spain", MX: "mexico", CA: "canada", BR: "brazil", AU: "australia", SG: "singapore", PH: "philippines", KH: "cambodia", BD: "bangladesh", PK: "pakistan", LK: "sri lanka", ZA: "south africa", TR: "türkiye", CH: "switzerland", AE: "united arab emirates", SA: "saudi arabia", IL: "israel", EG: "egypt", NG: "nigeria", AR: "argentina", CL: "chile", CO: "colombia", PE: "peru", NZ: "new zealand", NO: "norway" };
function originName(iso: string): string {
  return NAMES[iso] ?? "\u0000";
}
