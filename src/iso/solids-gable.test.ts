// src/iso/solids-gable.test.ts
import { describe, expect, it } from "vitest";
import { v3, type Vec3 } from "./geometry";
import { bounds, GABLE_RATIO, tessellate, tessellateAll, type Face, type Plate, type Solid } from "./solids";

type Prism = Solid & { kind: "prism" };
const WIDE: Prism = { kind: "prism", at: v3(0, 0, 0), w: 10, d: 4, h: 4, mat: "brick", roof: "gable" };
const DEEP: Prism = { ...WIDE, w: 4, d: 10 };
const plate = (wall: number, extra: Partial<Plate> = {}): Plate => ({ wall, shape: "rect", u0: 0.25, u1: 0.75, z0: 1, z1: 3, mat: "steel", ...extra });
const sloped = (f: Face) => Math.abs(f.normal.z) > 1e-6 && Math.abs(f.normal.z) < 1 - 1e-6;
const on = (f: Face, pred: (p: Vec3) => boolean) => f.pts.every(pred);

describe("gable without extras", () => {
  it("w >= d: base, north wall, south wall, west gable end, east gable end, north slope, south slope; all mat", () => {
    const all = tessellateAll(WIDE);
    expect(all).toHaveLength(7);
    expect(on(all[0]!, (p) => p.z === 0)).toBe(true);
    expect(on(all[1]!, (p) => p.y === 0) && all[1]!.pts.length === 4).toBe(true);
    expect(on(all[2]!, (p) => p.y === 4) && all[2]!.pts.length === 4).toBe(true);
    expect(on(all[3]!, (p) => p.x === 0) && all[3]!.pts.length === 5).toBe(true);
    expect(on(all[4]!, (p) => p.x === 10) && all[4]!.pts.length === 5).toBe(true);
    expect(sloped(all[5]!) && all[5]!.normal.y < 0).toBe(true);
    expect(sloped(all[6]!) && all[6]!.normal.y > 0).toBe(true);
    expect(all.every((f) => f.mat === "brick")).toBe(true);
  });

  it("w < d: base, west wall, east wall, north gable end, south gable end, west slope, east slope", () => {
    const all = tessellateAll(DEEP);
    expect(all).toHaveLength(7);
    expect(on(all[0]!, (p) => p.z === 0)).toBe(true);
    expect(on(all[1]!, (p) => p.x === 0) && all[1]!.pts.length === 4).toBe(true);
    expect(on(all[2]!, (p) => p.x === 4) && all[2]!.pts.length === 4).toBe(true);
    expect(on(all[3]!, (p) => p.y === 0) && all[3]!.pts.length === 5).toBe(true);
    expect(on(all[4]!, (p) => p.y === 10) && all[4]!.pts.length === 5).toBe(true);
    expect(sloped(all[5]!) && all[5]!.normal.x < 0).toBe(true);
    expect(sloped(all[6]!) && all[6]!.normal.x > 0).toBe(true);
    expect(all.every((f) => f.mat === "brick")).toBe(true);
  });

  it("empty plates gives the same as no plates", () => {
    expect(tessellateAll({ ...WIDE, plates: [] })).toEqual(tessellateAll(WIDE));
  });
});

describe("roofMat", () => {
  for (const [name, G] of [["w >= d", WIDE], ["w < d", DEEP]] as const) {
    it(`${name}: the two slopes come out in roofMat; walls, gable ends and base in mat`, () => {
      const all = tessellateAll({ ...G, roofMat: "tile" });
      const roof = all.filter(sloped);
      expect(roof).toHaveLength(2);
      expect(roof.every((f) => f.mat === "tile")).toBe(true);
      expect(all.filter((f) => !sloped(f)).every((f) => f.mat === "brick")).toBe(true);
      expect(all.find((f) => f.normal.z < -0.5)!.mat).toBe("brick"); // base
    });

    it(`${name}: roofMat only changes mat, not geometry or tone`, () => {
      const a = tessellateAll(G), b = tessellateAll({ ...G, roofMat: "tile" });
      expect(b.map(({ mat: _, ...f }) => f)).toEqual(a.map(({ mat: _, ...f }) => f));
    });
  }
});

