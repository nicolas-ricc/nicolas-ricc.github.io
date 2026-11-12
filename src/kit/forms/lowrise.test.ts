import { describe, expect, it } from "vitest";
import { fingerprint } from "../../iso/fingerprint";
import { bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { PLINTH_H } from "../../scenes/city-pieces";
import { RECIPES, recipe } from "../index";
import { STYLES } from "../styles";
import type { Lot, Piece, Side } from "../types";
import { neonRun } from "./lowrise";

const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const TOL = 1e-6;

const shopRow = (open: Side[], seed: number, lot: Lot = LOT): Piece => recipe("shopRow")({ ...lot, open }, createRng(seed), STYLES.bars);
const faced = (p: Piece): Solid[] => p.solids.filter((s) => "facade" in s && s.facade);
const cones = (p: Piece): Solid[] => p.solids.filter((s) => s.kind === "cone");

describe("kit: lowrise family", () => {
  it("registers shop row, row houses and eaten ruin, none a landmark", () => {
    const defs = RECIPES.filter((r) => r.family === "lowrise");
    expect(defs.map((r) => r.name)).toEqual(["shopRow", "rowHouses", "eatenRuin"]);
    expect(defs.some((r) => r.landmark)).toBe(false);
  });

  describe("shopRow", () => {
    it("with open s: 4..5 neon slots on the south wall, z 2.4..3.6, one per shop", () => {
      for (const seed of SEEDS) {
        const p = shopRow(["s"], seed);
        expect(p.slots.length).toBeGreaterThanOrEqual(4);
        expect(p.slots.length).toBeLessThanOrEqual(5);
        expect(p.slots.map((s) => s.shop)).toEqual(p.slots.map((_, i) => i));
        for (const s of p.slots) {
          expect(s).toMatchObject({ kind: "neon", side: "s", wall: { x: 0, y: 1, z: 0 } });
          for (const q of s.pts) {
            expect(Math.abs(q.y - (LOT.y + LOT.d))).toBeLessThanOrEqual(TOL);
            expect(q.z).toBeGreaterThanOrEqual(2.4 - TOL);
            expect(q.z).toBeLessThanOrEqual(3.6 + TOL);
          }
        }
      }
    });

    it("with empty open it publishes no slots", () => {
      for (const seed of SEEDS) expect(shopRow([], seed).slots).toEqual([]);
    });

    it("with open s and e the corner shop (the last) also publishes a slot toward the east", () => {
      for (const seed of SEEDS) {
        const slots = shopRow(["s", "e"], seed).slots, east = slots.filter((s) => s.side === "e");
        expect(east).toHaveLength(1);
        expect(east[0]!.shop).toBe(Math.max(...slots.map((s) => s.shop)));
        for (const q of east[0]!.pts) expect(Math.abs(q.x - (LOT.x + LOT.w))).toBeLessThanOrEqual(TOL);
      }
    });

    it("with a north or west frontage the slots go on that wall, with its normal", () => {
      for (const seed of SEEDS) {
        for (const s of shopRow(["n"], seed).slots) { expect(s).toMatchObject({ side: "n", wall: { x: 0, y: -1, z: 0 } }); for (const q of s.pts) expect(Math.abs(q.y - LOT.y)).toBeLessThanOrEqual(TOL); }
        for (const s of shopRow(["w"], seed).slots) { expect(s).toMatchObject({ side: "w", wall: { x: -1, y: 0, z: 0 } }); for (const q of s.pts) expect(Math.abs(q.x - LOT.x)).toBeLessThanOrEqual(TOL); }
      }
    });

    it("the roof of each shop carries its body's tone", () => {
      for (const seed of SEEDS) {
        const p = shopRow(["s"], seed, LOT), shops = faced(p), roofs = p.solids.filter((q) => q.kind === "prism" && !("facade" in q && q.facade));
        shops.forEach((s, i) => expect(roofs[i]?.tone ?? 0).toBe(s.tone ?? 0));
      }
    });

    it("with open s and n (opposite sides) there is no corner shop: only south slots", () => {
      for (const seed of SEEDS) expect(shopRow(["s", "n"], seed).slots.every((s) => s.side === "s")).toBe(true);
    });

    it("with an east frontage in the minimum lot the slots go on the east wall", () => {
      const lot: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: ["e"], maxH: 24 };
      for (const seed of SEEDS) {
        const p = shopRow(["e"], seed, lot);
        expect(p.slots.length).toBeGreaterThanOrEqual(3);
        for (const s of p.slots) { expect(s.side).toBe("e"); for (const q of s.pts) expect(Math.abs(q.x - (lot.x + lot.w))).toBeLessThanOrEqual(TOL); }
      }
    });

    it("each shop has a glass shop window and its awning, the awning below the neon; widths 4..6 that add up to the frontage", () => {
      for (const seed of SEEDS) {
        const p = shopRow(["s"], seed), shops = faced(p);
        expect(shops.length).toBe(p.slots.length);
        for (const s of shops) expect("facade" in s && s.facade?.base).toBe("glass");
        const awnings = p.solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
        expect(awnings).toHaveLength(shops.length);
        for (const a of awnings) expect(bounds(a).max.z).toBeLessThanOrEqual(LOT.z + 2.4 + TOL);
        const widths = shops.map((s) => { const b = bounds(s); return b.max.x - b.min.x; });
        for (const w of widths) { expect(w).toBeGreaterThanOrEqual(4 - TOL); expect(w).toBeLessThanOrEqual(6 + TOL); }
        expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(LOT.w, 6);
      }
    });
    it("on a frontage of 26 the shops still measure 4..6 and add up to the frontage", () => {
      const lot: Lot = { x: 1.5, y: 1.5, w: 26, d: 15, z: 0, open: ["s"], maxH: 24 };
      for (const seed of SEEDS) {
        const widths = faced(shopRow(["s"], seed, lot)).map((s) => { const b = bounds(s); return b.max.x - b.min.x; });
        for (const w of widths) { expect(w).toBeGreaterThanOrEqual(4 - TOL); expect(w).toBeLessThanOrEqual(6 + TOL); }
        expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(26, 6);
      }
    });

    it("shopRow: a roof or cornice is flush on the side of a taller neighbour and overhangs 0.5 elsewhere", () => {
      for (const open of [["s"], ["e"], ["s", "e"]] as Side[][]) for (const seed of SEEDS) for (const style of Object.values(STYLES)) {
        const p = recipe("shopRow")({ ...LOT, open }, createRng(seed), style);
        const bodies = faced(p).map(bounds), roofs = p.solids.filter((s) => s.kind === "prism" && !("facade" in s && s.facade)).map(bounds);
        expect(roofs).toHaveLength(bodies.length);
        const ax = open[0] === "s" ? "x" : "y", cross = ax === "x" ? "y" : "x";
        bodies.forEach((b, k) => {
          const r = roofs[k]!, lowTaller = k > 0 && bodies[k - 1]!.max.z > b.max.z + TOL, highTaller = k + 1 < bodies.length && bodies[k + 1]!.max.z > b.max.z + TOL;
          expect(Math.abs(b.min[ax] - r.min[ax] - (lowTaller ? 0 : 0.5))).toBeLessThanOrEqual(TOL);
          expect(Math.abs(r.max[ax] - b.max[ax] - (highTaller ? 0 : 0.5))).toBeLessThanOrEqual(TOL);
          expect(Math.abs(b.min[cross] - r.min[cross] - 0.5)).toBeLessThanOrEqual(TOL);
          expect(Math.abs(r.max[cross] - b.max[cross] - 0.5)).toBeLessThanOrEqual(TOL);
        });
      }
    });

    it("shopRow: the bodies are the ones before #152 (rng order unchanged)", () => {
      // recorded on 3a15116, before #152
      const want = ["71aa6d4c", "11baa06b", "d09edfac"];
      [1, 2, 3].forEach((seed, i) => expect(fingerprint(faced(recipe("shopRow")(LOT, createRng(seed), STYLES.downtown)))).toBe(want[i]));
    });
  });

  describe("rowHouses", () => {
    it("4..5 houses of 2 floors with a door (cols 1, portico), widths 4..5, a style.roof hip on each, one tree per pair, no slots", () => {
      for (const seed of SEEDS) {
        const p = recipe("rowHouses")(LOT, createRng(seed), STYLES.residential), houses = faced(p);
        expect(houses.length).toBeGreaterThanOrEqual(4);
        expect(houses.length).toBeLessThanOrEqual(5);
        for (const h of houses) {
          expect("facade" in h && h.facade).toMatchObject({ floors: 2, cols: 1, base: "portico" });
          expect(h.mat).toBe("plaster");
          const b = bounds(h), w = b.max.x - b.min.x;
          expect(w).toBeGreaterThanOrEqual(4 - TOL);
          expect(w).toBeLessThanOrEqual(5 + TOL);
        }
        expect(p.solids.filter((s) => s.kind === "prism" && s.roof === "hip" && s.mat === "terracotta")).toHaveLength(houses.length);
        expect(cones(p)).toHaveLength(Math.floor(houses.length / 2));
        expect(p.slots).toEqual([]);
      }
    });

    it("in the minimum lot and with a north or west frontage the houses are still 4..5 of 4..5 flush with the frontage, with the garden behind", () => {
      const lot: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: [], maxH: 24 };
      for (const open of [["s"], ["n"], ["w"]] as Side[][]) for (const seed of SEEDS) {
        const p = recipe("rowHouses")({ ...lot, open }, createRng(seed), STYLES.residential), houses = faced(p).map(bounds);
        const front = open[0]!, alongX = front !== "w";
        expect(houses.length).toBeGreaterThanOrEqual(alongX ? 4 : 3); // a frontage of 12 only admits 3
        for (const b of houses) {
          const w = alongX ? b.max.x - b.min.x : b.max.y - b.min.y;
          expect(w).toBeGreaterThanOrEqual(4 - TOL);
          expect(w).toBeLessThanOrEqual(5 + TOL);
          const edge = { s: b.max.y === lot.y + lot.d, n: b.min.y === lot.y, w: b.min.x === lot.x }[front as "s" | "n" | "w"];
          expect(edge).toBe(true);
        }
        for (const t of cones(p)) { const c = bounds(t); expect(houses.some((b) => c.min.x < b.max.x && c.max.x > b.min.x && c.min.y < b.max.y && c.max.y > b.min.y)).toBe(false); }
      }
    });

    it("the roof of each house carries its body's tone", () => {
      for (const seed of SEEDS) {
        const p = recipe("rowHouses")(LOT, createRng(seed), STYLES.residential), houses = faced(p), roofs = p.solids.filter((s) => s.kind === "prism" && s.roof === "hip");
        houses.forEach((h, i) => expect(roofs[i]!.tone ?? 0).toBe(h.tone ?? 0));
      }
    });
  });

  describe("eatenRuin", () => {
    it("leafDark floor, 2..3 paving slabs, officeDark ruin 5×4, ≥ 6 cones, no windows or slots", () => {
      for (const seed of SEEDS) {
        const p = recipe("eatenRuin")(LOT, createRng(seed), STYLES.downtown);
        expect(p.ground.some((g) => g.kind === "ground" && g.mat === "leafDark")).toBe(true);
        const slabs = p.solids.filter((s) => s.kind === "prism" && s.mat === "paving" && s.h === PLINTH_H);
        expect(slabs.length).toBeGreaterThanOrEqual(2);
        expect(slabs.length).toBeLessThanOrEqual(3);
        expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "officeDark" && s.w === 5 && s.d === 4)).toHaveLength(1);
        expect(cones(p).length).toBeGreaterThanOrEqual(6);
        expect(p.windows).toEqual([]);
        expect(p.walls).toEqual([]);
        expect(p.slots).toEqual([]);
      }
    });

    it("eatenRuin: slabs, ruin block and jungle interlock", () => {
      for (const seed of SEEDS) {
        const p = recipe("eatenRuin")(LOT, createRng(seed), STYLES.downtown);
        expect(p.solids.length).toBeGreaterThan(0);
        for (const q of p.solids) expect(q.interlocks).toBe(true);
      }
    });
  });
});

