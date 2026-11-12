/**
 * Shipping-mode suggestions from what is in the shipment: total weight, drinks, vehicles, complete aircraft,
 * bulk liquids. Rules of thumb only — the user picks.
 */
import type { Equipment } from "./lanes";
import type { ProductRow } from "./shipment";
import { uomOf } from "./quantity";

export interface ModeSuggestion {
  mode: Equipment;
  why: string;
}

export function suggestModes(products: ProductRow[], kg: number | null): ModeSuggestion[] {
  if (!products.length) return [];
  const ch = (p: ProductRow) => (p.hs6 ?? "").slice(0, 4);
  const aircraft = products.some((p) => ["8801", "8802"].includes(ch(p)));
  const vehicles = products.some((p) => ["8701", "8702", "8703", "8704", "8705", "8711", "8429", "8430"].includes(ch(p)));
  const drinks = products.some((p) => p.category !== "general");
  const wine = products.some((p) => p.category === "still_wine" || p.category === "sparkling");
  const bulkLitres = products.filter((p) => p.category === "general" && uomOf(p) === "litre").reduce((a, p) => a + p.cases, 0);
  const big = products.some((p) => ["8807", "8411", "8429", "8430", "8905"].includes(ch(p)) && (p.weight_per_uom ?? 0) > 1000);

  if (aircraft) return [
    { mode: "ferry", why: "Complete aircraft are usually ferried; helicopters and light aircraft also travel in a 40' HC or on a flat rack with rotors or wings removed." },
    { mode: "40fr", why: "" },
    { mode: "40hc", why: "" },
  ];
  if (vehicles) return [
    { mode: "roro", why: "Vehicles and self-propelled machinery usually go roll-on/roll-off; smaller ones fit a 40' HC." },
    { mode: "40hc", why: "" },
  ];
  if (bulkLitres >= 15000) return [
    { mode: "isotank", why: "An ISO tank holds about 20,000–26,000 litres of non-hazardous liquid." },
    { mode: "20dc", why: "" },
  ];
  if (big) return [
    { mode: "40fr", why: "Heavy or oversize items over a tonne each usually travel on a flat rack or as breakbulk." },
    { mode: "breakbulk", why: "" },
  ];
  if (drinks) return [
    { mode: "pallet", why: wine ? "Wine travels best in a reefer in hot months; a shared container is cheapest for a few pallets." : "Drinks usually move in pallets in a shared container until a full container pays off (~10 pallets)." },
    { mode: wine ? "20rf" : "20dc", why: "" },
  ];
  if (kg == null) return [
    { mode: "air", why: "Add a weight per item on step 1 for a better suggestion." },
    { mode: "pallet", why: "" },
  ];
  if (kg <= 30) return [{ mode: "express", why: "Under about 30 kg, express courier is usually cheapest door to door." }, { mode: "post", why: "" }];
  if (kg <= 500) return [{ mode: "air", why: "Up to about 500 kg, air cargo is quick and often close in price to sea once port charges are added." }, { mode: "pallet", why: "" }];
  if (kg <= 8000) return [{ mode: "pallet", why: "Between about 0.5 and 8 tonnes, a shared container (LCL) is usually cheapest; air if it is urgent." }, { mode: "air", why: "" }];
  if (kg <= 22000) return [{ mode: "20dc", why: "A 20' container takes up to about 22 tonnes or 33 m³." }, { mode: "40hc", why: "" }];
  return [{ mode: "40hc", why: "Over about 22 tonnes, use 40' containers (around 26 tonnes, 76 m³ each) or several 20'." }, { mode: "breakbulk", why: "" }];
}
