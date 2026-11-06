import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRateTables, computeShipment, RateNotFoundError, type RateTables, type Shipment } from "../src/index.js";

const TOLERANCE = 0.05; // RM per unit, the Sprint 0 gate

interface Fixture {
  name: string;
  shipment: Shipment;
  expect: { per_unit?: Record<string, number>; totals?: Record<string, number> };
}

const fixturesDir = join(__dirname, "..", "fixtures", "shipments");
const fixtures: Fixture[] = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(fixturesDir, f), "utf8")));

const rates: RateTables = buildRateTables();

describe("rate tables", () => {
  it("every HS line has a tariff, an SST rate and two excise versions", () => {
    const codes = new Set(rates.tariff_lines.filter((r) => r.hs_code.startsWith("22") && !r.hs_code.startsWith("2202")).map((r) => r.hs_code));
    for (const hs of codes) {
      expect(rates.sst_rates.filter((r) => r.hs_code === hs)).toHaveLength(1);
      expect(rates.excise_lines.filter((r) => r.hs_code === hs)).toHaveLength(2);
    }
    expect(codes.size).toBeGreaterThanOrEqual(28);
  });

  it("every row carries a source URL and effective date", () => {
    for (const r of [...rates.tariff_lines, ...rates.excise_lines, ...rates.sst_rates]) {
      expect(r.source_url).toMatch(/^https?:\/\//);
      expect(r.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("2025 Order rows equal the gazetted figures (each line is 2022 × 1.10)", () => {
    for (const r of rates.excise_lines.filter((r) => r.effective_from === "2025-11-01")) {
      const v1 = rates.excise_lines.find((x) => x.hs_code === r.hs_code && x.effective_from === "2022-06-01")!;
      expect(r.excise.value).toBe(Math.round(v1.excise.value * 110) / 100);
      expect(r.source_doc).toMatch(/389\/2025/);
    }
  });

  it("beer excise is RM175 before and RM192.50 from 1 Nov 2025", () => {
    const beer = rates.excise_lines.filter((r) => r.hs_code === "2203.00.99");
    expect(beer.find((r) => r.effective_from === "2022-06-01")!.excise.value).toBe(175);
    expect(beer.find((r) => r.effective_from === "2025-11-01")!.excise.value).toBe(192.5);
  });
});

describe("fixtures", () => {
  for (const fx of fixtures) {
    describe(fx.name, () => {
      const result = computeShipment(fx.shipment, rates);

      for (const [k, v] of Object.entries(fx.expect.per_unit ?? {})) {
        it(`per-unit ${k} ≈ ${v}`, () => {
          const got = (result.lines[0].per_unit as Record<string, number>)[k];
          expect(Math.abs(got - v)).toBeLessThanOrEqual(TOLERANCE);
        });
      }
      for (const [k, v] of Object.entries(fx.expect.totals ?? {})) {
        it(`total ${k} ≈ ${v}`, () => {
          const got = (result.totals as Record<string, number>)[k];
          expect(Math.abs(got - v)).toBeLessThanOrEqual(TOLERANCE * result.lines[0].units);
        });
      }

      it("line totals reconcile to shipment inputs", () => {
        const s = fx.shipment;
        const goods = s.lines.reduce((a, l) => a + l.unit_cost * l.units_per_case * l.cases, 0) * s.fx_rate;
        const freight = s.incoterm === "CIF" ? 0 : s.freight * s.fx_rate;
        const local = Object.values(s.local_charges_myr).reduce((a, b) => a + b, 0);
        expect(Math.abs(result.totals.goods - goods)).toBeLessThan(0.05 * s.lines.length);
        expect(Math.abs(result.totals.freight - freight)).toBeLessThan(0.05 * s.lines.length);
        expect(Math.abs(result.totals.local_charges - local)).toBeLessThan(0.05 * s.lines.length);
        for (const l of result.lines) {
          expect(Math.abs(l.cif + l.duty + l.excise + l.sst + l.local_charges - l.landed)).toBeLessThan(0.05);
          expect(Math.abs(l.sst - 0.1 * (l.cif + l.duty + l.excise))).toBeLessThan(0.05);
        }
      });

      it("every line reports the rate it used, with its source", () => {
        for (const l of result.lines) {
          expect(l.rates_used.duty.source_url).toMatch(/^https?:\/\//);
          expect(l.rates_used.sst_pct).toBe(10);
          if (fx.shipment.lines.find((x) => x.id === l.id)!.abv > 0) {
            expect(l.rates_used.excise).not.toBeNull();
          }
        }
      });
    });
  }
});

describe("guards", () => {
  const base: Shipment = fixtures[0].shipment;

  it("refuses to price a line whose HS code has no rate row", () => {
    const s: Shipment = { ...base, lines: [{ ...base.lines[0], hs_code: "9999.99.99" }] };
    expect(() => computeShipment(s, rates)).toThrow(RateNotFoundError);
  });

  it("refuses a shipment dated before any rate was in force", () => {
    const s: Shipment = { ...base, date: "2021-01-01" };
    expect(() => computeShipment(s, rates)).toThrow(RateNotFoundError);
  });

  it("refuses alcohol with no excise row even if tariff exists", () => {
    const noExcise: RateTables = { ...rates, excise_lines: [] };
    expect(() => computeShipment(base, noExcise)).toThrow(/excise/i);
  });

  it("picks the newer excise version on and after 1 Nov 2025", () => {
    const oct = computeShipment({ ...base, date: "2025-10-31" }, rates).lines[0];
    const nov = computeShipment({ ...base, date: "2025-11-01" }, rates).lines[0];
    expect(oct.rates_used.excise!.value).toBe(150);
    expect(nov.rates_used.excise!.value).toBe(165);
    expect(nov.per_unit.excise).toBeGreaterThan(oct.per_unit.excise);
  });

  it("applies an FTA override when origin and agreement match", () => {
    const withFta: RateTables = {
      ...rates,
      fta_rates: [
        {
          hs_code: "2204.21.11",
          description: "Still wine, MAFTA",
          origin_iso: "AU",
          agreement: "MAFTA",
          duty: { type: "per_litre", value: 0 },
          effective_from: "2013-01-01",
          effective_to: null,
          source_doc: "test",
          source_url: "https://example.test/mafta",
        },
      ],
    };
    const au = computeShipment({ ...base, origin_iso: "AU" }, withFta).lines[0];
    const fr = computeShipment({ ...base, origin_iso: "FR" }, withFta).lines[0];
    expect(au.duty).toBe(0);
    expect(au.rates_used.fta_agreement).toBe("MAFTA");
    expect(fr.duty).toBeGreaterThan(0);
    expect(fr.rates_used.fta_agreement).toBeNull();
  });

  it("CIF incoterm ignores freight and warns", () => {
    const r = computeShipment({ ...base, incoterm: "CIF" }, rates);
    expect(r.totals.freight).toBe(0);
    expect(r.warnings.length).toBe(1);
  });
});

describe("general goods", () => {
  it("prices an ad valorem line with SST on CIF + duty and no excise", async () => {
    const { manualRates, mergeRates } = await import("../src/index.js");
    const s: Shipment = {
      ...fixtures[0].shipment,
      lines: [{ id: "g1", name: "Wooden chairs", hs_code: "9403.60.00", volume_ml: 0, abv: 0, units_per_case: 1, cases: 100, unit_cost: 40 }],
    };
    const r = computeShipment(s, rates).lines[0];
    // goods 100 × 40 × 5 = 20,000; freight 480×5 = 2,400 → CIF 22,400; duty 20% = 4,480; SST 10% × 26,880 = 2,688
    expect(r.cif).toBe(22400);
    expect(r.duty).toBe(4480);
    expect(r.excise).toBe(0);
    expect(r.sst).toBe(2688);
    expect(r.rates_used.excise).toBeNull();

    // mixed shipment: a zero-volume line forces value allocation so it still carries freight
    const mixed = computeShipment({ ...s, lines: [fixtures[0].shipment.lines[0], s.lines[0]] }, rates);
    expect(mixed.warnings.some((w) => w.includes("split by value"))).toBe(true);
    expect(mixed.lines[1].freight).toBeGreaterThan(0);
    expect(Math.abs(mixed.totals.freight - 2400)).toBeLessThan(0.05);

    const manual = mergeRates(rates, manualRates("MANUAL-x", "Widgets", 5, 10));
    const m = computeShipment({ ...s, lines: [{ ...s.lines[0], hs_code: "MANUAL-x" }] }, manual).lines[0];
    expect(m.duty).toBe(1120);
  });
});

describe("FTA preferences", () => {
  it("ATIGA 0% applies to general goods from ASEAN with a warning; alcohol from AU/NZ/ASEAN stays MFN with a note", async () => {
    const { preferenceNote, withoutFta } = await import("../src/index.js");
    const chairs: Shipment = { ...fixtures[0].shipment, origin_iso: "VN", lines: [{ id: "g1", name: "Wooden chairs", hs_code: "9403.60.00", volume_ml: 0, abv: 0, units_per_case: 1, cases: 100, unit_cost: 40 }] };
    const pref = computeShipment(chairs, rates);
    expect(pref.lines[0].duty).toBe(0);
    expect(pref.lines[0].rates_used.fta_agreement).toBe("ATIGA");
    expect(pref.warnings.some((w) => w.includes("certificate of origin"))).toBe(true);
    const mfn = computeShipment(chairs, withoutFta(rates));
    expect(mfn.lines[0].duty).toBe(4480);
    expect(computeShipment({ ...chairs, origin_iso: "DE" }, rates).lines[0].duty).toBe(4480);

    const auWine = computeShipment({ ...fixtures[0].shipment, origin_iso: "AU" }, rates).lines[0];
    expect(auWine.rates_used.fta_agreement).toBeNull();
    expect(auWine.rates_used.duty.value).toBe(7);
    expect(preferenceNote("AU", "2204.21.11")).toMatch(/MAFTA/);
    expect(preferenceNote("TH", "2203.00.91")).toMatch(/ATIGA/);
    expect(preferenceNote("FR", "2204.21.11")).toBeNull();
    expect(preferenceNote("TH", "9403.60.00")).toBeNull();
  });
});

describe("United Kingdom", () => {
  it("prices beer and wine with ABV-banded Alcohol Duty, £/hl customs duty and VAT 20%; refuses cider", async () => {
    const { ratesFor } = await import("../src/index.js");
    const gb = ratesFor("GB");
    const base: Shipment = { ...fixtures[0].shipment, dest_country: "GB", dest_port: "GBFXT", currency: "GBP", fx_rate: 1, freight: 300, insurance: { amount: 0 }, local_charges_myr: {}, lines: [] };
    // 100 cases × 24 × 330 ml lager 5% at £1: 792 L, 39.6 L alc → excise 39.6 × 22.58 = 894.17; duty 0; VAT 20% × (2700 + 894.17)
    const beer = computeShipment({ ...base, lines: [{ id: "b", name: "Lager", hs_code: "2203.00.91", volume_ml: 330, abv: 5, units_per_case: 24, cases: 100, unit_cost: 1 }] }, gb).lines[0];
    expect(beer.duty).toBe(0);
    expect(beer.excise).toBeCloseTo(39.6 * 22.58, 2);
    expect(beer.sst).toBeCloseTo((2700 + 39.6 * 22.58) * 0.2, 2);
    expect(beer.rates_used.sst_name).toBe("VAT");
    // 60 cases × 12 × 750 ml wine 13% at £5: 540 L, 70.2 L alc → band 8.5–22 = 30.62; duty 540 × 0.10 = 54
    const wine = computeShipment({ ...base, lines: [{ id: "w", name: "Wine", hs_code: "2204.21.11", volume_ml: 750, abv: 13, units_per_case: 12, cases: 60, unit_cost: 5 }] }, gb).lines[0];
    expect(wine.duty).toBeCloseTo(54, 2);
    expect(wine.excise).toBeCloseTo(70.2 * 30.62, 2);
    // 8% abbey ale falls in the 3.5–8.4 beer band; 8.5% ale in the 8.5–22 band
    const ale8 = computeShipment({ ...base, lines: [{ id: "a", name: "Ale", hs_code: "2203.00.99", volume_ml: 330, abv: 8, units_per_case: 24, cases: 100, unit_cost: 1 }] }, gb).lines[0];
    const ale85 = computeShipment({ ...base, lines: [{ id: "a", name: "Ale", hs_code: "2203.00.99", volume_ml: 330, abv: 8.5, units_per_case: 24, cases: 100, unit_cost: 1 }] }, gb).lines[0];
    expect(ale8.rates_used.excise!.value).toBe(22.58);
    expect(ale85.rates_used.excise!.value).toBe(30.62);
    // whisky 40%: duty 0, excise band 22.1+ = 33.99
    const whisky = computeShipment({ ...base, lines: [{ id: "s", name: "Whisky", hs_code: "2208.30.90", volume_ml: 700, abv: 40, units_per_case: 6, cases: 10, unit_cost: 12 }] }, gb).lines[0];
    expect(whisky.duty).toBe(0);
    expect(whisky.rates_used.excise!.value).toBe(33.99);
    // cider is deliberately not loaded
    expect(() => computeShipment({ ...base, lines: [{ id: "c", name: "Cider", hs_code: "2206.00.10", volume_ml: 500, abv: 4.5, units_per_case: 12, cases: 10, unit_cost: 1 }] }, gb)).toThrow(RateNotFoundError);
  });
});

describe("Canada", () => {
  it("MFN duty by ABV band, CRA excise, GST 5% on duty-paid value", async () => {
    const { ratesFor } = await import("../src/index.js");
    const caT = ratesFor("CA");
    const base: Shipment = { ...fixtures[0].shipment, dest_country: "CA", dest_port: "CAVAN", currency: "CAD", fx_rate: 1, freight: 300, insurance: { amount: 0 }, local_charges_myr: {}, lines: [] };
    // wine 13%: 540 L → duty 1.87¢/L = 10.10; excise 0.745/L = 402.30; GST 5% × (3000 + 10.098 + 402.3)
    const wine = computeShipment({ ...base, lines: [{ id: "w", name: "Wine", hs_code: "2204.21.11", volume_ml: 750, abv: 13, units_per_case: 12, cases: 60, unit_cost: 5 }] }, caT).lines[0];
    expect(wine.duty).toBeCloseTo(540 * 0.0187, 2);
    expect(wine.excise).toBeCloseTo(540 * 0.745, 2);
    expect(wine.sst).toBeCloseTo((3600 + 300 + 540 * 0.0187 + 540 * 0.745) * 0.05, 2);
    // 14.5% wine: 4.68¢/L band
    const w145 = computeShipment({ ...base, lines: [{ id: "w", name: "Wine", hs_code: "2204.21.11", volume_ml: 750, abv: 14.5, units_per_case: 12, cases: 60, unit_cost: 5 }] }, caT).lines[0];
    expect(w145.rates_used.duty.value).toBe(0.0468);
    // beer 5%: duty Free, excise $37.69/hl → 0.3769/L
    const beer = computeShipment({ ...base, lines: [{ id: "b", name: "Lager", hs_code: "2203.00.91", volume_ml: 330, abv: 5, units_per_case: 24, cases: 100, unit_cost: 1 }] }, caT).lines[0];
    expect(beer.duty).toBe(0);
    expect(beer.excise).toBeCloseTo(792 * 0.3769, 2);
    // whisky 40%: duty Free, excise 14.117 per L abs alcohol
    const whisky = computeShipment({ ...base, lines: [{ id: "s", name: "Whisky", hs_code: "2208.30.90", volume_ml: 700, abv: 40, units_per_case: 6, cases: 10, unit_cost: 12 }] }, caT).lines[0];
    expect(whisky.duty).toBe(0);
    expect(whisky.excise).toBeCloseTo(42 * 0.4 * 14.117, 2);
    // vodka: 12.28¢/L abs alcohol duty
    const vodka = computeShipment({ ...base, lines: [{ id: "v", name: "Vodka", hs_code: "2208.60.00", volume_ml: 700, abv: 40, units_per_case: 6, cases: 10, unit_cost: 12 }] }, caT).lines[0];
    expect(vodka.duty).toBeCloseTo(42 * 0.4 * 0.1228, 2);
  });
});

describe("any destination (indicative)", () => {
  it("prices general goods into Thailand with user duty % and VAT 7%, refuses alcohol, applies SA uplift", async () => {
    const { ratesForShipment, DESTINATIONS, destination } = await import("../src/index.js");
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(50);
    expect(destination("TH").tax_pct).toBe(7);
    const lines = [{ id: "c", name: "Wooden chairs", hs_code: "9403.60", volume_ml: 0, abv: 0, units_per_case: 1, cases: 100, unit_cost: 40, duty_pct: 20 }];
    const s: Shipment = { ...fixtures[0].shipment, dest_country: "TH", dest_port: "THBKK", currency: "USD", fx_rate: 33, lines };
    const r = computeShipment(s, ratesForShipment("TH", lines)).lines[0];
    // goods 100 × 40 × 33 = 132,000; freight 480 × 33 = 15,840 → CIF 147,840; duty 20% = 29,568; VAT 7% × 177,408 = 12,418.56
    expect(r.cif).toBe(147840);
    expect(r.duty).toBe(29568);
    expect(r.sst).toBe(12418.56);
    expect(r.rates_used.sst_name).toBe("VAT");
    // no duty % and no country default → refused, not guessed
    expect(() => ratesForShipment("TH", [{ hs_code: "9403.60", name: "x" }])).toThrow(RateNotFoundError);
    // GCC default duty 5%
    expect(ratesForShipment("AE", [{ hs_code: "9403.60", name: "x" }]).tariff_lines[0].duty.value).toBe(5);
    // alcohol into an indicative destination is refused (no excise table)
    const wine = { ...fixtures[0].shipment.lines[0], duty_pct: 54 };
    expect(() => computeShipment({ ...s, lines: [wine] }, ratesForShipment("TH", [wine]))).toThrow(/excise/i);
    // South Africa: VAT on CIF × 1.10 + duty
    const za = computeShipment({ ...s, dest_country: "ZA" }, ratesForShipment("ZA", lines)).lines[0];
    expect(za.sst).toBe(Math.round((147840 * 1.1 + 29568) * 0.15 * 100) / 100);
  });
});

describe("multi-country groundwork", () => {
  it("MY tables are tagged and the registry serves them", async () => {
    const { ratesFor, SUPPORTED_COUNTRIES } = await import("../src/index.js");
    expect(SUPPORTED_COUNTRIES).toEqual(["MY", "SG", "GB", "CA"]);
    expect(ratesFor("MY").country).toBe("MY");
    expect(ratesFor("SG").country).toBe("SG");
    expect(() => ratesFor("TH")).toThrow(/No rate tables/);
  });
  it("Singapore: beer pays S$16 + S$60 per litre of alcohol, wine nil + S$88, GST 9% on CIF + duties", async () => {
    const { ratesFor } = await import("../src/index.js");
    const sgRates = ratesFor("SG");
    // 100 cases × 24 × 330 ml lager 5% at S$1.00, fx 1 (already SGD), S$300 freight, no local
    const beer: Shipment = {
      date: "2026-01-15", dest_country: "SG", origin_iso: "BE", dest_port: "SGSIN", currency: "SGD", fx_rate: 1,
      incoterm: "EXW", freight: 300, insurance: { amount: 0 }, local_charges_myr: {}, allocation: "volume",
      lines: [{ id: "b", name: "Lager", hs_code: "2203.00.91", volume_ml: 330, abv: 5, units_per_case: 24, cases: 100, unit_cost: 1 }],
    };
    const r = computeShipment(beer, sgRates).lines[0];
    const litresAlc = 0.33 * 24 * 100 * 0.05; // 39.6
    expect(r.duty).toBeCloseTo(litresAlc * 16, 2);
    expect(r.excise).toBeCloseTo(litresAlc * 60, 2);
    expect(r.sst).toBeCloseTo((2400 + 300 + r.duty + r.excise) * 0.09, 2);
    expect(r.rates_used.sst_pct).toBe(9);

    const wine = computeShipment({ ...beer, lines: [{ id: "w", name: "Wine", hs_code: "2204.21.11", volume_ml: 750, abv: 13, units_per_case: 12, cases: 60, unit_cost: 5 }] }, sgRates).lines[0];
    expect(wine.duty).toBe(0);
    expect(wine.excise).toBeCloseTo(0.75 * 12 * 60 * 0.13 * 88, 2);
    // GST was 8% in 2023
    expect(computeShipment({ ...beer, date: "2023-06-01" }, sgRates).lines[0].rates_used.sst_pct).toBe(8);
    // every chapter-22 alcohol line has an SG row
    for (const hs of new Set(sgRates.tariff_lines.map((t) => t.hs_code))) expect(sgRates.excise_lines.some((e) => e.hs_code === hs)).toBe(true);
    expect(sgRates.tariff_lines.length).toBe(28);
  });
  it("refuses a shipment whose destination does not match the tables", () => {
    expect(() => computeShipment({ ...fixtures[0].shipment, dest_country: "SG" }, rates)).toThrow(/Rate tables are for MY/);
  });
});
