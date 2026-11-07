import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { centroid, v3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { antenna, awning, beacon, bench, bollard, car, chair, clock, container, dockCrane, fence, fountain, garland, helipad, kiosk, lamp, machineRoom, neon, patioTree, puddle, roofShrub, rooftopGarden, sign, solarPanel, stoneArch, ARCH_SLABS, streetTree, table, trafficLight, waterTank } from "./props";

const AT = v3(10, 20, 0.3);
const size = (s: Solid) => { const b = bounds(s); return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((n) => Math.round(n * 100) / 100); };
const only = (ss: Solid[]) => { expect(ss).toHaveLength(1); return ss[0]!; };

describe("props", () => {
  it("lamp: steel post 0.6×0.6×5 and amber bulb r 0.6 on top of the post", () => {
    const l = lamp(AT);
    expect(only(l.solids)).toMatchObject({ kind: "prism", at: AT, w: 0.6, d: 0.6, h: 5, mat: "steel" });
    const bulb = v3(AT.x + 0.3, AT.y + 0.3, AT.z + 5);
    expect(l.accents).toEqual([{ kind: "dot", at: bulb, r: 0.6, color: "amber" }]);
    expect(l.bulb).toEqual(bulb);
  });

  it("traffic light: post 0.3×0.3×4 and officeDark box 0.5×0.5×1.2 on top", () => {
    const [post, box] = trafficLight(AT);
    expect(post).toMatchObject({ kind: "prism", w: 0.3, d: 0.3, h: 4, mat: "steel" });
    expect(box).toMatchObject({ kind: "prism", at: v3(AT.x - 0.1, AT.y - 0.1, AT.z + 4), w: 0.5, d: 0.5, h: 1.2, mat: "officeDark" });
  });

  it("car: a single size 3×1.5×1.2, steel or rust", () => {
    for (const mat of ["steel", "rust"] as const) expect(only(car(AT, mat))).toMatchObject({ kind: "prism", at: AT, w: 3, d: 1.5, h: 1.2, mat });
  });

  it("bench, table, chair of paving", () => {
    expect(only(bench(AT))).toMatchObject({ w: 2, d: 0.6, h: 0.5, mat: "paving" });
    expect(only(table(AT))).toMatchObject({ w: 1, d: 1, h: 0.7, mat: "paving" });
    expect(only(chair(AT))).toMatchObject({ w: 0.5, d: 0.5, h: 0.5, mat: "paving" });
  });

  it("bollard, trees and terrace shrub", () => {
    expect(only(bollard(AT))).toEqual({ kind: "cylinder", at: AT, r: 0.4, h: 0.8, mat: "rust", sides: 6 });
    expect(only(streetTree(AT))).toEqual({ kind: "cone", at: AT, r: 1.5, h: 4, mat: "leaf" });
    expect(only(patioTree(AT))).toEqual({ kind: "cone", at: AT, r: 1, h: 2.5, mat: "leaf" });
    expect(only(roofShrub(AT))).toEqual({ kind: "cone", at: AT, r: 1.2, h: 2.5, mat: "leaf" });
  });

  it("awning: awning ramp with 0.8 overhang and 0.4 height toward the street", () => {
    expect(only(awning(AT, 5, "s"))).toEqual({ kind: "ramp", at: AT, w: 5, d: 0.8, h: 0.4, mat: "awning", dir: "s" });
    expect(only(awning(AT, 5, "e"))).toEqual({ kind: "ramp", at: AT, w: 0.8, d: 5, h: 0.4, mat: "awning", dir: "e" });
  });

  it("kiosk: officeDark box 2×2×2.4 and terracotta hip roof of 0.8", () => {
    const [box, roof] = kiosk(AT);
    expect(box).toMatchObject({ kind: "prism", at: AT, w: 2, d: 2, h: 2.4, mat: "officeDark" });
    expect(roof).toMatchObject({ kind: "prism", at: v3(AT.x, AT.y, AT.z + 2.4), w: 2, d: 2, h: 0.8, mat: "terracotta", roof: "hip" });
  });

  it("sign: officeDark box and an amber poly coplanar in y, in front of the box", () => {
    const s = sign(AT, 4, 1.2);
    expect(only(s.solids)).toMatchObject({ kind: "prism", at: AT, w: 4, d: 0.4, h: 1.2, mat: "officeDark" });
    expect(s.accents).toHaveLength(1);
    const a = s.accents[0]!;
    if (a.kind !== "poly") throw new Error("sign not poly");
    expect(a.color).toBe("amber");
    expect(new Set(a.pts.map((p) => p.y))).toEqual(new Set([AT.y + 0.42]));
  });

  it("sign facing east: box of 0.4 in x, w along y, panel coplanar in x in front of the box", () => {
    const s = sign(AT, 4, 1.2, "e");
    expect(only(s.solids)).toMatchObject({ kind: "prism", at: AT, w: 0.4, d: 4, h: 1.2, mat: "officeDark" });
    const a = s.accents[0]!;
    if (a.kind !== "poly") throw new Error("sign not poly");
    expect(new Set(a.pts.map((p) => p.x))).toEqual(new Set([AT.x + 0.42]));
    expect(Math.min(...a.pts.map((p) => p.y))).toBeCloseTo(AT.y + 0.3, 9);
    expect(Math.max(...a.pts.map((p) => p.y))).toBeCloseTo(AT.y + 4 - 0.3, 9);
  });

  it("clock: amberBleed octagon with alpha 0.9 and radius 1.2, 0.02 in front of the south face", () => {
    const c = clock(5, 10, 3);
    if (c.kind !== "poly") throw new Error("clock not poly");
    expect(c).toMatchObject({ color: "amberBleed", alpha: 0.9 });
    expect(c.pts).toHaveLength(8);
    expect(new Set(c.pts.map((p) => p.y))).toEqual(new Set([10.02]));
    for (const p of c.pts) expect(Math.hypot(p.x - 5, p.z - 3)).toBeCloseTo(1.2, 9);
  });

  it("neon: two polys, Bleed halo 1.3× the front and behind it (further west and north)", () => {
    const front = [v3(0, 5, 1), v3(2, 5, 1), v3(2, 5, 2), v3(0, 5, 2)];
    const [halo, tube] = neon(front, "magenta") as [Accent & { kind: "poly" }, Accent & { kind: "poly" }];
    expect(tube).toMatchObject({ kind: "poly", pts: front, color: "magenta" });
    expect(halo.color).toBe("magentaBleed");
    const span = (pts: { x: number }[]) => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    expect(span(halo.pts)).toBeCloseTo(1.3 * span(tube.pts), 9);
    const ch = centroid(halo.pts), ct = centroid(tube.pts);
    expect(ch.x).toBeLessThan(ct.x);
    expect(ch.y).toBeLessThan(ct.y);
  });

  it("fountain: marble basin r 3 h 0.6, spout r 0.6 h 1.5 and amberBleed puddle on the water", () => {
    const f = fountain(AT);
    expect(f.solids[0]).toMatchObject({ kind: "cylinder", at: AT, r: 3, h: 0.6, mat: "marble" });
    expect(f.solids[1]).toMatchObject({ kind: "cylinder", at: v3(AT.x, AT.y, AT.z + 0.6), r: 0.6, h: 1.5, mat: "marble" });
    expect(f.accents.length).toBe(3);
    for (const a of f.accents) expect(a.kind === "poly" && a.color === "amberBleed" && a.pts.every((p) => Math.abs(p.z - (AT.z + 0.6)) < 1e-9)).toBe(true);
    expect(f.accents.every((a) => a.kind === "poly" && a.alpha === 0.35)).toBe(true); // not confused with the tower's puddles (0.25)
  });

  it("puddle: the alpha can be requested", () => {
    expect(puddle(0, 0, "amberBleed", 0.12, 0.5).every((a) => a.kind === "poly" && a.alpha === 0.5)).toBe(true);
  });

  it("puddle: three concentric octagons of radius 2.5, 1.8 and 1.2 at z 0.12, alpha 0.25, of the requested color", () => {
    const p = puddle(4, 6, "cyanBleed");
    expect(p).toHaveLength(3);
    p.forEach((a, i) => {
      if (a.kind !== "poly") throw new Error("puddle not poly");
      expect(a.pts).toHaveLength(8);
      expect(a.color).toBe("cyanBleed");
      expect(a.alpha).toBe(0.25);
      expect(Math.max(...a.pts.map((q) => Math.hypot(q.x - 4, q.y - 6)))).toBeCloseTo([2.5, 1.8, 1.2][i]!, 9);
      expect(a.pts.every((q) => q.z === 0.12)).toBe(true);
    });
  });

  it("roof details with today's measures", () => {
    const tank = waterTank(AT);
    expect(tank.filter((s) => s.kind === "prism")).toHaveLength(4);
    for (const leg of tank.slice(0, 4)) expect(leg).toMatchObject({ w: 0.3, d: 0.3, h: 1.1, mat: "steel" }); // 1.1: not a car
    expect(tank[4]).toEqual({ kind: "cylinder", at: v3(AT.x, AT.y, AT.z + 1.1), r: 1.2, h: 2, mat: "rust", sides: 6 });
    expect(only(machineRoom(AT))).toMatchObject({ kind: "prism", at: AT, w: 4, d: 3, h: 2, mat: "officeDark" });
    expect(only(antenna(AT))).toEqual({ kind: "cylinder", at: AT, r: 0.2, h: 4, mat: "steel", sides: 4 });
    const hp = helipad(AT);
    expect(only(hp.solids)).toEqual({ kind: "cylinder", at: AT, r: 3, h: 0.3, mat: "paving", sides: 8 });
    expect(hp.accents).toEqual([{ kind: "dot", at: v3(AT.x, AT.y, AT.z + 0.3), r: 0.6, color: "amberMid" }]);
    expect(beacon(AT)).toEqual({ solids: [], accents: [{ kind: "dot", at: AT, r: 0.5, color: "amberMid" }] });
  });

  it("green terrace: leafDark slab of 0.3 and 3..5 cones r 1 h 2 inside the slab", () => {
    const g = rooftopGarden(AT, 8, 6, createRng(3));
    expect(g[0]).toMatchObject({ kind: "prism", at: AT, w: 8, d: 6, h: 0.3, mat: "leafDark" });
    const cones = g.slice(1);
    expect(cones.length).toBeGreaterThanOrEqual(3);
    expect(cones.length).toBeLessThanOrEqual(5);
    for (const c of cones) {
      expect(c).toMatchObject({ kind: "cone", r: 1, h: 2, mat: "leaf" });
      if (c.kind !== "cone") throw new Error("not a cone");
      expect(c.at.z).toBeCloseTo(AT.z + 0.3, 9);
      expect(c.at.x).toBeGreaterThanOrEqual(11);
      expect(c.at.x).toBeLessThanOrEqual(17);
    }
  });

  it("solar panel, fence and container", () => {
    expect(only(solarPanel(AT))).toEqual({ kind: "ramp", at: AT, w: 3, d: 1.6, h: 0.5, mat: "glass", dir: "s" });
    const f = fence(AT, 21, 15);
    expect(f).toHaveLength(4);
    for (const s of f) expect(s).toMatchObject({ kind: "prism", h: 1.2, mat: "officeDark" });
    const b = f.map(bounds);
    expect(Math.min(...b.map((q) => q.min.x))).toBe(10);
    expect(Math.max(...b.map((q) => q.max.x))).toBe(31);
    expect(Math.max(...b.map((q) => q.max.y))).toBe(35);
    expect(only(container(AT))).toMatchObject({ kind: "prism", at: AT, w: 6, d: 2.4, h: 2.4, mat: "rust" });
  });

  it("garland: amber dots r 0.25 every 1.5 along the polyline, at its height", () => {
    const g = garland([v3(0, 0, 3), v3(6, 0, 3)]);
    expect(g).toHaveLength(5);
    g.forEach((a, i) => expect(a).toEqual({ kind: "dot", at: v3(1.5 * i, 0, 3), r: 0.25, color: "amber" }));
  });

  it("dock crane: steel mast 1×1×6 and jib 6×0.6×0.5 toward the requested side", () => {
    const [mast, jib] = dockCrane(AT, "w");
    expect(size(mast!)).toEqual([1, 1, 6]);
    expect(mast).toMatchObject({ mat: "steel", at: AT });
    expect(size(jib!)).toEqual([6, 0.6, 0.5]);
    expect(bounds(jib!).max.z).toBeCloseTo(AT.z + 6, 9);
    expect(bounds(jib!).max.x).toBeCloseTo(11, 9);  // to the west: ends over the mast
    expect(bounds(dockCrane(AT, "e")[1]!).min.x).toBeCloseTo(10, 9);
  });
});

describe("stoneArch", () => {
  it("six stone slabs from end to end, centered in y, from the profile to the top", () => {
    const slabs = stoneArch(10, 20, 12, 5, 3, (s) => 3 - 2 * s);
    expect(slabs).toHaveLength(ARCH_SLABS);
    slabs.forEach((sl, k) => {
      if (sl.kind !== "prism") throw new Error("slab not prism");
      expect(sl.mat).toBe("stone");
      expect(sl.at.x).toBeCloseTo(10 + k * 2, 9);
      expect(sl.w).toBeCloseTo(2, 9);
      expect(sl.at.y).toBeCloseTo(20.2, 9);
      expect(sl.d).toBeCloseTo(4.6, 9);
      expect(sl.at.z).toBeCloseTo(3 - 2 * Math.sin((Math.PI * (k + 0.5)) / 6), 9);
      expect(sl.at.z + sl.h).toBeCloseTo(3, 9);
    });
  });
});
