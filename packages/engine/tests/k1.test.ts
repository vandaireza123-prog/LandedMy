/**
 * Regression against real RMCD K1 declarations (Port Klang Free Zone, 2026).
 * Per-line duty, excise and SST must match the customs assessment to the sen.
 * Shipment totals must match to within the rounding of line values shown on the form.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRateTables, computeShipment, type Shipment } from "../src/index.js";

interface K1Fixture {
  name: string;
  shipment: Shipment;
  k1_lines: { id: string; litres: number; duty: number; excise: number; sst: number }[];
  k1_totals: { litres: number; cif: number; duty: number; excise: number; sst: number; total_payable: number };
}

const dir = join(__dirname, "..", "fixtures", "k1");
const fixtures: K1Fixture[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

const rates = buildRateTables();

describe("real K1 declarations", () => {
  for (const fx of fixtures) {
    describe(fx.name, () => {
      const result = computeShipment(fx.shipment, rates);

      for (const k of fx.k1_lines) {
        it(`line ${k.id}: duty ${k.duty} / excise ${k.excise} / SST ${k.sst}`, () => {
          const l = result.lines.find((x) => x.id === k.id)!;
          expect(l.litres).toBe(k.litres);
          expect(l.duty).toBe(k.duty);
          expect(l.excise).toBe(k.excise);
          expect(l.sst).toBe(k.sst);
        });
      }

      it("shipment totals match the K1 (duty exact, others within RM0.50)", () => {
        const t = fx.k1_totals;
        expect(result.totals.duty).toBe(t.duty);
        expect(Math.abs(result.totals.cif - t.cif)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(result.totals.excise - t.excise)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(result.totals.sst - t.sst)).toBeLessThanOrEqual(0.5);
        const payable = result.totals.duty + result.totals.excise + result.totals.sst;
        expect(Math.abs(payable - t.total_payable)).toBeLessThanOrEqual(0.5);
      });

      it("used the post-Nov-2025 excise rate (RM165) and MFN duty (RM7)", () => {
        for (const l of result.lines) {
          expect(l.rates_used.excise!.value).toBe(165);
          expect(l.rates_used.duty.value).toBe(7);
          expect(l.rates_used.fta_agreement).toBeNull();
        }
      });
    });
  }
});
