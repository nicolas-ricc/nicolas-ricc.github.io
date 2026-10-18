import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { RECIPES, recipe } from "../index";
import { RECIPE_MAX_H } from "../piece";
import { STYLES } from "../styles";
import type { Lot, Side } from "../types";
import { chamferCorner } from "./composite";

const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const SMALL: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-6;
const withFacade = (ss: Solid[]) => ss.filter((s) => "facade" in s && s.facade);
const polys = (ss: Solid[]) => ss.flatMap((s) => (s.kind === "poly" ? [s] : []));

describe("kit: familia composite", () => {
  it("registra las cinco recetas en orden", () => {
    expect(RECIPES.filter((r) => r.family === "composite").map((r) => r.name)).toEqual(["podiumTower", "twinTowers", "decoStepped", "chamfer", "lTower"]);
  });

  it("entra en el lote mínimo 16×12 respetando el contrato", () => {
    for (const def of RECIPES.filter((r) => r.family === "composite")) for (const seed of SEEDS) {
      for (const s of def.recipe(SMALL, createRng(seed), STYLES.centro).solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(16.8 + EPS);
        expect(b.max.y).toBeLessThanOrEqual(12.8 + EPS);
        expect(b.max.z).toBeLessThanOrEqual(RECIPE_MAX_H + EPS);
      }
    }
  });

  it("con style.tone 2 ningún sólido pasa de tono 2", () => {
    for (const def of RECIPES.filter((r) => r.family === "composite")) for (const seed of SEEDS) {
      for (const s of def.recipe(LOT, createRng(seed), { ...STYLES.centro, tone: 2 }).solids) expect(s.tone ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it("podiumTower: el podio cubre el lote, la torre queda dentro del podio y el cartel sur solo con h ≥ 12", () => {
    for (const seed of SEEDS) {
      const p = recipe("podiumTower")(LOT, createRng(seed), STYLES.centro);
      const [podium, tower] = withFacade(p.solids);
      const pb = bounds(podium!), tb = bounds(tower!);
      expect(pb.min.x).toBeCloseTo(LOT.x, 6);
      expect(pb.min.y).toBeCloseTo(LOT.y, 6);
      expect(pb.max.x).toBeCloseTo(LOT.x + LOT.w, 6);
      expect(pb.max.y).toBeCloseTo(LOT.y + LOT.d, 6);
      expect(tb.min.x).toBeGreaterThanOrEqual(pb.min.x + 1 - EPS);
      expect(tb.min.y).toBeGreaterThanOrEqual(pb.min.y + 1 - EPS);
      expect(tb.max.x).toBeLessThanOrEqual(pb.max.x - 1 + EPS);
      expect(tb.max.y).toBeLessThanOrEqual(pb.max.y - 1 + EPS);
      expect(tb.min.z).toBeGreaterThanOrEqual(pb.max.z - EPS);
      for (const s of p.slots) expect(s).toMatchObject({ kind: "sign", side: "s", local: 0 });
    }
    expect(recipe("podiumTower")({ ...LOT, maxH: 10 }, createRng(1), STYLES.centro).slots).toEqual([]);
  });

  it("twinTowers: dos torres iguales ±1, el puente toca las dos a media altura y una sola antena", () => {
    for (const seed of SEEDS) {
      const p = recipe("twinTowers")(LOT, createRng(seed), STYLES.centro);
      const towers = withFacade(p.solids).map(bounds).sort((a, b) => a.min.x - b.min.x);
      expect(towers).toHaveLength(2);
      const [t0, t1] = towers as [(typeof towers)[0], (typeof towers)[0]];
      expect(Math.abs(t0.max.z - t1.max.z)).toBeLessThanOrEqual(1 + EPS);
      const bridge = p.solids.find((s) => s.kind === "prism" && s.h === 2);
      expect(bridge).toBeDefined();
      const bb = bounds(bridge!);
      expect(bb.min.x).toBeCloseTo(t0.max.x, 9);
      expect(bb.max.x).toBeCloseTo(t1.min.x, 9);
      expect(bb.max.x - bb.min.x).toBeCloseTo(3, 9);
      expect(bb.max.y - bb.min.y).toBeCloseTo(3, 9);
      expect(bb.min.z).toBeGreaterThan(0);
      expect(bb.max.z).toBeLessThanOrEqual(Math.min(t0.max.z, t1.max.z) + EPS);
      expect(p.solids.filter((s) => s.kind === "cylinder" && s.r === 0.2)).toHaveLength(1);
    }
  });

  it("decoStepped: tres poly con fachada de 8 vértices, apilados y de tono creciente, más un cono de 4 lados; total ≤ 18", () => {
    for (const seed of SEEDS) {
      const p = recipe("decoStepped")(LOT, createRng(seed), STYLES.centro);
      const tiers = polys(p.solids);
      expect(tiers).toHaveLength(3);
      for (const t of tiers) { expect(t.footprint).toHaveLength(8); expect(t.facade).toBeDefined(); }
      const cones = p.solids.filter((s) => s.kind === "cone");
      expect(cones).toHaveLength(1);
      expect(cones[0]).toMatchObject({ sides: 4, r: 1.5, h: 3 });
      for (let k = 1; k < 3; k++) {
        expect(tiers[k]!.z).toBeCloseTo(tiers[k - 1]!.z + tiers[k - 1]!.h, 9);
        expect(tiers[k]!.tone ?? 0).toBeGreaterThan(tiers[k - 1]!.tone ?? 0);
      }
      expect(Math.max(...p.solids.map((s) => bounds(s).max.z))).toBeLessThanOrEqual(18 + EPS);
    }
  });

  it("chamferCorner: la esquina sobre open[0], hacia la otra calle abierta o hacia la cámara; SE sin open", () => {
    expect(chamferCorner(["s", "e"])).toBe("se");
    expect(chamferCorner(["s", "w"])).toBe("sw");
    expect(chamferCorner(["s"])).toBe("se");
    expect(chamferCorner(["n"])).toBe("ne");
    expect(chamferCorner(["e"])).toBe("se");
    expect(chamferCorner(["w", "n"])).toBe("nw");
    expect(chamferCorner([])).toBe("se");
  });

  it("chamfer: un poly de 5 vértices con fachada cuya esquina cortada mira al lado open, cornisa agrandada 0.5 y sala de máquinas", () => {
    const facing: Record<Side, (n: { x: number; y: number }) => boolean> = { s: (n) => n.y > 0, n: (n) => n.y < 0, e: (n) => n.x > 0, w: (n) => n.x < 0 };
    const opens: Side[][] = [["s"], ["n"], ["e"], ["w"], ["s", "e"]];
    for (const open of opens) for (const seed of SEEDS.slice(0, 5)) {
      const p = recipe("chamfer")({ ...LOT, open }, createRng(seed), STYLES.centro);
      const body = polys(p.solids).find((s) => s.facade);
      expect(body).toBeDefined();
      const fp = body!.footprint;
      expect(fp).toHaveLength(5);
      // el lado cortado es el único que no es paralelo a un eje
      const i = fp.findIndex((a, k) => { const b = fp[(k + 1) % 5]!; return a.x !== b.x && a.y !== b.y; });
      const a = fp[i]!, b = fp[(i + 1) % 5]!;
      const n = { x: b.y - a.y, y: a.x - b.x }; // normal hacia afuera en el orden canónico
      expect(facing[open[0]!](n)).toBe(true);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(4 * Math.SQRT2, 9);
      expect(polys(p.solids).find((s) => !s.facade)).toMatchObject({ h: 0.4, mat: STYLES.centro.trim, z: body!.z + body!.h });
      expect(p.solids.some((s) => s.kind === "prism" && s.w === 4 && s.d === 3 && s.h === 2)).toBe(true);
    }
  });

  it("lTower: ala L de 6 vértices con fachada, torre 8×8 sobre el codo con baliza, y el hueco de la L vacío", () => {
    for (const lot of [LOT, SMALL]) for (const seed of SEEDS) {
      const p = recipe("lTower")(lot, createRng(seed), STYLES.centro);
      const wing = polys(p.solids)[0];
      expect(wing).toBeDefined();
      expect(wing!.footprint).toHaveLength(6);
      expect(wing!.facade).toBeDefined();
      const hole = { x0: lot.x + 8, y0: lot.y + 8, x1: lot.x + lot.w, y1: lot.y + lot.d };
      for (const s of p.solids) {
        if (s === wing) continue;
        const b = bounds(s);
        expect(b.max.x > hole.x0 + EPS && b.min.x < hole.x1 - EPS && b.max.y > hole.y0 + EPS && b.min.y < hole.y1 - EPS).toBe(false);
      }
      const tower = p.solids.find((s) => s.kind === "prism" && s.facade);
      expect(tower).toMatchObject({ w: 8, d: 8, at: { x: lot.x, y: lot.y } });
      expect(tower!.kind === "prism" && tower!.at.z).toBeCloseTo(wing!.z + wing!.h + 0.4, 9);
      expect(p.accents.some((a) => a.kind === "dot" && a.color === "amberMid")).toBe(true);
    }
  });
});
