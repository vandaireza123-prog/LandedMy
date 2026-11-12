/**
 * Industry part catalogues: plain part names → HS code, with the classification rule that puts them there.
 * The universal HS search finds "helicopter"; a catalogue finds "swashplate", "Hi-Lok" or "Skydrol" and says why
 * a screw is 7318 and not an aircraft part. Loaded lazily per catalogue.
 */
export interface CatalogItem {
  /** part name as an importer would say it */
  n: string;
  /** HS-6 */
  hs: string;
  aliases?: string[];
  /** high = settled; check = defensible but rulings vary */
  c: "high" | "check";
  note?: string;
  /** How it is usually bought, when not by the piece. */
  u?: "piece" | "set" | "pair" | "box" | "kg" | "litre" | "metre";
}
export interface CatalogGroup {
  id: string;
  name: string;
  items: CatalogItem[];
}
export interface Catalog {
  _meta: { id: string; name: string; as_of: string; basis: string; rule: string; duty_note: string; confidence_legend: Record<string, string> };
  groups: CatalogGroup[];
}
export interface CatalogHit {
  catalog: string;
  group: string;
  item: CatalogItem;
  score: number;
}

export const CATALOGS: Record<string, { name: string; load: () => Promise<Catalog> }> = {
  aviation: { name: "Aircraft and helicopter parts", load: () => import("./catalogs/aviation.json").then((m) => (m.default ?? m) as unknown as Catalog) },
};

const cache = new Map<string, Promise<Catalog>>();
export function loadCatalog(id: string): Promise<Catalog> {
  if (!cache.has(id)) cache.set(id, CATALOGS[id].load());
  return cache.get(id)!;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/+.\- ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 1);

/** Search every catalogue. Exact alias/name phrase > all query words present > most words present. */
export async function searchCatalogs(query: string, limit = 5): Promise<CatalogHit[]> {
  const q = norm(query);
  if (q.length < 3) return [];
  const qw = words(q);
  const out: CatalogHit[] = [];
  for (const id of Object.keys(CATALOGS)) {
    const cat = await loadCatalog(id);
    for (const g of cat.groups) {
      for (const item of g.items) {
        const names = [item.n, ...(item.aliases ?? [])].map(norm);
        let score = 0;
        for (const nm of names) {
          if (nm === q) score = Math.max(score, 100);
          else if (q.includes(nm) && nm.length >= 4) score = Math.max(score, 80 + Math.min(nm.length, 20));
          else if (nm.includes(q)) score = Math.max(score, 60 + Math.min(q.length, 20));
          else {
            const nw = new Set(words(nm));
            const hit = qw.filter((w) => nw.has(w) || [...nw].some((x) => x.startsWith(w) && w.length >= 4)).length;
            if (hit && hit === qw.length) score = Math.max(score, 50 + hit * 5);
            else if (hit >= 2 || (hit === 1 && qw.length === 1)) score = Math.max(score, 20 + hit * 8);
          }
        }
        if (score > 0) out.push({ catalog: cat._meta.name, group: g.name, item, score });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
