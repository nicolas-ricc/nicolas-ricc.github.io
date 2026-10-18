import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { RECIPES, recipe } from "../index";
import { STYLES } from "../styles";
import type { Lot, Piece } from "../types";

/** El lote útil de una manzana de la ciudad y el del lab. */
const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const LAB: Lot = { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 };
const STYLE_IDS = ["centro", "bares", "residencial", "civico"] as const;
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const EPS = 1e-9;

const top = (p: Piece): number => Math.max(...[...p.solids, ...p.ground].map((s) => bounds(s).max.z));
/** Lote de prueba de cada receta: la torre de agua y el puente tienen el suyo. */
const lotFor = (name: string): Lot => (name === "waterTower" ? { ...LOT, w: 6, d: 6 } : name === "footbridge" ? { ...LOT, w: 54, d: 5, z: -1 } : LOT);
/** Losas de arco del puente (las únicas piedras de fondo d − 0.4), de oeste a este. */
const slabs = (p: Piece, lot: Lot) =>
  p.solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && Math.abs(s.d - (lot.d - 0.4)) < EPS).sort((a, b) => a.at.x - b.at.x);

describe("kit: familia landmarks", () => {
  it("registra las siete recetas en el orden del issue, todas landmark", () => {
    const l = RECIPES.filter((r) => r.family === "landmarks");
    expect(l.map((r) => r.name)).toEqual(["market", "station", "theatre", "civicPalace", "library", "waterTower", "footbridge"]);
    expect(l.every((r) => r.landmark === true)).toBe(true);
  });

  it("cada receta publica landmarkTop en el punto más alto de la pieza, también achatada con maxH 10", () => {
    for (const def of RECIPES.filter((r) => r.family === "landmarks")) for (const maxH of [24, 10]) for (const id of STYLE_IDS) for (const seed of SEEDS) {
      const p = def.recipe({ ...lotFor(def.name), maxH }, createRng(seed), STYLES[id]);
      expect(p.landmarkTop, def.name).toBeDefined();
      expect(Math.abs(p.landmarkTop!.z - top(p)), def.name).toBeLessThanOrEqual(1e-6);
    }
  });

  it("mercado, estación, teatro y palacio tienen al menos una cúpula o una bóveda", () => {
    for (const name of ["market", "station", "theatre", "civicPalace"]) {
      const p = recipe(name)(LOT, createRng(1), STYLES.civico);
      expect(p.solids.some((s) => s.kind === "dome" || s.kind === "vault"), name).toBe(true);
    }
  });

  it("mercado: nave central con bóveda x w 9 h 3.5 de 8 segmentos sobre cuerpo h 5 arcade, dos naves con bóveda h 1.5 de 6, torre 3×3 h 14 con pirámide y reloj", () => {
    for (const lot of [LOT, LAB]) {
      const p = recipe("market")(lot, createRng(1), STYLES.ribera);
      const vaults = p.solids.filter((s): s is Solid & { kind: "vault" } => s.kind === "vault");
      expect(vaults.filter((v) => v.axis === "x" && v.w === 9 && v.h === 3.5 && v.segments === 8 && v.len === lot.w - 4)).toHaveLength(1);
      expect(vaults.filter((v) => v.axis === "x" && v.h === 1.5 && v.segments === 6)).toHaveLength(2);
      expect(p.solids.some((s) => s.kind === "prism" && s.h === 5 && s.facade?.base === "arcade")).toBe(true);
      const tower = p.solids.find((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.w === 3 && s.d === 3 && s.h === 14);
      expect(tower).toBeDefined();
      expect(p.solids.some((s) => s.kind === "cone" && s.sides === 4)).toBe(true);
      const clk = p.accents.find((a) => a.kind === "poly" && a.color === "amberBleed");
      expect(clk?.kind === "poly" && clk.pts.every((q) => Math.abs(q.y - (tower!.at.y + 3.02)) < EPS)).toBe(true);
    }
  });

  it("estación: hall 11 con bóveda y, cúpula r 4 h 3 de 12 lados y 3 anillos sobre tambor, dos alas h 4 con hip, reloj, marquesina h 0.4 de vuelo 2 al sur y cuatro faroles", () => {
    const p = recipe("station")(LOT, createRng(1), STYLES.centro);
    expect(p.solids.some((s) => s.kind === "prism" && s.w === 11 && s.h === 6 && !!s.facade)).toBe(true);
    expect(p.solids.filter((s) => s.kind === "vault" && s.axis === "y" && s.w === 11 && s.mat === STYLES.centro.roof).length).toBeGreaterThan(0);
    expect(p.solids.some((s) => s.kind === "dome" && s.r === 4 && s.h === 3 && s.sides === 12 && s.rings === 3)).toBe(true);
    expect(p.solids.some((s) => s.kind === "cylinder" && s.r === 4)).toBe(true);
    expect(p.solids.filter((s) => s.kind === "prism" && s.h === 4 && !!s.facade)).toHaveLength(2);
    expect(p.solids.filter((s) => s.kind === "prism" && s.roof === "hip")).toHaveLength(2);
    expect(p.accents.some((a) => a.kind === "poly" && a.color === "amberBleed")).toBe(true);
    const marquee = p.solids.filter((s) => s.kind === "ramp" && s.h === 0.4);
    expect(marquee).toHaveLength(1);
    expect(marquee[0]).toMatchObject({ dir: "s", d: 2 });
    expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toHaveLength(4);
  });

  it("estación: la marquesina va del lado open[0] y la pieza queda en el lote con cualquier frente", () => {
    for (const side of ["s", "e", "n", "w"] as const) for (const base of [LOT, LAB]) {
      const lot: Lot = { ...base, open: [side] }, p = recipe("station")(lot, createRng(1), STYLES.centro);
      expect(p.solids.find((s) => s.kind === "ramp" && s.h === 0.4)).toMatchObject({ dir: side });
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - 0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + 0.8 + EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - 0.8 - EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + 0.8 + EPS);
      }
    }
    expect(recipe("station")({ ...LOT, open: [] }, createRng(1), STYLES.centro).solids.find((s) => s.kind === "ramp" && s.h === 0.4)).toMatchObject({ dir: "s" });
  });

  it("teatro: tambor cylinder 12 lados r 6.5 h 9 con fachada cols 1, cúpula copper r 6.5 h 4, columnata marble 15×5 h 5 arcade cols 5, marquesina con cartel y escalinata", () => {
    for (const lot of [LOT, LAB]) {
      const p = recipe("theatre")(lot, createRng(1), STYLES.civico);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.sides === 12 && s.r === 6.5 && s.h === 9 && s.facade?.cols === 1)).toBe(true);
      expect(p.solids.some((s) => s.kind === "dome" && s.mat === "copper" && s.r === 6.5 && s.h === 4)).toBe(true);
      expect(p.solids.some((s) => s.kind === "prism" && s.mat === "marble" && s.h === 5 && s.facade?.base === "arcade" && s.facade.cols === 5 && Math.max(s.w, s.d) === 15 && Math.min(s.w, s.d) === 5)).toBe(true);
      expect(p.solids.filter((s) => s.kind === "ramp" && s.h === 0.4)).toHaveLength(1);
      expect(p.solids.filter((s) => s.kind === "ramp" && s.h === 1 && Math.min(s.w, s.d) === 2)).toHaveLength(1);
      expect(p.solids.some((s) => s.kind === "prism" && s.mat === "officeDark")).toBe(true);
      expect(p.accents.some((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });

  it("palacio cívico: poly de cinco vértices (chaflán) h 12 portico cols 5, cornisa h 1 con vuelo 0.8, cuatro hip, cúpula r 4 h 3.5 sobre tambor r 4 h 2, escalinata y dos faroles", () => {
    for (const lot of [LOT, LAB]) {
      const p = recipe("civicPalace")(lot, createRng(1), STYLES.civico);
      const body = p.solids.find((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.h === 12);
      expect(body?.footprint).toHaveLength(5);
      expect(body?.facade).toMatchObject({ base: "portico", cols: 5 });
      const cornice = p.solids.find((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.h === 1);
      expect(cornice).toBeDefined();
      const bb = bounds(body!), cb = bounds(cornice!);
      expect(bb.min.x - cb.min.x).toBeCloseTo(0.8, 9);
      expect(cb.max.y - bb.max.y).toBeCloseTo(0.8, 9);
      expect(p.solids.filter((s) => s.kind === "prism" && s.roof === "hip")).toHaveLength(4);
      expect(p.solids.some((s) => s.kind === "dome" && s.r === 4 && s.h === 3.5)).toBe(true);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.r === 4 && s.h === 2)).toBe(true);
      expect(p.solids.filter((s) => s.kind === "ramp")).toHaveLength(1);
      expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toHaveLength(2);
    }
  });

  it("biblioteca: tres alas marble arcade h 7 y pórtico h 4; publica courtyard sin sólidos adentro salvo árboles y baldosas", () => {
    for (const lot of [LOT, LAB]) for (const seed of SEEDS) {
      const p = recipe("library")(lot, createRng(seed), STYLES.civico), c = p.courtyard!;
      expect(c).toBeDefined();
      expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "marble" && s.h === 7 && s.facade?.base === "arcade")).toHaveLength(3);
      expect(p.solids.filter((s) => s.kind === "prism" && s.h === 4 && s.facade?.base === "portico")).toHaveLength(1);
      const inside = (s: Solid) => { const b = bounds(s); return b.max.x > c.x + EPS && b.min.x < c.x + c.w - EPS && b.max.y > c.y + EPS && b.min.y < c.y + c.d - EPS; };
      const trees = p.solids.filter((s) => s.kind === "cone" && s.mat === "leaf");
      expect(trees).toHaveLength(2);
      for (const s of p.solids) if (inside(s)) expect(trees).toContain(s);
      expect(p.ground.some((g) => g.kind === "ground" && inside(g))).toBe(true);
    }
  });

  it("torre de agua: cabe en 6×6 y en 5×5 (+0.8), mide ≤ 16, cuatro patas steel h 9, tanque cylinder 8 lados r 2.2 h 4, cúpula copper y baliza", () => {
    for (const [w, d] of [[6, 6], [5, 5]] as const) for (const id of STYLE_IDS) {
      const lot = { ...LOT, w, d }, p = recipe("waterTower")(lot, createRng(1), STYLES[id]);
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - 0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + w + 0.8 + EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - 0.8 - EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + d + 0.8 + EPS);
      }
      expect(top(p) - lot.z).toBeLessThanOrEqual(16);
      expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.w === 0.4 && s.d === 0.4 && s.h === 9)).toHaveLength(4);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.sides === 8 && s.r === 2.2 && s.h === 4 && s.mat === STYLES[id].mat)).toBe(true);
      expect(p.solids.some((s) => s.kind === "dome" && s.mat === "copper" && s.r === 2.2 && s.h === 1.2)).toBe(true);
      expect(p.accents.some((a) => a.kind === "dot" && a.at.z > top(p))).toBe(true);
    }
  });

  it("puente en 54×5 a z −1: tablero continuo de 54, cuatro pilas desde z −1, 18 losas de arco, max z ≤ lot.z + 4", () => {
    const lot = { ...LOT, x: 0, y: 0, w: 54, d: 5, z: -1 }, p = recipe("footbridge")(lot, createRng(1), STYLES.ribera);
    expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.w === 54 && s.d === 4 && s.h === 0.4 && Math.abs(s.at.z - 1.2) < EPS)).toHaveLength(1);
    expect(p.solids.filter((s) => s.kind === "prism" && s.w === 1.2 && s.d === 5 && s.at.z === -1 && Math.abs(s.h - 2.2) < EPS)).toHaveLength(4);
    expect(slabs(p, lot)).toHaveLength(18);
    expect(top(p)).toBeLessThanOrEqual(lot.z + 4 + EPS);
    expect(p.accents.length).toBeGreaterThan(0);
    expect(p.accents.every((a) => a.kind === "dot" && Math.abs(a.at.z - 2.4) < EPS && Math.abs(a.at.y - 4.35) < EPS)).toBe(true);
  });

  it("puente: el borde inferior de las losas es un arco derecho, simétrico en cada vano y más alto en la clave", () => {
    for (const [w, d] of [[54, 5], [40, 4], [60, 6]] as const) {
      const lot = { ...LOT, x: 0, y: 0, w, d, z: -1 }, s = slabs(recipe("footbridge")(lot, createRng(1), STYLES.ribera), lot);
      expect(s).toHaveLength(18);
      for (let v = 0; v < 3; v++) {
        const zs = s.slice(v * 6, v * 6 + 6).map((q) => q.at.z);
        for (let k = 0; k < 3; k++) expect(zs[k]).toBeCloseTo(zs[5 - k]!, 9);
        expect(zs[0]!).toBeLessThan(zs[1]!);
        expect(zs[1]!).toBeLessThan(zs[2]!);
        expect(zs[0]!).toBeGreaterThanOrEqual(lot.z);
      }
    }
  });
});
