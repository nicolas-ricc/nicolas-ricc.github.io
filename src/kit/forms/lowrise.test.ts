import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { PLINTH_H } from "../../scenes/city-pieces";
import { RECIPES, recipe } from "../index";
import { STYLES } from "../styles";
import type { Lot, Piece, Side } from "../types";

const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const TOL = 1e-6;

const shopRow = (open: Side[], seed: number, lot: Lot = LOT): Piece => recipe("shopRow")({ ...lot, open }, createRng(seed), STYLES.bares);
const faced = (p: Piece): Solid[] => p.solids.filter((s) => "facade" in s && s.facade);
const cones = (p: Piece): Solid[] => p.solids.filter((s) => s.kind === "cone");

describe("kit: familia lowrise", () => {
  it("registra hilera de locales, casas en hilera y ruina devorada, ninguna landmark", () => {
    const defs = RECIPES.filter((r) => r.family === "lowrise");
    expect(defs.map((r) => r.name)).toEqual(["shopRow", "rowHouses", "eatenRuin"]);
    expect(defs.some((r) => r.landmark)).toBe(false);
  });

  describe("shopRow", () => {
    it("con open s: 4..5 slots neon sobre la pared sur, z 2.4..3.6, uno por local", () => {
      for (const seed of SEEDS) {
        const p = shopRow(["s"], seed);
        expect(p.slots.length).toBeGreaterThanOrEqual(4);
        expect(p.slots.length).toBeLessThanOrEqual(5);
        expect(p.slots.map((s) => s.local)).toEqual(p.slots.map((_, i) => i));
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

    it("con open vacío no publica slots", () => {
      for (const seed of SEEDS) expect(shopRow([], seed).slots).toEqual([]);
    });

    it("con open s y e el local de la esquina (el último) publica además un slot hacia el este", () => {
      for (const seed of SEEDS) {
        const slots = shopRow(["s", "e"], seed).slots, east = slots.filter((s) => s.side === "e");
        expect(east).toHaveLength(1);
        expect(east[0]!.local).toBe(Math.max(...slots.map((s) => s.local)));
        for (const q of east[0]!.pts) expect(Math.abs(q.x - (LOT.x + LOT.w))).toBeLessThanOrEqual(TOL);
      }
    });

    it("con frente norte u oeste los slots van sobre esa pared, con su normal", () => {
      for (const seed of SEEDS) {
        for (const s of shopRow(["n"], seed).slots) { expect(s).toMatchObject({ side: "n", wall: { x: 0, y: -1, z: 0 } }); for (const q of s.pts) expect(Math.abs(q.y - LOT.y)).toBeLessThanOrEqual(TOL); }
        for (const s of shopRow(["w"], seed).slots) { expect(s).toMatchObject({ side: "w", wall: { x: -1, y: 0, z: 0 } }); for (const q of s.pts) expect(Math.abs(q.x - LOT.x)).toBeLessThanOrEqual(TOL); }
      }
    });

    it("el techo de cada local lleva el tono de su cuerpo", () => {
      for (const seed of SEEDS) {
        const p = shopRow(["s"], seed, LOT), shops = faced(p);
        for (const s of shops) {
          const b = bounds(s), roof = p.solids.find((q) => q.kind === "prism" && q !== s && Math.abs(q.at.z - b.max.z) < TOL && q.at.x < b.max.x && q.at.x + q.w > b.min.x && Math.abs(q.at.x + q.w / 2 - (b.min.x + b.max.x) / 2) < TOL);
          expect(roof?.tone ?? 0).toBe(s.tone ?? 0);
        }
      }
    });

    it("con open s y n (lados opuestos) no hay local de esquina: solo slots sur", () => {
      for (const seed of SEEDS) expect(shopRow(["s", "n"], seed).slots.every((s) => s.side === "s")).toBe(true);
    });

    it("con frente este en el lote mínimo los slots van sobre la pared este", () => {
      const lot: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: ["e"], maxH: 24 };
      for (const seed of SEEDS) {
        const p = shopRow(["e"], seed, lot);
        expect(p.slots.length).toBeGreaterThanOrEqual(3);
        for (const s of p.slots) { expect(s.side).toBe("e"); for (const q of s.pts) expect(Math.abs(q.x - (lot.x + lot.w))).toBeLessThanOrEqual(TOL); }
      }
    });

    it("cada local tiene vidriera glass y su toldo, el toldo debajo del neón; anchos 4..6 que suman el frente", () => {
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
    it("en un frente de 26 los locales siguen midiendo 4..6 y suman el frente", () => {
      const lot: Lot = { x: 1.5, y: 1.5, w: 26, d: 15, z: 0, open: ["s"], maxH: 24 };
      for (const seed of SEEDS) {
        const widths = faced(shopRow(["s"], seed, lot)).map((s) => { const b = bounds(s); return b.max.x - b.min.x; });
        for (const w of widths) { expect(w).toBeGreaterThanOrEqual(4 - TOL); expect(w).toBeLessThanOrEqual(6 + TOL); }
        expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(26, 6);
      }
    });
  });

  describe("rowHouses", () => {
    it("4..5 casas de 2 pisos con puerta (cols 1, portico), anchos 4..5, hip de style.roof cada una, un árbol por par, sin slots", () => {
      for (const seed of SEEDS) {
        const p = recipe("rowHouses")(LOT, createRng(seed), STYLES.residencial), houses = faced(p);
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

    it("en el lote mínimo y con frente norte u oeste las casas siguen siendo 4..5 de 4..5 pegadas al frente, con el jardín atrás", () => {
      const lot: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: [], maxH: 24 };
      for (const open of [["s"], ["n"], ["w"]] as Side[][]) for (const seed of SEEDS) {
        const p = recipe("rowHouses")({ ...lot, open }, createRng(seed), STYLES.residencial), houses = faced(p).map(bounds);
        const front = open[0]!, alongX = front !== "w";
        expect(houses.length).toBeGreaterThanOrEqual(alongX ? 4 : 3); // un frente de 12 solo admite 3
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

    it("el techo de cada casa lleva el tono de su cuerpo", () => {
      for (const seed of SEEDS) {
        const p = recipe("rowHouses")(LOT, createRng(seed), STYLES.residencial), houses = faced(p), roofs = p.solids.filter((s) => s.kind === "prism" && s.roof === "hip");
        houses.forEach((h, i) => expect(roofs[i]!.tone ?? 0).toBe(h.tone ?? 0));
      }
    });
  });

  describe("eatenRuin", () => {
    it("suelo leafDark, 2..3 losas paving, ruina officeDark 5×4, ≥ 6 conos, sin ventanas ni slots", () => {
      for (const seed of SEEDS) {
        const p = recipe("eatenRuin")(LOT, createRng(seed), STYLES.centro);
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
  });
});