describe("kit: neon runs (#165)", () => {
  it("neonRun splits a 15-long face into 4 bays, numbered from shop0, 2.75 wide, 2.4 above z", () => {
    const slots = neonRun({ x: 0, y: 0, w: 15, d: 5 }, "s", 0.3, 2);
    expect(slots.map((s) => s.shop)).toEqual([2, 3, 4, 5]);
    for (const s of slots) {
      expect(s).toMatchObject({ kind: "neon", side: "s", wall: { x: 0, y: 1, z: 0 } });
      expect(Math.abs(s.pts[1]!.x - s.pts[0]!.x - 2.75)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(s.pts[0]!.z - 2.7)).toBeLessThanOrEqual(TOL);
      for (const q of s.pts) expect(Math.abs(q.y - 5)).toBeLessThanOrEqual(TOL);
    }
  });

  it("every open side perpendicular to the front gets its corner shop's slot", () => {
    for (const seed of SEEDS) {
      const slots = shopRow(["s", "e", "w"], seed).slots, last = Math.max(...slots.map((s) => s.shop));
      const east = slots.filter((s) => s.side === "e"), west = slots.filter((s) => s.side === "w");
      expect(east).toHaveLength(1);
      expect(east[0]!.shop).toBe(last);
      expect(west).toHaveLength(1);
      expect(west[0]!.shop).toBe(0);
      for (const q of west[0]!.pts) expect(Math.abs(q.x - LOT.x)).toBeLessThanOrEqual(TOL);
    }
  });

  it("a front on e with s open puts the corner slot on the last shop", () => {
    for (const seed of SEEDS) {
      const slots = shopRow(["e", "s"], seed).slots, south = slots.filter((s) => s.side === "s");
      expect(south).toHaveLength(1);
      expect(south[0]!.shop).toBe(Math.max(...slots.map((s) => s.shop)));
      for (const q of south[0]!.pts) expect(Math.abs(q.y - (LOT.y + LOT.d))).toBeLessThanOrEqual(TOL);
    }
  });
});