describe("plates on gable", () => {
  const afterWall = (all: Face[], pred: (p: Vec3) => boolean, pts: number) => all.findIndex((f) => f.mat === "brick" && f.pts.length === pts && on(f, pred));

  it("w >= d: wall 1 comes after the east gable end, wall 2 after the south wall, with the normal and tone of its face", () => {
    const all = tessellateAll({ ...WIDE, plates: [plate(1, { mat: "glass" }), plate(2)] });
    expect(all).toHaveLength(9);
    const e = afterWall(all, (p) => p.x === 10, 5);
    const ge = all[e + 1]!;
    expect(ge.mat).toBe("glass");
    expect(ge.normal).toEqual(all[e]!.normal);
    expect(ge.tone).toBe(all[e]!.tone);
    expect(on(ge, (p) => p.x === 10)).toBe(true);
    const s = afterWall(all, (p) => p.y === 4, 4);
    const gs = all[s + 1]!;
    expect(gs.mat).toBe("steel");
    expect(gs.normal).toEqual(all[s]!.normal);
    expect(gs.tone).toBe(all[s]!.tone);
    expect(on(gs, (p) => p.y === 4)).toBe(true);
  });

  it("w < d: wall 0 comes after the north gable end, wall 1 after the east wall", () => {
    const all = tessellateAll({ ...DEEP, plates: [plate(0, { mat: "glass" }), plate(1)] });
    expect(all).toHaveLength(9);
    const n = afterWall(all, (p) => p.y === 0, 5);
    const gn = all[n + 1]!;
    expect(gn.mat).toBe("glass");
    expect(gn.normal).toEqual(all[n]!.normal);
    expect(gn.tone).toBe(all[n]!.tone);
    expect(on(gn, (p) => p.y === 0)).toBe(true);
    const e = afterWall(all, (p) => p.x === 4, 4);
    const ge = all[e + 1]!;
    expect(ge.mat).toBe("steel");
    expect(ge.normal).toEqual(all[e]!.normal);
    expect(ge.tone).toBe(all[e]!.tone);
    expect(on(ge, (p) => p.x === 4)).toBe(true);
  });

  it("w >= d: wall 0 after the north wall and wall 3 after the west gable end", () => {
    const all = tessellateAll({ ...WIDE, plates: [plate(3, { mat: "glass" }), plate(0)] });
    expect(on(all[afterWall(all, (p) => p.y === 0, 4) + 1]!, (p) => p.y === 0)).toBe(true);
    expect(all[afterWall(all, (p) => p.y === 0, 4) + 1]!.mat).toBe("steel");
    expect(all[afterWall(all, (p) => p.x === 0, 5) + 1]!.mat).toBe("glass");
  });

  it("a tri plate from eave to ridge covers exactly the east gable end's triangle", () => {
    const tri = plate(1, { shape: "tri", u0: 0, u1: 1, z0: 4, z1: 4 + 4 * GABLE_RATIO, mat: "stone" });
    const pl = tessellateAll({ ...WIDE, plates: [tri] }).find((f) => f.mat === "stone")!;
    expect(pl.pts).toHaveLength(3);
    const want = [v3(10, 0, 4), v3(10, 4, 4), v3(10, 2, 4 + 4 * GABLE_RATIO)];
    for (const w of want) expect(pl.pts.some((p) => Math.abs(p.x - w.x) < 1e-9 && Math.abs(p.y - w.y) < 1e-9 && Math.abs(p.z - w.z) < 1e-9)).toBe(true);
    const gableEast = tessellateAll(WIDE)[4]!;
    for (const w of want) expect(gableEast.pts.some((p) => Math.abs(p.x - w.x) < 1e-9 && Math.abs(p.y - w.y) < 1e-9 && Math.abs(p.z - w.z) < 1e-9)).toBe(true);
  });

  it("slopes and base take no plates; plates keep their mat even with roofMat", () => {
    const all = tessellateAll({ ...WIDE, roofMat: "tile", plates: [plate(2, { mat: "glass" })] });
    expect(all).toHaveLength(8);
    expect(all.filter((f) => f.mat === "glass")).toHaveLength(1);
    const i = all.findIndex((f) => f.mat === "glass");
    expect(sloped(all[i - 1]!)).toBe(false);
    expect(all[i - 1]!.mat).toBe("brick");
  });

  it("facade still does not apply to the gable, even with plates", () => {
    const plates = [plate(2)];
    expect(tessellateAll({ ...WIDE, plates, facade: { floors: 2, cols: 2 } })).toEqual(tessellateAll({ ...WIDE, plates }));
    expect(tessellateAll({ ...WIDE, facade: { floors: 2, cols: 2 } })).toEqual(tessellateAll(WIDE));
  });

  it("wall out of range: does not throw and emits no plate", () => {
    for (const wall of [4, -1, 1.5]) expect(tessellateAll({ ...WIDE, plates: [plate(wall)] })).toEqual(tessellateAll(WIDE));
  });

  it("tessellate keeps wall → plate on visible faces and drops the plate of a hidden face", () => {
    const vis = tessellate({ ...WIDE, plates: [plate(1, { mat: "glass" }), plate(2), plate(0, { mat: "stone" })] });
    const e = vis.findIndex((f) => f.mat === "brick" && f.pts.length === 5 && on(f, (p) => p.x === 10));
    expect(vis[e + 1]!.mat).toBe("glass");
    const s = vis.findIndex((f) => f.mat === "brick" && f.pts.length === 4 && on(f, (p) => p.y === 4));
    expect(vis[s + 1]!.mat).toBe("steel");
    expect(vis.some((f) => f.mat === "stone")).toBe(false);
  });

  it("bounds does not change with plates, even with one that sticks out past the ridge", () => {
    expect(bounds({ ...WIDE, plates: [plate(1), plate(2, { u0: -0.5, u1: 1.5, z1: 9 })] })).toEqual(bounds(WIDE));
    expect(bounds({ ...WIDE, roofMat: "tile" })).toEqual(bounds(WIDE));
  });
});
