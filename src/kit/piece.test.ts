import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { bounds } from "../iso/solids";
import { PLINTH_H, prism } from "../scenes/city-pieces";
import { createRng } from "../map/seed";
import { LAB_LOTS, RECIPES } from "./index";
import { emptyPiece, fitToCap, interlock, liftPiece, seat, shiftTone } from "./piece";
import { STYLES } from "./styles";
import type { Lot, Piece, Recipe } from "./types";

const LOT: Lot = { x: 0, y: 0, w: 10, d: 10, z: 2, open: ["s"], maxH: 10 };

describe("fitToCap", () => {
  it("a piece that fits within the cap comes out unchanged", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 2, 4, 4, 8, "stone"));
    expect(fitToCap(p, LOT)).toEqual(p);
  });

  it("a piece taller than the cap is flattened in z relative to lot.z: solids, accents, walls and landmarkTop", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 2, 4, 4, 20, "stone"), { kind: "dome", at: v3(2, 2, 22), r: 2, h: 0, mat: "copper" });
    p.accents.push({ kind: "dot", at: v3(1, 1, 12), r: 0.5, color: "amber" });
    p.walls.push({ pts: [v3(4, 0, 2), v3(4, 4, 2), v3(4, 4, 22), v3(4, 0, 22)], normal: v3(1, 0, 0), floorH: 4, building: 0 });
    p.landmarkTop = v3(2, 2, 22);
    const q = fitToCap(p, LOT);
    expect(Math.max(...q.solids.map((s) => bounds(s).max.z))).toBeCloseTo(12, 9);
    expect(q.solids[0]).toMatchObject({ at: { x: 0, y: 0, z: 2 }, h: 10 });
    expect(q.accents[0]).toMatchObject({ at: { x: 1, y: 1, z: 7 }, r: 0.5 });
    expect(q.walls[0]!.pts.map((p) => p.z)).toEqual([2, 2, 12, 12]);
    expect(q.walls[0]!.floorH).toBeCloseTo(2, 9);
    expect(q.walls[0]!.normal).toEqual(v3(1, 0, 0));
    expect(q.landmarkTop!.z).toBeCloseTo(12, 9);
  });
});

describe("piece", () => {
  it("shiftTone adds and clamps to −2..+2", () => {
    expect(shiftTone(0, 1)).toBe(1);
    expect(shiftTone(2, 1)).toBe(2);
    expect(shiftTone(-2, -1)).toBe(-2);
    expect(shiftTone(1, 2)).toBe(2);
  });
});

const rounded = (v: unknown): string => JSON.stringify(v, (_, x) => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x));

describe("seat", () => {
  it("liftPiece matches the recipe run PLINTH_H higher, for every recipe", () => {
    for (const def of RECIPES) for (const seed of [1, 2, 3]) {
      const own = LAB_LOTS[def.name];
      const lot: Lot = { x: 0, y: 0, w: own?.w ?? 24, d: own?.d ?? 18, z: own?.z ?? 0, open: ["s", "e"], maxH: 24 };
      const lifted = liftPiece(def.recipe(lot, createRng(seed), STYLES.downtown), PLINTH_H);
      expect(rounded(lifted), def.name).toBe(rounded(def.recipe({ ...lot, z: lot.z + PLINTH_H }, createRng(seed), STYLES.downtown)));
    }
  });

  it("liftPiece does not move normals and does not mutate its input", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 0, 4, 4, 6, "stone"));
    p.accents.push({ kind: "dot", at: v3(1, 1, 3), r: 0.5, color: "amber" });
    p.windows.push({ pts: [v3(4, 1, 1), v3(4, 2, 1), v3(4, 2, 2), v3(4, 1, 2)], floor: 0, wall: v3(1, 0, 0), building: 0 });
    p.walls.push({ pts: [v3(4, 0, 0), v3(4, 4, 0), v3(4, 4, 6), v3(4, 0, 6)], normal: v3(1, 0, 0), floorH: 3, building: 0 });
    p.slots.push({ pts: [v3(1, 4.4, 2), v3(3, 4.4, 2), v3(3, 4.4, 3.6), v3(1, 4.4, 3.6)], wall: v3(0, 1, 0), side: "s", kind: "neon", shop: 0 });
    const before = structuredClone(p);
    const q = liftPiece(p, 2);
    expect(p).toEqual(before);
    expect(q.windows[0]!.wall).toEqual(v3(1, 0, 0));
    expect(q.walls[0]!.normal).toEqual(v3(1, 0, 0));
    expect(q.slots[0]!.wall).toEqual(v3(0, 1, 0));
    expect(q.solids[0]).toMatchObject({ at: { z: 2 }, h: 6 });
    expect(q.accents[0]).toMatchObject({ at: { z: 5 } });
    expect(q.walls[0]!.pts.map((v) => v.z)).toEqual([2, 2, 8, 8]);
    expect(q.walls[0]!.floorH).toBe(3);
  });

  const STREET: Lot = { x: 0, y: 0, w: 10, d: 10, z: 0, open: ["s"], maxH: 10 };
  const counting = (withGround: boolean): { recipe: Recipe; calls: () => number } => {
    let n = 0;
    const recipe: Recipe = (l) => {
      n++;
      const p: Piece = emptyPiece();
      p.solids.push(prism(l.x, l.y, l.z, 4, 4, 6, "stone"));
      if (withGround) p.ground.push(prism(l.x, l.y, l.z + 0.05, 4, 4, 0, "paving"));
      return p;
    };
    return { recipe, calls: () => n };
  };

  it("a piece without ground comes out lifted exactly PLINTH_H, on a plinth", () => {
    const { recipe, calls } = counting(false);
    const s = seat(recipe, STREET, createRng(1), STYLES.downtown);
    expect(calls()).toBe(1);
    expect(s.plinth).toBe(true);
    expect(s.lot).toEqual({ ...STREET, z: PLINTH_H });
    expect(s.piece.solids[0]).toMatchObject({ at: { z: PLINTH_H } });
  });

  it("a piece with ground stays at street level, without plinth", () => {
    const { recipe, calls } = counting(true);
    const s = seat(recipe, STREET, createRng(1), STYLES.downtown);
    expect(calls()).toBe(1);
    expect(s.plinth).toBe(false);
    expect(s.lot).toBe(STREET);
    expect(s.piece.solids[0]).toMatchObject({ at: { z: 0 } });
  });

  it("interlock marks a copy and keeps the rest", () => {
    const s = prism(0, 0, 0, 1, 1, 1, "stone"), m = interlock(s);
    expect(m).toMatchObject(s);
    expect(m.interlocks).toBe(true);
    expect(s.interlocks).toBeUndefined();
  });
});
