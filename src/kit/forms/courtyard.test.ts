import { describe, expect, it } from "vitest";
import { bounds, type Bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { RECIPES, recipe } from "../index";
import { STYLES } from "../styles";
import type { Lot, Piece } from "../types";

/** Lote útil de la ciudad, el del lab y el mínimo que toda receta tiene que aguantar. */
const LOTS: Lot[] = [
  { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 },
  { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 },
  { x: 0, y: 0, w: 16, d: 12, z: 0, open: [], maxH: 24 },
];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const PATIOS = ["courtyardO", "courtyardU", "courtyardC", "patioResidential"] as const;
const TOL = 1e-6;

/** Los intervalos se solapan de verdad (tocarse en el borde no cuenta). */
const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => Math.min(a1, b1) - Math.max(a0, b0) > TOL;
const overlapsXY = (a: Bounds, b: Bounds): boolean => overlaps(a.min.x, a.max.x, b.min.x, b.max.x) && overlaps(a.min.y, a.max.y, b.min.y, b.max.y);
const rectBounds = (r: Rect): Bounds => ({ min: { x: r.x, y: r.y, z: 0 }, max: { x: r.x + r.w, y: r.y + r.d, z: 0 } });
const inside = (b: Bounds, r: Rect): boolean => b.min.x >= r.x - TOL && b.max.x <= r.x + r.w + TOL && b.min.y >= r.y - TOL && b.max.y <= r.y + r.d + TOL;
const wings = (p: Piece): Solid[] => p.solids.filter((s) => "facade" in s && s.facade);
const isBench = (s: Solid): boolean => s.kind === "prism" && s.mat === "paving" && s.w === 2 && s.d === 0.6 && s.h === 0.5;
const cones = (p: Piece): Solid[] => p.solids.filter((s) => s.kind === "cone");

function runs(name: string, fn: (p: Piece, lot: Lot) => void): void {
  for (const lot of LOTS) for (const seed of SEEDS) fn(recipe(name)(lot, createRng(seed), STYLES.residencial), lot);
}

describe("kit: familia courtyard", () => {
  it("registra O, U, C y patio residencial, ninguna landmark", () => {
    const defs = RECIPES.filter((r) => r.family === "courtyard");
    expect(defs.map((r) => r.name)).toEqual([...PATIOS]);
    expect(defs.some((r) => r.landmark)).toBe(false);
  });

  for (const name of PATIOS) {
    describe(name, () => {
      it("las alas no se solapan en planta", () => {
        runs(name, (p) => {
          const bs = wings(p).map(bounds);
          expect(bs.length).toBeGreaterThanOrEqual(2);
          for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) expect(overlapsXY(bs[i]!, bs[j]!)).toBe(false);
        });
      });

      it("publica un patio de medidas positivas que no pisa ningún ala", () => {
        runs(name, (p) => {
          expect(p.courtyard).toBeDefined();
          const c = p.courtyard!;
          expect(c.w).toBeGreaterThan(0);
          expect(c.d).toBeGreaterThan(0);
          for (const b of wings(p).map(bounds)) expect(overlapsXY(b, rectBounds(c))).toBe(false);
        });
      });

      it("todo árbol y todo banco cae dentro del patio", () => {
        runs(name, (p) => {
          for (const s of [...cones(p), ...p.solids.filter(isBench)]) expect(inside(bounds(s), p.courtyard!)).toBe(true);
        });
      });
    });
  }

  it("courtyardO: hueco de 3 en el ala sur, ninguna caja cruza el pasaje", () => {
    runs("courtyardO", (p, lot) => {
      const cx = lot.x + lot.w / 2, y0 = lot.y + lot.d - 5, y1 = lot.y + lot.d;
      for (const s of p.solids) {
        const b = bounds(s);
        if (!overlaps(b.min.y, b.max.y, y0, y1)) continue;
        expect(overlaps(b.min.x, b.max.x, cx - 1.5, cx + 1.5)).toBe(false);
      }
      expect(wings(p)).toHaveLength(5); // norte, este, oeste y el ala sur partida en dos
    });
  });

  it("courtyardO: patio con baldosas paving como ground o verde con 2..3 árboles; las dos variantes salen", () => {
    let tiled = 0, green = 0;
    runs("courtyardO", (p) => {
      if (p.ground.length > 0) { tiled++; expect(p.ground.every((g) => g.mat === "paving")).toBe(true); expect(cones(p)).toHaveLength(0); }
      else { green++; expect(p.solids.some((s) => s.kind === "prism" && s.mat === "leafDark" && s.h === 0.3)).toBe(true); expect(cones(p).length).toBeGreaterThanOrEqual(2); expect(cones(p).length).toBeLessThanOrEqual(3); }
    });
    expect(tiled).toBeGreaterThan(0);
    expect(green).toBeGreaterThan(0);
  });

  it("courtyardU: abierta hacia open[0] (sur sin open), dos árboles y un banco", () => {
    for (const open of [["e"], ["s"], ["n"], ["w"], []] as const) for (const seed of SEEDS) {
      const lot: Lot = { x: 0, y: 0, w: 21, d: 15, z: 0, open: [...open], maxH: 24 }, side = open[0] ?? "s";
      const p = recipe("courtyardU")(lot, createRng(seed), STYLES.centro), c = p.courtyard!;
      expect(wings(p)).toHaveLength(3);
      const edge = { s: c.y + c.d === lot.y + lot.d, n: c.y === lot.y, e: c.x + c.w === lot.x + lot.w, w: c.x === lot.x }[side];
      expect(edge).toBe(true);
      expect(cones(p)).toHaveLength(2);
      expect(p.solids.filter(isBench)).toHaveLength(1);
    }
  });

  it("courtyardC: cinco alas y publica el patio sur", () => {
    runs("courtyardC", (p, lot) => {
      expect(wings(p)).toHaveLength(5);
      expect(p.courtyard!.y).toBeGreaterThan(lot.y + lot.d / 2);
    });
  });

  it("patioResidential: alas de 4.5 con hip de style.roof cada una, 2..4 árboles, sin pasaje", () => {
    runs("patioResidential", (p) => {
      const ws = wings(p);
      expect(ws).toHaveLength(4);
      for (const w of ws) { const b = bounds(w); expect(Math.min(b.max.x - b.min.x, b.max.y - b.min.y)).toBeCloseTo(4.5, 6); expect(w.mat).toBe("plaster"); }
      expect(p.solids.filter((s) => s.kind === "prism" && s.roof === "hip" && s.mat === "terracotta")).toHaveLength(4);
      expect(cones(p).length).toBeGreaterThanOrEqual(2);
      expect(cones(p).length).toBeLessThanOrEqual(4);
    });
  });
});
