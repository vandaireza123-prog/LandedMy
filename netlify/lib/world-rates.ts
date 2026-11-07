/**
 * Bundled world duty maps (netlify/data/world/*.json) built by scripts/load/build-world.mjs from open datasets.
 * lookup(dest, hs, origin) → best known MFN/preferential duty with provenance, or null.
 */
import US from "../data/world/US.json";
import EU from "../data/world/EU.json";
import TH from "../data/world/TH.json";
import CN from "../data/world/CN.json";
import EG from "../data/world/EG.json";
import NP from "../data/world/NP.json";
import VN from "../data/world/VN.json";
import BR from "../data/world/BR.json";
import GB from "../data/world/GB.json";
import EU10 from "../data/world/EU10.json";

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
    // MFN: narrow to the 10-digit TARIC lines under the code the user gave (6, 8 or 10 digits) when we have them
    if (!pref && EU10) {
      const l10 = EU10.lines as Record<string, [string, string | null]>;
      const prefix = hs.slice(0, Math.min(10, hs.length));
      const exact = l10[prefix.padEnd(10, "0")] && prefix.length >= 8 ? [prefix.padEnd(10, "0")] : Object.keys(l10).filter((k) => k.startsWith(prefix));
      if (exact.length) {
        const pct = (x: string | null) => { const m = (x ?? "").match(/^(\d+(?:\.\d+)?)\s*%$/); return m ? Number(m[1]) : null; };
        const vals = exact.map((k) => l10[k][1]);
        const nums = vals.map(pct);
        const allNum = nums.every((n) => n != null);
        const lo = allNum ? Math.min(...(nums as number[])) : null;
        const hi = allNum ? Math.max(...(nums as number[])) : null;
        const one = exact.length === 1;
        const same = new Set(vals).size === 1;
        return {
          hs_code: one ? exact[0] : prefix, hs_level: one ? 10 : prefix.length, origin: "MFN",
          rate_type: same && pct(vals[0]) != null ? "ad_valorem" : same ? (/%/.test(vals[0] ?? "") && /\+/.test(vals[0] ?? "") ? "compound" : "specific") : allNum && lo !== hi ? "range" : "range",
          value: same ? pct(vals[0]) : lo, value_max: same ? undefined : hi,
          text: same ? `${vals[0]}` : allNum ? `${lo}% to ${hi}% across ${exact.length} TARIC lines under ${prefix}` : `${exact.length} TARIC lines under ${prefix} with mixed duties (${[...new Set(vals)].slice(0, 3).join("; ")}${new Set(vals).size > 3 ? "; …" : ""})`,
          description: one ? l10[exact[0]][0] : undefined,
          source_id: "eu-taric", source_name: "EU Common Customs Tariff / TARIC (10-digit)", source_url: `https://www.trade-tariff.service.gov.uk/xi/commodities/${one ? exact[0] : prefix.padEnd(10, "0")}`, as_of: EU10._meta.as_of, tier: "official",
          note: (e.MFN?.ad || use.ad ? "Anti-dumping or countervailing duty may apply to this origin. " : "") + (one ? "" : "Pick the exact TARIC line to narrow it. ") + "EU VAT and excise of the destination member state are applied separately.",
        };
      }
    }
    const range = use.lo != null && use.hi != null && use.lo !== use.hi;
    return {
      hs_code: hs.slice(0, 6), hs_level: 6, origin: pref ? origin : "MFN",
      rate_type: use.lo == null ? (use.lot?.includes("+") ? "compound" : "specific") : range ? "range" : "ad_valorem",
      value: use.lo, value_max: use.hi, text: use.lo == null ? `${use.lot}${use.hit && use.hit !== use.lot ? ` to ${use.hit}` : ""}` : range ? `${use.lo}% to ${use.hi}% depending on the 8-digit line` : `${use.lo}%`,
      source_id: "eu-taric", source_name: "EU Common Customs Tariff / TARIC", source_url: meta.url, as_of: meta.as_of, tier: "official",
      note: (use.ad ? "Anti-dumping or countervailing duty may apply to this origin. " : "") + (range ? "Pick the exact CN line on TARIC to narrow the range." : ""),
    };
  }
  if (dest === "VN") {
    const lines = VN.lines as Record<string, { d: string; g: number | null; gt: string; vat: number | null; sct: number | null; xk: number | null; p?: Record<string, number>; vatnote?: string }>;
    const code = lines[hs.slice(0, 8)] ? hs.slice(0, 8) : Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 6)));
    if (!code) return null;
    const l = lines[code];
    // origin → agreement column (first match wins; certificate of origin required)
    const ASEAN = ["BN", "KH", "ID", "LA", "MM", "MY", "PH", "SG", "TH"];
    const CPTPP = ["AU", "BN", "CA", "CL", "JP", "MY", "MX", "NZ", "PE", "SG", "GB"];
    const EAEU = ["RU", "BY", "KZ", "AM", "KG"];
    const agr = ASEAN.includes(origin) ? "atiga" : origin === "CN" ? "acfta" : origin === "JP" ? "vjepa" : origin === "KR" ? "vkfta" : origin === "AU" || origin === "NZ" ? "aanz" : origin === "IN" ? "aifta" : origin === "CL" ? "vcfta" : EAEU.includes(origin) ? "eaeu" : EU27.includes(origin) ? "evfta" : origin === "GB" ? "ukv" : origin === "HK" ? "ahk" : origin === "IL" ? "vifta" : CPTPP.includes(origin) ? "cptpp" : null;
    const pref = agr && l.p && l.p[agr] != null ? { agr, v: l.p[agr] } : null;
    const meta = VN._meta;
    return {
      hs_code: code, hs_level: 8, origin: pref ? origin : "MFN", rate_type: "ad_valorem", value: pref ? pref.v : l.g,
      text: pref ? `${pref.v}% under ${pref.agr.toUpperCase()} (MFN ${l.gt})` : l.gt, description: l.d,
      source_id: meta.source_id, source_name: `Vietnam tariff schedule (Decree 26/2023 as amended)${l.vat != null ? ` · VAT ${l.vat}%` : ""}${l.sct != null ? ` · special consumption tax ${l.sct}%` : ""}${l.xk != null ? ` · export duty ${l.xk}%` : ""}`,
      source_url: meta.url, as_of: meta.as_of, tier: "official", note: l.vatnote ?? meta.note,
    };
  }
  if (dest === "GB") {
    type GbLine = { d: string; mfn: string | null; mfnac?: Record<string, string>; p?: Record<string, number>; ad?: string[] };
    const lines = GB.lines as unknown as Record<string, GbLine>;
    const lists = GB.lists as string[][];
    const groups = GB.groups as unknown as Record<string, { d: string; m: string[] }>;
    const code = lines[hs.slice(0, 10)] ? hs.slice(0, 10) : Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 8))) ?? Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 6)));
    if (!code) return null;
    const l = lines[code];
    const meta = GB._meta;
    const inGeo = (g: string) => g === origin || (groups[g]?.m.includes(origin) ?? false);
    // preference: a country-specific entry beats a group; a quota-only entry is reported but not applied
    let pref: { expr: string; geo: string; quota: boolean } | null = null;
    if (origin !== "MFN" && l.p) {
      for (const [raw, li] of Object.entries(l.p)) {
        const [exprPart, exPart] = raw.split("|x:");
        const excluded = exPart ? exPart.split(",") : [];
        if (excluded.includes(origin)) continue;
        const quota = exprPart.startsWith("Q:");
        const expr = quota ? exprPart.slice(2) : exprPart;
        const hit = lists[li].includes(origin) ? origin : lists[li].find(inGeo);
        if (!hit) continue;
        const specific = hit === origin;
        if (!pref || (pref.quota && !quota) || (specific && pref.geo !== origin && pref.quota === quota)) pref = { expr, geo: hit, quota };
      }
    }
    const parse = (expr: string | null) => {
      if (expr == null) return { type: "specific" as const, value: null, text: "see tariff" };
      const m = expr.match(/^(\d+(?:\.\d+)?)\s*%$/);
      if (m) return { type: "ad_valorem" as const, value: Number(m[1]), text: expr };
      return { type: /%/.test(expr) && /\+/.test(expr) ? ("compound" as const) : ("specific" as const), value: null, text: expr };
    };
    const use = pref && !pref.quota ? parse(pref.expr) : parse(l.mfn);
    const ad = (l.ad ?? []).some(inGeo);
    const geoName = pref ? (groups[pref.geo]?.d ?? pref.geo) : "";
    return {
      hs_code: code, hs_level: 10, origin: pref && !pref.quota ? origin : "MFN", rate_type: use.type, value: use.value,
      text: pref && !pref.quota ? `${use.text} preferential (${geoName}; UKGT ${l.mfn})` : pref?.quota ? `${l.mfn} (${pref.expr} within tariff quota for ${geoName})` : l.mfn ?? "see tariff",
      description: l.d,
      source_id: meta.source_id, source_name: "UK Global Tariff (Online Trade Tariff)", source_url: `https://www.trade-tariff.service.gov.uk/commodities/${code}`, as_of: meta.as_of, tier: "official",
      note: [meta.note, ad ? `Anti-dumping or countervailing duty applies to ${origin} on this line — check the commodity page.` : "", l.mfnac ? "Additional-code rates exist on this line (e.g. Meursing or anti-dumping codes)." : ""].filter(Boolean).join(" "),
    };
  }
  if (dest === "BR") {
    type Temp = { annex: string; ex: string | number | null; g: number | null; quota: string | null; d: string; from?: string | null; to?: string | null; ato?: string; obs?: string };
    const lines = BR.lines as unknown as Record<string, { d: string; tec: number | null; gt: string; g: number | null; bk?: string; basis?: string; temp?: Temp[] }>;
    const code = lines[hs.slice(0, 8)] ? hs.slice(0, 8) : Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 6)));
    if (!code) return null;
    const l = lines[code];
    const meta = BR._meta;
    const today = new Date().toISOString().slice(0, 10);
    const live = (t: Temp) => (!t.from || t.from <= today) && (!t.to || t.to >= today);
    const temps = (l.temp ?? []).filter(live);
    // A whole-NCM exception (Ex "-") without a quota replaces the rate; Ex-numbered or quota entries are shown as notes.
    const isWhole = (t: Temp) => t.ex == null || String(t.ex).trim() === "-" || String(t.ex).trim() === "";
    const whole = temps.find((t) => isWhole(t) && !t.quota && t.g != null);
    const notes = temps.filter((t) => t !== whole).map((t) => `${t.annex}${!isWhole(t) ? ` Ex ${t.ex}` : ""}: ${t.g}%${t.quota ? ` within quota ${t.quota}` : ""} — ${t.d}${t.to ? ` (until ${t.to})` : ""}`);
    const MERCOSUR = ["AR", "PY", "UY"];
    const intra = MERCOSUR.includes(origin) && !/^(17|87)/.test(code);
    const value = intra ? 0 : whole ? whole.g : l.g;
    return {
      hs_code: code, hs_level: 8, origin: intra ? origin : "MFN", rate_type: "ad_valorem", value,
      text: intra ? `0% intra-Mercosur (ACE-18); TEC ${l.gt}` : whole ? `${whole.g}% (${whole.annex}${whole.to ? ` until ${whole.to}` : ""}; TEC ${l.gt})` : l.g !== l.tec ? `${l.g}% applied (${l.basis}; TEC ${l.gt})` : l.gt,
      description: l.d,
      source_id: meta.source_id, source_name: `Brazil TEC/NCM — Resolução Gecex 272/2021 Anexos I–X${l.bk ? ` · ${l.bk}` : ""}`, source_url: meta.url, as_of: meta.as_of, tier: "official",
      note: [meta.note, ...notes].join(" · "),
    };
  }
  const simple: Record<string, { _meta: { country: string; level: number; source_id: string; as_of: string; url: string; note?: string; licence?: string; tier?: "official" | "indicative" }; lines: Record<string, ThLine & { vat?: number | null; other?: string; saarc?: number }> }> = { TH, CN, EG, NP } as never;
  const s = simple[dest];
  if (s) {
    const lines = s.lines;
    const lvl = s._meta.level;
    const exact = hs.slice(0, lvl);
    const code = lines[exact] ? exact : Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 8))) ?? Object.keys(lines).find((k) => k.startsWith(hs.slice(0, 6)));
    if (!code) return null;
    const l = lines[code];
    const meta = s._meta;
    const names: Record<string, string> = { TH: "Thai Customs tariff", CN: "China Import and Export Tariff 2026", EG: "Egyptian Customs Tariff (Nafeza)", NP: "Nepal Customs Tariff 2026/27" };
    const extra = [l.src ? `(${l.src})` : "", l.vat != null ? `VAT ${l.vat}% on this line` : "", l.other ? `Other charges: ${l.other}` : "", l.saarc != null ? `SAARC rate ${l.saarc}%` : ""].filter(Boolean).join(" · ");
    return { hs_code: code, hs_level: code.length, origin: "MFN", rate_type: l.g != null ? "ad_valorem" : "specific", value: l.g, text: l.gt, description: l.d, source_id: meta.source_id, source_name: `${names[dest]} ${extra}`.trim(), source_url: meta.url, as_of: meta.as_of, tier: meta.tier ?? "official", note: meta.note };
  }
  return null;
}

const NAMES: Record<string, string> = { CN: "china", MY: "malaysia", TH: "thailand", VN: "vietnam", ID: "indonesia", IN: "india", JP: "japan", KR: "korea", TW: "taiwan", DE: "germany", FR: "france", IT: "italy", GB: "united kingdom", BE: "belgium", NL: "netherlands", ES: "spain", MX: "mexico", CA: "canada", BR: "brazil", AU: "australia", SG: "singapore", PH: "philippines", KH: "cambodia", BD: "bangladesh", PK: "pakistan", LK: "sri lanka", ZA: "south africa", TR: "türkiye", CH: "switzerland", AE: "united arab emirates", SA: "saudi arabia", IL: "israel", EG: "egypt", NG: "nigeria", AR: "argentina", CL: "chile", CO: "colombia", PE: "peru", NZ: "new zealand", NO: "norway" };
function originName(iso: string): string {
  return NAMES[iso] ?? "\u0000";
}
