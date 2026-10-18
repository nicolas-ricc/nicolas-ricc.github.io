import { describe, expect, it } from "vitest";
import { convexHull, type Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { RECIPES, recipe } from "./index";
import { LANDMARK_MAX_H, RECIPE_MAX_H } from "./piece";
import { STYLES } from "./styles";
import type { Lot, Piece } from "./types";

/** El lote útil de una manzana de la ciudad (21×15, vereda adentro) y el del lab (24×18). */
const LOTS: Lot[] = [
  { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 },
  { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 },
];
const STYLE_IDS = ["centro", "bares", "residencial", "civico"] as const;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-9;

/** Punto estrictamente dentro de un polígono (ray casting). */
function inPoly(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Para cada poly cóncavo, ningún otro sólido de la pieza tiene parte de su caja en el hueco (casco convexo menos huella). */
function concaveIntruders(solids: Solid[]): number {
  let n = 0;
  for (const s of solids) {
    if (s.kind !== "poly") continue;
    const hull = convexHull(s.footprint);
    if (hull.length === s.footprint.length) continue; // convexo
    for (const o of solids) {
      if (o === s) continue;
      const b = bounds(o);
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
        const p = { x: b.min.x + ((b.max.x - b.min.x) * i) / 4, y: b.min.y + ((b.max.y - b.min.y) * j) / 4 };
        if (inPoly(p, hull) && !inPoly(p, s.footprint)) n++;
      }
    }
  }
  return n;
}

/** Copia con `dz` sumado a toda coordenada z; las normales (`wall`, `normal`) no se mueven. */
function shiftZ(v: unknown, dz: number, key = ""): unknown {
  if (key === "wall" || key === "normal") return v;
  if (Array.isArray(v)) return v.map((x) => shiftZ(x, dz));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "z" && typeof x === "number" ? x + dz : shiftZ(x, dz, k)]));
  return v;
}
const rounded = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x));

describe("kit: el oráculo del hueco cóncavo", () => {
  it("detecta un sólido dentro del hueco de una L y no uno apoyado sobre el ala", () => {
    const L: Solid = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }], z: 0, h: 6, mat: "plaster" };
    const inHole: Solid = { kind: "cone", at: { x: 7, y: 7, z: 0 }, r: 1, h: 2, mat: "leaf" };
    const onWing: Solid = { kind: "cone", at: { x: 2, y: 2, z: 6 }, r: 1, h: 2, mat: "leaf" };
    expect(concaveIntruders([L, inHole])).toBeGreaterThan(0);
    expect(concaveIntruders([L, onWing])).toBe(0);
  });
});

describe("kit: contrato de toda receta registrada", () => {
  it("el registro tiene nombres únicos y recipe() los encuentra", () => {
    expect(new Set(RECIPES.map((r) => r.name)).size).toBe(RECIPES.length);
    for (const def of RECIPES) expect(recipe(def.name)).toBe(def.recipe);
    expect(() => recipe("no-existe")).toThrow();
  });

  for (const def of RECIPES) {
    describe(def.name, () => {
      const cap = (lot: Lot) => Math.min(lot.maxH, def.landmark ? LANDMARK_MAX_H : RECIPE_MAX_H);
      const runs = (fn: (p: Piece, lot: Lot) => void) => {
        for (const lot of LOTS) for (const id of STYLE_IDS) for (const seed of SEEDS) fn(def.recipe(lot, createRng(seed), STYLES[id]), lot);
      };

      it("todo sólido dentro del lote + 0.8, nada bajo lot.z, altura dentro del tope", () => {
        runs((p, lot) => {
          for (const s of [...p.solids, ...p.ground]) {
            const b = bounds(s);
            expect(b.min.x).toBeGreaterThanOrEqual(lot.x - 0.8 - EPS);
            expect(b.min.y).toBeGreaterThanOrEqual(lot.y - 0.8 - EPS);
            expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + 0.8 + EPS);
            expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + 0.8 + EPS);
            expect(b.min.z).toBeGreaterThanOrEqual(lot.z - EPS);
            expect(b.max.z).toBeLessThanOrEqual(lot.z + cap(lot) + EPS);
          }
        });
      });

      it("es determinista", () => {
        for (const lot of LOTS) for (const id of STYLE_IDS) for (const seed of SEEDS) {
          expect(JSON.stringify(def.recipe(lot, createRng(seed), STYLES[id]))).toBe(JSON.stringify(def.recipe(lot, createRng(seed), STYLES[id])));
        }
      });

      it("con maxH 10 (la manzana frente al piso encendido) también respeta el tope", () => {
        for (const base of LOTS) for (const id of STYLE_IDS) for (const seed of SEEDS) {
          const lot = { ...base, maxH: 10 }, p = def.recipe(lot, createRng(seed), STYLES[id]);
          for (const s of [...p.solids, ...p.ground]) expect(bounds(s).max.z).toBeLessThanOrEqual(lot.z + cap(lot) + EPS);
        }
      });

      it("ventanas y paredes solo de caras que miran a la cámara, de un edificio con fachada de la pieza", () => {
        runs((p) => {
          for (const w of p.windows) {
            expect(w.wall.x > EPS || w.wall.y > EPS).toBe(true);
            expect(w.floor).toBeGreaterThanOrEqual(0);
            const s = p.solids[w.building];
            expect(s && "facade" in s && s.facade).toBeTruthy();
          }
          for (const w of p.walls) {
            expect(w.normal.x > EPS || w.normal.y > EPS).toBe(true);
            expect(w.floorH).toBeGreaterThan(0);
            expect(p.solids[w.building]).toBeDefined();
          }
        });
      });

      it("los acentos no son ventanas encendidas (eso es de lights.ts)", () => {
        runs((p) => { for (const a of p.accents) expect(["windowWarm", "windowCool"]).not.toContain(a.color); });
      });

      it("ningún sólido ajeno dentro del hueco de un poly cóncavo", () => {
        runs((p) => expect(concaveIntruders(p.solids)).toBe(0));
      });

      it("con lot.z = 0.3 la salida es la de lot.z = 0 desplazada 0.3 en z", () => {
        for (const lot of LOTS) for (const seed of SEEDS.slice(0, 5)) {
          const base = def.recipe(lot, createRng(seed), STYLES.centro);
          const up = def.recipe({ ...lot, z: 0.3 }, createRng(seed), STYLES.centro);
          expect(rounded(up)).toBe(rounded(shiftZ(base, 0.3)));
        }
      });
    });
  }
});

