/** Seed product library. Typing a name pre-fills size, ABV and HS code. */
export type Category = "beer" | "still_wine" | "sparkling" | "cider" | "spirits" | "other" | "general";

export interface LibraryProduct {
  name: string;
  category: Category;
  volume_ml: number;
  abv: number;
  hs_code: string;
  units_per_case: number;
  aliases?: string[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  beer: "Beer",
  still_wine: "Still wine",
  sparkling: "Sparkling wine",
  cider: "Cider / perry",
  spirits: "Spirits",
  other: "Other alcohol",
  general: "Not a drink (any other product)",
};

/** Default HS line per category; the engine's rate tables key off these. */
export const CATEGORY_HS: Record<Category, { hs_code: string; label: string }[]> = {
  beer: [
    { hs_code: "2203.00.91", label: "Beer / ale ≤ 5.8%" },
    { hs_code: "2203.00.99", label: "Beer / ale > 5.8%" },
    { hs_code: "2203.00.11", label: "Stout / porter ≤ 5.8%" },
    { hs_code: "2203.00.19", label: "Stout / porter > 5.8%" },
  ],
  still_wine: [
    { hs_code: "2204.21.11", label: "Still wine ≤ 15%, bottle ≤ 2 L" },
    { hs_code: "2204.21.13", label: "Still wine 15–23%, bottle ≤ 2 L" },
    { hs_code: "2204.22.11", label: "Still wine ≤ 15%, 2–10 L" },
    { hs_code: "2205.10.10", label: "Vermouth ≤ 15%" },
  ],
  sparkling: [{ hs_code: "2204.10.00", label: "Sparkling wine" }],
  cider: [
    { hs_code: "2206.00.10", label: "Cider and perry" },
    { hs_code: "2206.00.50", label: "Mead" },
    { hs_code: "2206.00.60", label: "Fruit wine (non-grape)" },
  ],
  spirits: [
    { hs_code: "2208.30.90", label: "Whisky" },
    { hs_code: "2208.20.50", label: "Brandy / cognac" },
    { hs_code: "2208.50.00", label: "Gin" },
    { hs_code: "2208.60.00", label: "Vodka" },
    { hs_code: "2208.40.00", label: "Rum" },
    { hs_code: "2208.70.10", label: "Liqueur ≤ 57%" },
  ],
  other: [{ hs_code: "2208.90.99", label: "Other spirituous beverage" }],
  general: [],
};

export function hsForCategory(c: Category, abv: number): string {
  if (c === "general") return "";
  if (c === "beer") return abv > 5.8 ? "2203.00.99" : "2203.00.91";
  if (c === "still_wine") return abv > 15 ? "2204.21.13" : "2204.21.11";
  return CATEGORY_HS[c][0].hs_code;
}

export const LIBRARY: LibraryProduct[] = [
  { name: "Duvel 330 ml", category: "beer", volume_ml: 330, abv: 8.5, hs_code: "2203.00.99", units_per_case: 24 },
  { name: "La Chouffe 330 ml", category: "beer", volume_ml: 330, abv: 8, hs_code: "2203.00.99", units_per_case: 24, aliases: ["chouffe"] },
  { name: "Floris Fruit Beer 330 ml", category: "beer", volume_ml: 330, abv: 3.6, hs_code: "2203.00.91", units_per_case: 24, aliases: ["floris"] },
  { name: "Belgian Pilsner 330 ml", category: "beer", volume_ml: 330, abv: 5.2, hs_code: "2203.00.91", units_per_case: 24, aliases: ["pils", "lager"] },
  { name: "Belgian Tripel 330 ml", category: "beer", volume_ml: 330, abv: 9, hs_code: "2203.00.99", units_per_case: 24, aliases: ["tripel"] },
  { name: "Keg 20 L lager", category: "beer", volume_ml: 20000, abv: 5, hs_code: "2203.00.91", units_per_case: 1, aliases: ["keg"] },
  { name: "Keg 30 L lager", category: "beer", volume_ml: 30000, abv: 5, hs_code: "2203.00.91", units_per_case: 1, aliases: ["keg"] },
  { name: "Still red wine 750 ml", category: "still_wine", volume_ml: 750, abv: 13.5, hs_code: "2204.21.11", units_per_case: 6, aliases: ["red", "merlot", "shiraz", "cabernet", "pinot noir", "côtes du rhône"] },
  { name: "Still white wine 750 ml", category: "still_wine", volume_ml: 750, abv: 12.5, hs_code: "2204.21.11", units_per_case: 6, aliases: ["white", "sauvignon", "chardonnay", "riesling", "pinot grigio"] },
  { name: "Rosé 750 ml", category: "still_wine", volume_ml: 750, abv: 12.5, hs_code: "2204.21.11", units_per_case: 6, aliases: ["rose", "provence"] },
  { name: "Prosecco 750 ml", category: "sparkling", volume_ml: 750, abv: 11, hs_code: "2204.10.00", units_per_case: 6 },
  { name: "Champagne 750 ml", category: "sparkling", volume_ml: 750, abv: 12, hs_code: "2204.10.00", units_per_case: 6, aliases: ["crémant", "cava", "sparkling"] },
  { name: "Cider 330 ml", category: "cider", volume_ml: 330, abv: 4.5, hs_code: "2206.00.10", units_per_case: 24 },
  { name: "Cider 500 ml", category: "cider", volume_ml: 500, abv: 5, hs_code: "2206.00.10", units_per_case: 12 },
  { name: "Whisky 700 ml", category: "spirits", volume_ml: 700, abv: 40, hs_code: "2208.30.90", units_per_case: 6, aliases: ["scotch", "bourbon"] },
  { name: "Gin 700 ml", category: "spirits", volume_ml: 700, abv: 40, hs_code: "2208.50.00", units_per_case: 6 },
  { name: "Vodka 700 ml", category: "spirits", volume_ml: 700, abv: 40, hs_code: "2208.60.00", units_per_case: 6 },
  { name: "Rum 700 ml", category: "spirits", volume_ml: 700, abv: 40, hs_code: "2208.40.00", units_per_case: 6 },
  { name: "Cognac 700 ml", category: "spirits", volume_ml: 700, abv: 40, hs_code: "2208.20.50", units_per_case: 6, aliases: ["brandy"] },
];

export function searchLibrary(q: string): LibraryProduct[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return LIBRARY.filter(
    (p) => p.name.toLowerCase().includes(s) || (p.aliases ?? []).some((a) => a.includes(s)),
  ).slice(0, 6);
}
