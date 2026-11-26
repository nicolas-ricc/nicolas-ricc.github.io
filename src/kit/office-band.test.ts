import { describe, expect, it } from "vitest";
import { bounds } from "../iso/solids";
import { createRng } from "../map/seed";
import { recipe } from "./index";
import { banded, fitToCap, recipeCap } from "./piece";
import { STYLES } from "./styles";
import type { Lot, Piece } from "./types";

// #495: a lot zoned for a height band (`Lot.band`) builds within it; the eleven recipes of the clasico, transicion and moderno catalogues
const BANDS = { clasico: { lo: 14, hi: 22 }, transicion: { lo: 24, hi: 34 }, moderno: { lo: 40, hi: 50 } } as const;
const RECIPES_OF = {
  clasico: ["cornerCupola", "mansard", "classic", "portalBase", "chamfer"],
  transicion: ["balconyBlock", "decoStepped", "chamfer", "courtyardO"],
  moderno: ["podiumTower", "glassTower", "twinTowers"],
} as const;
const lot = (band: { lo: number; hi: number } | undefined, maxH: number, w = 21, d = 18): Lot => ({ x: 1.5, y: 1.5, w, d, z: 0, open: ["s", "e"], maxH, ...(band ? { band } : {}) });
const top = (p: Piece, l: Lot): number => Math.max(...[...p.solids, ...p.ground].map((s) => bounds(s).max.z)) - l.z;
const finite = (p: Piece): boolean => [...p.solids, ...p.ground].every((s) => { const b = bounds(s); return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].every(Number.isFinite); });

describe("banded and the kit caps", () => {
  it("banded maps the draw from the recipe's range onto the lot's band, and is the identity without a band", () => {
    expect(banded(lot(undefined, 18), 14, 12, 18)).toBe(14);
    expect(banded(lot({ lo: 40, hi: 50 }, 50), 12, 12, 18)).toBe(40);
    expect(banded(lot({ lo: 40, hi: 50 }, 50), 18, 12, 18)).toBe(50);
    expect(banded(lot({ lo: 40, hi: 50 }, 50), 15, 12, 18)).toBeCloseTo(45, 9);
    expect(banded(lot({ lo: 24, hi: 34 }, 34), 7, 7, 7)).toBe(34); // an empty range takes the top of the band
  });

  it("recipeCap and fitToCap stop clamping at 18 / 24 on a banded lot only", () => {
    expect(recipeCap(lot(undefined, 50))).toBe(18);
    expect(recipeCap(lot({ lo: 40, hi: 50 }, 50))).toBe(50);
    const tall: Piece = { solids: [{ kind: "prism", at: { x: 2, y: 2, z: 0 }, w: 4, d: 4, h: 45, mat: "office" }], ground: [], accents: [], windows: [], slots: [], walls: [] };
    expect(top(fitToCap(tall, lot(undefined, 50)), lot(undefined, 50))).toBeCloseTo(24, 9);
    expect(top(fitToCap(tall, lot({ lo: 40, hi: 50 }, 50)), lot(undefined, 50))).toBeCloseTo(45, 9);
  });
});

describe("barrio recipes on a banded lot", () => {
  for (const [barrio, names] of Object.entries(RECIPES_OF) as [keyof typeof BANDS, readonly string[]][]) {
    const band = BANDS[barrio];
    for (const name of names) {
      it(`${name} (${barrio}) stays within ${band.lo}..${band.hi} and spreads over the band`, () => {
        const tops: number[] = [];
        for (let seed = 1; seed <= 20; seed++) {
          const l = lot(band, band.hi), p = recipe(name)(l, createRng(seed), STYLES[barrio]);
          expect(finite(p), `${name} seed ${seed}`).toBe(true);
          const t = top(p, l);
          expect(t, `${name} seed ${seed}`).toBeLessThanOrEqual(band.hi + 1e-6);
          tops.push(t);
        }
        expect(tops.filter((t) => t >= band.lo - 0.5).length, `${name} tops ${tops.map((t) => t.toFixed(1)).join(" ")}`).toBeGreaterThanOrEqual(18); // 90 % reach the band
        expect(Math.max(...tops) - Math.min(...tops), name).toBeGreaterThan(0.5); // not one fixed height
      });
    }
  }

  it("a band squeezed by the train rule (26.9..26.9) caps every moderno recipe at 26.9", () => {
    for (const name of RECIPES_OF.moderno) for (let seed = 1; seed <= 10; seed++) {
      const l = lot({ lo: 26.9, hi: 26.9 }, 26.9), p = recipe(name)(l, createRng(seed), STYLES.moderno);
      expect(finite(p), name).toBe(true);
      expect(top(p, l), `${name} seed ${seed}`).toBeLessThanOrEqual(26.9 + 1e-6);
    }
  });

  it("banded recipes on a 7 × 7 lot give finite bounds whenever the unbanded recipe does", () => {
    for (const [barrio, names] of Object.entries(RECIPES_OF) as [keyof typeof BANDS, readonly string[]][]) for (const name of names) {
      const band = BANDS[barrio], l = lot(band, band.hi, 7, 7), p = recipe(name)(l, createRng(3), STYLES[barrio]);
      expect(finite(p), name).toBe(finite(recipe(name)(lot(undefined, band.hi, 7, 7), createRng(3), STYLES[barrio]))); // courtyardO is not finite on 7 × 7 even without a band (pre-existing)
      if (p.solids.length) expect(top(p, l), name).toBeLessThanOrEqual(band.hi + 1e-6);
    }
  });
});
