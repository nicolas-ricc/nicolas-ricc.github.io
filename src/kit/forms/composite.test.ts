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

describe("kit: composite family", () => {
  it("registers the five recipes in order", () => {
    expect(RECIPES.filter((r) => r.family === "composite").map((r) => r.name)).toEqual(["podiumTower", "twinTowers", "decoStepped", "chamfer", "lTower"]);
  });

  it("fits in the minimum 16×12 lot respecting the contract", () => {
    for (const def of RECIPES.filter((r) => r.family === "composite")) for (const seed of SEEDS) {
      for (const s of def.recipe(SMALL, createRng(seed), STYLES.downtown).solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(16.8 + EPS);
        expect(b.max.y).toBeLessThanOrEqual(12.8 + EPS);
        expect(b.max.z).toBeLessThanOrEqual(RECIPE_MAX_H + EPS);
      }
    }
  });

  it("with style.tone 2 no solid goes past tone 2", () => {
    for (const def of RECIPES.filter((r) => r.family === "composite")) for (const seed of SEEDS) {
      for (const s of def.recipe(LOT, createRng(seed), { ...STYLES.downtown, tone: 2 }).solids) expect(s.tone ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it("podiumTower: the podium covers the lot, the tower sits inside the podium and the south sign only with h ≥ 12", () => {
    for (const seed of SEEDS) {
      const p = recipe("podiumTower")(LOT, createRng(seed), STYLES.downtown);
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
      for (const s of p.slots) expect(s).toMatchObject({ kind: "sign", side: "s", shop: 0 });
    }
    expect(recipe("podiumTower")({ ...LOT, maxH: 10 }, createRng(1), STYLES.downtown).slots).toEqual([]);
  });

  it("podiumTower with maxH 10: the tower has at least 3 of body", () => {
    for (const lot of [LOT, SMALL]) for (const seed of SEEDS) {
      const [, tower] = withFacade(recipe("podiumTower")({ ...lot, maxH: 10 }, createRng(seed), STYLES.downtown).solids);
      if (!tower || tower.kind !== "prism") throw new Error("no tower");
      expect(tower.h).toBeGreaterThanOrEqual(3 - 1e-9);
    }
  });

  it("twinTowers: two equal towers (±1), the bridge touches both at mid height and a single antenna", () => {
    for (const seed of SEEDS) {
      const p = recipe("twinTowers")(LOT, createRng(seed), STYLES.downtown);
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

  it("decoStepped: three 8-vertex poly with a facade, stacked and of increasing tone, plus a 4-sided cone; total ≤ 18", () => {
    for (const seed of SEEDS) {
      const p = recipe("decoStepped")(LOT, createRng(seed), STYLES.downtown);
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

  it("decoStepped: the tone grows from body to body also with style.tone 1 and -1", () => {
    for (const tone of [-1, 1]) {
      const tiers = polys(recipe("decoStepped")(LOT, createRng(1), { ...STYLES.downtown, tone }).solids);
      for (let k = 1; k < 3; k++) expect(tiers[k]!.tone ?? 0).toBeGreaterThan(tiers[k - 1]!.tone ?? 0);
    }
  });

  it("chamferCorner: the corner on open[0], toward the other open street or toward the camera; SE without open", () => {
    expect(chamferCorner(["s", "e"])).toBe("se");
    expect(chamferCorner(["s", "w"])).toBe("sw");
    expect(chamferCorner(["s"])).toBe("se");
    expect(chamferCorner(["n"])).toBe("ne");
    expect(chamferCorner(["e"])).toBe("se");
    expect(chamferCorner(["w", "n"])).toBe("nw");
    expect(chamferCorner([])).toBe("se");
  });

  it("chamfer: a 5-vertex poly with a facade whose cut corner faces the open side, cornice enlarged by 0.5 and a machine room", () => {
    const facing: Record<Side, (n: { x: number; y: number }) => boolean> = { s: (n) => n.y > 0, n: (n) => n.y < 0, e: (n) => n.x > 0, w: (n) => n.x < 0 };
    const opens: Side[][] = [["s"], ["n"], ["e"], ["w"], ["s", "e"]];
    for (const open of opens) for (const seed of SEEDS.slice(0, 5)) {
      const p = recipe("chamfer")({ ...LOT, open }, createRng(seed), STYLES.downtown);
      const body = polys(p.solids).find((s) => s.facade);
      expect(body).toBeDefined();
      const fp = body!.footprint;
      expect(fp).toHaveLength(5);
      // the cut side is the only one that is not parallel to an axis
      const i = fp.findIndex((a, k) => { const b = fp[(k + 1) % 5]!; return a.x !== b.x && a.y !== b.y; });
      const a = fp[i]!, b = fp[(i + 1) % 5]!;
      const n = { x: b.y - a.y, y: a.x - b.x }; // outward normal in the canonical order
      expect(facing[open[0]!](n)).toBe(true);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(4 * Math.SQRT2, 9);
      expect(polys(p.solids).find((s) => !s.facade)).toMatchObject({ h: 0.4, mat: STYLES.downtown.trim, z: body!.z + body!.h });
      expect(p.solids.some((s) => s.kind === "prism" && s.w === 4 && s.d === 3 && s.h === 2)).toBe(true);
    }
  });

  it("lTower: 6-vertex L wing with a facade, 8×8 tower on the elbow with a beacon, and the gap of the L empty", () => {
    for (const lot of [LOT, SMALL]) for (const seed of SEEDS) {
      const p = recipe("lTower")(lot, createRng(seed), STYLES.downtown);
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