describe("kit: familia modern", () => {
  it("registra las cuatro piezas del distrito; vidrio, clásico y obra son landmark", () => {
    const modern = RECIPES.filter((r) => r.family === "modern");
    expect(modern.map((r) => r.name)).toEqual(["glassTower", "classic", "campus", "constructionSite"]);
    expect(modern.filter((r) => r.landmark).map((r) => r.name)).toEqual(["glassTower", "classic", "constructionSite"]);
  });

  it("campus: patio verde en ground, tres edificios con fachada y cartel ámbar con caja; obra: losas, grúa y cerco", () => {
    const lot = LOTS[0]!;
    const c = recipe("campus")(lot, createRng(4), STYLES.distrito);
    expect(c.ground.some((g) => g.kind === "ground" && g.mat === "leafDark")).toBe(true);
    expect(c.solids.filter((s) => "facade" in s && s.facade)).toHaveLength(3);
    expect(c.accents.some((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
    const o = recipe("constructionSite")(lot, createRng(4), STYLES.distrito);
    expect(o.solids.filter((s) => s.kind === "prism" && s.mat === "paving" && s.h === 0.3 && s.at.z > 1)).toHaveLength(5);
    expect(o.solids.some((s) => s.kind === "prism" && s.h === 22 && s.w === 1.2)).toBe(true); // mástil
    expect(o.landmarkTop).toBeDefined();
  });

  it("vidrio y clásico publican ventanas, paredes, landmarkTop y un cartel sur solo con h ≥ 12", () => {
    const lot = LOTS[0]!;
    for (const name of ["glassTower", "classic"]) for (const seed of SEEDS) {
      const p = recipe(name)(lot, createRng(seed), STYLES.distrito);
      expect(p.windows.length).toBeGreaterThan(0);
      expect(p.walls.length).toBeGreaterThan(0);
      expect(p.landmarkTop).toBeDefined();
      expect(p.slots.length).toBeLessThanOrEqual(1);
      for (const s of p.slots) {
        expect(s).toMatchObject({ kind: "sign", side: "s", local: 0, wall: { x: 0, y: 1, z: 0 } });
        expect(s.pts).toHaveLength(4);
        expect(new Set(s.pts.map((q) => q.y)).size).toBe(1);
      }
    }
    // con un tope bajo no hay cartel: el cuerpo no llega a 12
    expect(recipe("classic")({ ...lot, maxH: 15 }, createRng(1), STYLES.distrito).slots).toEqual([]);
  });

  it("el estilo pone cornisas y techo: trim y roof del estilo, tone en los cuerpos con fachada", () => {
    const lot = LOTS[0]!, style = { ...STYLES.bares, tone: 1 };
    for (const seed of SEEDS) {
      const p = recipe("classic")(lot, createRng(seed), style);
      expect(p.solids.some((s) => s.mat === "officeDark" && s.kind === "prism" && s.h === 1)).toBe(true); // cornisa pesada = trim
      const gable = p.solids.find((s) => s.kind === "prism" && s.roof === "gable");
      if (gable) expect(gable.mat).toBe("terracotta");
      for (const s of p.solids) if ("facade" in s && s.facade) expect(s.tone).toBe(1);
    }
  });
});
