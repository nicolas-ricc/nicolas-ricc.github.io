// src/iso/solids.test.ts
import { describe, expect, it } from "vitest";
import { facadeFaces } from "./facade";
import { dot, v3, type Vec3 } from "./geometry";
import { shadeTone } from "./light";
import { bounds, GABLE_RATIO, isFlat, tessellate, tessellateAll, WHEEL_NORMAL, WHEEL_U, type Face, type Plate, type Solid } from "./solids";

const prism: Solid = { kind: "prism", at: v3(0, 0, 0), w: 2, d: 3, h: 4, mat: "concrete" };

function inside(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

const mean = (pts: { x: number; y: number }[], k: "x" | "y"): number => pts.reduce((a, p) => a + p[k], 0) / pts.length;

describe("tessellate", () => {
  it("a prism emits 6 faces in total and 3 visible: roof, south, east", () => {
    expect(tessellateAll(prism)).toHaveLength(6);
    const vis = tessellate(prism);
    expect(vis.map((f) => f.tone).sort()).toEqual(["lit", "shade", "top"]);
    const top = vis.find((f) => f.tone === "top")!;
    expect(top.pts.every((p) => p.z === 4)).toBe(true);
    const south = vis.find((f) => f.tone === "lit")!;
    expect(south.pts.every((p) => p.y === 3)).toBe(true);
    const east = vis.find((f) => f.tone === "shade")!;
    expect(east.pts.every((p) => p.x === 2)).toBe(true);
    expect(vis.every((f) => f.mat === "concrete" && f.toneOffset === 0)).toBe(true);
  });

  it("normals point outward regardless of vertex order", () => {
    for (const f of tessellateAll(prism)) {
      const c = { x: 1, y: 1.5, z: 2 };
      const fc = { x: f.pts.reduce((s, p) => s + p.x, 0) / f.pts.length, y: f.pts.reduce((s, p) => s + p.y, 0) / f.pts.length, z: f.pts.reduce((s, p) => s + p.z, 0) / f.pts.length };
      expect(f.normal.x * (fc.x - c.x) + f.normal.y * (fc.y - c.y) + f.normal.z * (fc.z - c.z)).toBeGreaterThan(0);
    }
  });

  it("gable roof: two slopes (up/down) and the gable ends as pentagons", () => {
    const vis = tessellate({ ...prism, w: 10, d: 4, roof: "gable" });
    expect(vis.map((f) => f.tone)).toContain("up");
    expect(vis.map((f) => f.tone)).toContain("down");
    const east = vis.find((f) => f.pts.every((p) => p.x === 10))!;
    expect(east.pts).toHaveLength(5);
    expect(Math.max(...east.pts.map((p) => p.z))).toBeCloseTo(4 + 0.35 * 4);
  });

  it("stepped roof: the box plus a smaller second level on top", () => {
    const all = tessellateAll({ ...prism, w: 10, d: 10, roof: "step" });
    expect(all).toHaveLength(12);
    const tops = all.filter((f) => f.tone === "top").map((f) => f.pts[0]!.z).sort();
    expect(tops).toEqual([4, 4 + 4 * 0.35]);
  });

  it("ramp toward the east: the top descends from west to east", () => {
    const vis = tessellate({ kind: "ramp", at: v3(0, 0, 0), w: 10, d: 4, h: 2, mat: "concrete", dir: "e" });
    const top = vis.find((f) => f.normal.z > 0.5)!;
    const west = top.pts.filter((p) => p.x === 0), east = top.pts.filter((p) => p.x === 10);
    expect(west.every((p) => p.z === 2)).toBe(true);
    expect(east.every((p) => p.z === 0)).toBe(true);
  });

  it("poly: prism over a 5-vertex footprint, roof + 5 sides, only the visible ones", () => {
    const footprint = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 4 }];
    const s: Solid = { kind: "poly", footprint, z: 1, h: 3, mat: "rock" };
    expect(tessellateAll(s)).toHaveLength(7);
    const vis = tessellate(s);
    const top = vis.find((f) => f.tone === "top")!;
    expect(top.pts).toHaveLength(5);
    expect(top.pts.every((p) => p.z === 4)).toBe(true);
    expect(vis.length).toBeGreaterThanOrEqual(3);
    expect(vis.length).toBeLessThanOrEqual(5);
    expect(bounds(s)).toEqual({ min: { x: 0, y: 0, z: 1 }, max: { x: 8, y: 6, z: 4 } });
  });

  it("ramp toward the south: high at the north, low at the south; toward the north, the reverse", () => {
    const top = (dir: "n" | "s") => tessellate({ kind: "ramp", at: v3(0, 0, 0), w: 4, d: 10, h: 2, mat: "concrete", dir }).find((f) => f.normal.z > 0.5)!;
    const south = top("s");
    expect(south.pts.filter((p) => p.y === 0).every((p) => p.z === 2)).toBe(true);
    expect(south.pts.filter((p) => p.y === 10).every((p) => p.z === 0)).toBe(true);
    const north = top("n");
    expect(north.pts.filter((p) => p.y === 0).every((p) => p.z === 0)).toBe(true);
    expect(north.pts.filter((p) => p.y === 10).every((p) => p.z === 2)).toBe(true);
  });

  it("8-sided cylinder: octagonal top and only the sides facing the camera", () => {
    const vis = tessellate({ kind: "cylinder", at: v3(0, 0, 0), r: 2, h: 5, mat: "steel" });
    const top = vis.find((f) => f.tone === "top")!;
    expect(top.pts).toHaveLength(8);
    const sides = vis.filter((f) => f.tone !== "top");
    expect(sides.length).toBeGreaterThanOrEqual(3);
    expect(sides.length).toBeLessThanOrEqual(5);
    expect(tessellateAll({ kind: "cylinder", at: v3(0, 0, 0), r: 2, h: 5, mat: "steel" })).toHaveLength(10);
  });

  it("6-sided cone: triangles to the apex, no top", () => {
    const all = tessellateAll({ kind: "cone", at: v3(0, 0, 0), r: 2, h: 5, mat: "leaf" });
    expect(all).toHaveLength(7); // base + 6 sides
    expect(all.filter((f) => f.pts.length === 3)).toHaveLength(6);
    const vis = tessellate({ kind: "cone", at: v3(0, 0, 0), r: 2, h: 5, mat: "leaf" });
    expect(vis.every((f) => f.pts.length === 3)).toBe(true);
    expect(vis.some((f) => f.tone === "up")).toBe(true);
    expect(vis.some((f) => f.tone === "down")).toBe(true);
  });

  it("lofted hull: pointed bow, rounded stern, deck in deck, lower band in mat and topsides in topMat, sheer at the bow", () => {
    const s: Solid = { kind: "hull", at: v3(0, 0, 0), len: 20, beam: 4, h: 2, mat: "hull", topMat: "hullBlue" };
    const all = tessellateAll(s);
    expect(all).toHaveLength(2 + 10 * 4); // deck, base, 10 sides × (2 bands × 2 triangles)
    const deck = all.find((f) => f.normal.z > 0.99)!;
    expect(deck.mat).toBe("deck"); expect(deck.pts).toHaveLength(10);
    expect(Math.max(...deck.pts.map((p) => p.x))).toBeCloseTo(20, 6); // bow
    expect(Math.min(...deck.pts.map((p) => p.x))).toBeCloseTo(0, 6);  // stern
    expect(deck.pts.find((p) => p.x === 20)!.z).toBeCloseTo(2 * 1.25, 6); // bow sheer
    expect(deck.pts.find((p) => p.x === 0)!.z).toBeCloseTo(2 * 1.1, 6);  // stern sheer
    const sides = all.filter((f) => Math.abs(f.normal.z) < 0.99 && f.normal.z > -0.5);
    expect(sides.filter((f) => f.mat === "hull").length).toBe(20);
    expect(sides.filter((f) => f.mat === "hullBlue").length).toBe(20);
    const b = bounds(s);
    expect(b.min.x).toBeCloseTo(0, 6); expect(b.max.x).toBeCloseTo(20, 6);
    expect(b.min.y).toBeCloseTo(-2, 6); expect(b.max.y).toBeCloseTo(2, 6);
    expect(b.max.z).toBeCloseTo(2.5, 6);
    const mono = tessellateAll({ kind: "hull", at: v3(0, 0, 0), len: 20, beam: 4, h: 2, mat: "hull" });
    expect(mono.every((f) => f.mat === "hull")).toBe(true); // without topMat: monochrome (shipyard)
  });

  it("hull with heading π/2 has its bow to the south (+y) and rotates around the stern", () => {
    const pts = tessellateAll({ kind: "hull", at: v3(10, 20, 0), len: 20, beam: 4, h: 2, mat: "hull", heading: Math.PI / 2 }).flatMap((f) => f.pts);
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(40, 6);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(20, 6);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(8, 6);
  });

  it("poly with facade emits windows and slabs on its walls", () => {
    const fp = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    const plain = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "whitewash" });
    const withFacade = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "whitewash", facade: { floors: 1, cols: 2 } });
    expect(withFacade.length).toBeGreaterThan(plain.length);
    expect(withFacade.some((f) => f.mat === "glass")).toBe(true);
  });

  it("strip: one horizontal quadrilateral per segment, none discarded", () => {
    const s: Solid = { kind: "strip", path: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], width: 2, z: -0.4, mat: "road" };
    const vis = tessellate(s);
    expect(vis).toHaveLength(2);
    expect(vis[0]!.pts).toHaveLength(4);
    expect(vis[0]!.pts.every((p) => p.z === -0.4)).toBe(true);
    expect(vis[0]!.tone).toBe("top");
    expect(isFlat(s)).toBe(true);
  });

  it("ground: each triangle with its tone by slope and its offset", () => {
    const s: Solid = {
      kind: "ground", mat: "slab",
      tris: [
        { pts: [v3(0, 0, 0), v3(6, 0, 0), v3(0, 6, 0)] },
        { pts: [v3(6, 0, 0), v3(6, 6, 2), v3(0, 6, 0)], toneOffset: 1 },
      ],
    };
    const vis = tessellate(s);
    expect(vis).toHaveLength(2);
    expect(vis[0]!.tone).toBe("top");
    expect(vis[0]!.toneOffset).toBe(0);
    expect(vis[1]!.tone).not.toBe("top");
    expect(vis[1]!.toneOffset).toBe(1);
    expect(vis.every((f) => f.normal.z > 0)).toBe(true);
  });
});

describe("bounds", () => {
  it("AABB of a prism", () => {
    expect(bounds({ kind: "prism", at: v3(1, 2, 3), w: 4, d: 5, h: 6, mat: "steel" })).toEqual({ min: { x: 1, y: 2, z: 3 }, max: { x: 5, y: 7, z: 9 } });
  });
  it("AABB of a gable includes the ridge", () => {
    expect(bounds({ kind: "prism", at: v3(0, 0, 0), w: 10, d: 4, h: 4, mat: "steel", roof: "gable" }).max.z).toBeCloseTo(5.4);
  });
  it("AABB of a ground", () => {
    const b = bounds({ kind: "ground", mat: "slab", tris: [{ pts: [v3(0, 0, -1), v3(6, 0, 0), v3(0, 6, 1)] }] });
    expect(b).toEqual({ min: { x: 0, y: 0, z: -1 }, max: { x: 6, y: 6, z: 1 } });
  });
});

describe("wheel", () => {
  it("wheel: vertical ring in the (1, −1, 0) plane with spokes, hub and hanging gondolas; rotating moves the gondolas and the whole ring satisfies x + y = const", () => {
    const w: Solid = { kind: "wheel", at: v3(100, 50, 17), r: 14, width: 1.2, mat: "steel", sides: 16, angle: 0, gondolas: { mat: "rust", w: 1.6, d: 1.2, h: 1.4 } };
    const faces = tessellateAll(w);
    expect(faces.filter((f) => f.mat === "steel").length).toBe(16 + 16 + 1); // sectors, spokes, hub
    for (const f of faces.filter((f) => f.mat === "steel")) { expect(f.tone).toBe("top"); for (const p of f.pts) expect(p.x + p.y).toBeCloseTo(150, 6); }
    expect(faces.filter((f) => f.mat === "rust").length).toBe(16 * 6);
    const b = bounds(w);
    expect(b.max.z).toBeCloseTo(31, 6); expect(b.min.z).toBeLessThan(3.1);
    const top0 = tessellateAll(w).filter((f) => f.mat === "rust").flatMap((f) => f.pts).sort((p, q) => q.z - p.z)[0]!;
    const top1 = tessellateAll({ ...w, angle: Math.PI / 16 }).filter((f) => f.mat === "rust").flatMap((f) => f.pts).sort((p, q) => q.z - p.z)[0]!;
    expect(Math.hypot(top0.x - top1.x, top0.y - top1.y)).toBeGreaterThan(1);
    expect(tessellate(w).filter((f) => f.mat === "steel").length).toBe(33); // faces the camera: nothing is discarded
  });

  it("wheel: without the new options it tessellates exactly as before #211", () => {
    const w: Solid = { kind: "wheel", at: v3(10, 4, 6), r: 3, width: 0.5, mat: "steel", sides: 3, angle: 0.3, gondolas: { mat: "rust", w: 0.6, d: 0.4, h: 0.5 } };
    const fx = (n: number) => n.toFixed(4);
    const lines = tessellateAll(w).map((f) => `${f.mat} ${f.tone} ${f.toneOffset} n=(${fx(f.normal.x)},${fx(f.normal.y)},${fx(f.normal.z)}) ${f.pts.map((p) => `${fx(p.x)},${fx(p.y)},${fx(p.z)}`).join(" ")}`);
    expect(lines.join("\n")).toMatchInlineSnapshot(`
      "steel top 0 n=(0.7071,0.7071,0.0000) 11.6888,2.3112,6.7388 8.7032,5.2968,7.6990 8.4438,5.5562,8.0388 12.0266,1.9734,6.8866
      steel top 0 n=(0.7071,0.7071,0.0000) 10.2606,3.7394,6.0268 11.7062,2.2938,6.6592 11.6714,2.3286,6.8184 10.2258,3.7742,6.1860
      steel top 0 n=(0.7071,0.7071,0.0000) 8.7032,5.2968,7.6990 9.6080,4.3920,3.5622 9.5296,4.4704,3.0747 8.4438,5.5562,8.0388
      steel top 0 n=(0.7071,0.7071,0.0000) 9.8533,4.1467,6.3058 8.7432,5.2568,7.7601 8.6631,5.3369,7.6378 9.7732,4.2268,6.1835
      steel top 0 n=(0.7071,0.7071,0.0000) 9.6080,4.3920,3.5622 11.6888,2.3112,6.7388 12.0266,1.9734,6.8866 9.5296,4.4704,3.0747
      steel top 0 n=(0.7071,0.7071,0.0000) 9.8861,4.1139,5.6674 9.5506,4.4494,3.5807 9.6655,4.3345,3.5438 10.0010,3.9990,5.6305
      steel top 0 n=(0.7071,0.7071,0.0000) 10.2432,3.7568,6.1064 10.1188,3.8812,6.3184 9.9248,4.0752,6.3439 9.7748,4.2252,6.1680 9.7568,4.2432,5.8936 9.8812,4.1188,5.6816 10.0752,3.9248,5.6561 10.2252,3.7748,5.8320
      rust top 0 n=(0.0000,0.0000,1.0000) 10.1312,3.3688,8.6815 10.7312,3.3688,8.6815 10.7312,3.7688,8.6815 10.1312,3.7688,8.6815
      rust shade 0 n=(0.0000,0.0000,-1.0000) 10.1312,3.3688,8.1815 10.7312,3.3688,8.1815 10.7312,3.7688,8.1815 10.1312,3.7688,8.1815
      rust shade 0 n=(0.0000,-1.0000,0.0000) 10.1312,3.3688,8.1815 10.7312,3.3688,8.1815 10.7312,3.3688,8.6815 10.1312,3.3688,8.6815
      rust shade 0 n=(1.0000,0.0000,0.0000) 10.7312,3.3688,8.1815 10.7312,3.7688,8.1815 10.7312,3.7688,8.6815 10.7312,3.3688,8.6815
      rust lit 0 n=(0.0000,1.0000,0.0000) 10.7312,3.7688,8.1815 10.1312,3.7688,8.1815 10.1312,3.7688,8.6815 10.7312,3.7688,8.6815
      rust lit 0 n=(-1.0000,0.0000,0.0000) 10.1312,3.7688,8.1815 10.1312,3.3688,8.1815 10.1312,3.3688,8.6815 10.1312,3.7688,8.6815
      rust top 0 n=(0.0000,0.0000,1.0000) 7.8423,5.6577,5.1873 8.4423,5.6577,5.1873 8.4423,6.0577,5.1873 7.8423,6.0577,5.1873
      rust shade 0 n=(0.0000,0.0000,-1.0000) 7.8423,5.6577,4.6873 8.4423,5.6577,4.6873 8.4423,6.0577,4.6873 7.8423,6.0577,4.6873
      rust shade 0 n=(0.0000,-1.0000,0.0000) 7.8423,5.6577,4.6873 8.4423,5.6577,4.6873 8.4423,5.6577,5.1873 7.8423,5.6577,5.1873
      rust shade 0 n=(1.0000,0.0000,0.0000) 8.4423,5.6577,4.6873 8.4423,6.0577,4.6873 8.4423,6.0577,5.1873 8.4423,5.6577,5.1873
      rust lit 0 n=(0.0000,1.0000,0.0000) 8.4423,6.0577,4.6873 7.8423,6.0577,4.6873 7.8423,6.0577,5.1873 8.4423,6.0577,5.1873
      rust lit 0 n=(-1.0000,0.0000,0.0000) 7.8423,6.0577,4.6873 7.8423,5.6577,4.6873 7.8423,5.6577,5.1873 7.8423,6.0577,5.1873
      rust top 0 n=(0.0000,0.0000,1.0000) 11.1265,2.3735,4.1311 11.7265,2.3735,4.1311 11.7265,2.7735,4.1311 11.1265,2.7735,4.1311
      rust shade 0 n=(0.0000,0.0000,-1.0000) 11.1265,2.3735,3.6311 11.7265,2.3735,3.6311 11.7265,2.7735,3.6311 11.1265,2.7735,3.6311
      rust shade 0 n=(0.0000,-1.0000,0.0000) 11.1265,2.3735,3.6311 11.7265,2.3735,3.6311 11.7265,2.3735,4.1311 11.1265,2.3735,4.1311
      rust shade 0 n=(1.0000,0.0000,0.0000) 11.7265,2.3735,3.6311 11.7265,2.7735,3.6311 11.7265,2.7735,4.1311 11.7265,2.3735,4.1311
      rust lit 0 n=(0.0000,1.0000,0.0000) 11.7265,2.7735,3.6311 11.1265,2.7735,3.6311 11.1265,2.7735,4.1311 11.7265,2.7735,4.1311
      rust lit 0 n=(-1.0000,0.0000,0.0000) 11.1265,2.7735,3.6311 11.1265,2.3735,3.6311 11.1265,2.3735,4.1311 11.1265,2.7735,4.1311"
    `);
  });
});

describe("hollow wheel, slots and buckets (#211)", () => {
  const AT = v3(-14, 60, 9.2);
  const planeRadius = (at: Vec3, p: Vec3) => Math.hypot((p.x - at.x) * WHEEL_U.x + (p.y - at.y) * WHEEL_U.y, p.z - at.z);
  const planeAngle = (at: Vec3, p: Vec3) => Math.atan2(p.z - at.z, (p.x - at.x) * WHEEL_U.x + (p.y - at.y) * WHEEL_U.y);
  const wrap = (a: number) => { const t = Math.atan2(Math.sin(a), Math.cos(a)); return t <= -Math.PI ? t + 2 * Math.PI : t; };
  const mean = (pts: Vec3[]) => v3(pts.reduce((s, p) => s + p.x, 0) / pts.length, pts.reduce((s, p) => s + p.y, 0) / pts.length, pts.reduce((s, p) => s + p.z, 0) / pts.length);
  const dist = (p: Vec3, q: Vec3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  const inPlane = (faces: Face[], at: Vec3) => {
    for (const f of faces) {
      expect(f.normal.x).toBeCloseTo(WHEEL_NORMAL.x, 9); expect(f.normal.y).toBeCloseTo(WHEEL_NORMAL.y, 9); expect(f.normal.z).toBeCloseTo(WHEEL_NORMAL.z, 9);
      expect(f.tone).toBe("top");
      for (const p of f.pts) expect(p.x + p.y).toBeCloseTo(at.x + at.y, 6);
    }
  };
  type Wheel = Extract<Solid, { kind: "wheel" }>;
  const hollow: Wheel = { kind: "wheel", at: AT, r: 5.5, width: 0.5, mat: "rust", sides: 28, angle: 0, hollow: true, slots: 28 };
  const B: Wheel = { ...hollow, buckets: { n: 14, depth: 1.2, teeth: 2, mat: "steel" } };
  /** Blocks of `steel` faces per bucket: trapezoid, mesh and teeth. */
  const bucketBlocks = (s: Solid, per = 2 + (s.kind === "wheel" ? s.buckets?.teeth ?? 0 : 0)) => { const f = tessellateAll(s).filter((x) => x.mat === "steel"); return Array.from({ length: f.length / per }, (_, k) => f.slice(k * per, (k + 1) * per)); };

  it("hollow with slots: double rim, no spokes or hub, all in the plane", () => {
    const faces = tessellateAll(hollow);
    expect(faces).toHaveLength(2 * 28 + 28);
    for (const f of faces) for (const p of f.pts) expect(planeRadius(AT, p)).toBeGreaterThanOrEqual(5.5 - 2.2 * 0.5 - 1e-6);
    inPlane(faces, AT);
    expect(tessellate(hollow)).toHaveLength(faces.length);
  });

  it("hollow without slots: 2·sides faces", () => {
    expect(tessellateAll({ ...hollow, slots: undefined })).toHaveLength(56);
    expect(tessellateAll({ ...hollow, slots: 0 })).toHaveLength(56);
  });

  it("slots: centered on angle + k·2π/slots and join the two rims", () => {
    for (const angle of [0, 0.2]) {
      const w: Wheel = { ...hollow, sides: 8, slots: 4, angle };
      const slots = tessellateAll(w).slice(16);
      expect(slots).toHaveLength(4);
      slots.forEach((f, k) => {
        expect(wrap(planeAngle(AT, mean(f.pts)) - (angle + (k * Math.PI) / 2))).toBeCloseTo(0, 6);
        const rs = f.pts.map((p) => planeRadius(AT, p));
        expect(Math.min(...rs)).toBeLessThan(5.5 - 1.2 * 0.5);
        expect(Math.max(...rs)).toBeGreaterThan(5.5 - 0.5);
      });
    }
  });

  it("tessellate does not discard wheel faces (old and hollow)", () => {
    const old: Solid = { kind: "wheel", at: AT, r: 5.5, width: 0.5, mat: "rust", sides: 16, angle: 0.4 };
    for (const w of [old, hollow, B]) expect(tessellate(w)).toHaveLength(tessellateAll(w).length);
  });

  it("buckets: 2·sides + slots + n·(2 + teeth) faces, all in the plane", () => {
    const faces = tessellateAll(B);
    expect(faces).toHaveLength(56 + 28 + 14 * 4);
    inPlane(faces, AT);
  });

  it("buckets: the trapezoid reaches r + depth", () => {
    const blocks = bucketBlocks(B);
    expect(blocks).toHaveLength(14);
    for (const [trap] of blocks) {
      expect(trap!.pts).toHaveLength(4);
      const rs = trap!.pts.map((p) => planeRadius(AT, p)).sort((a, b) => a - b);
      expect(rs[0]).toBeCloseTo(5.5, 6); expect(rs[1]).toBeCloseTo(5.5, 6);
      expect(rs[2]).toBeCloseTo(6.7, 6); expect(rs[3]).toBeCloseTo(6.7, 6);
    }
  });

  it("buckets: the mesh is the inner 60 % with toneOffset −2", () => {
    expect(bucketBlocks(B)).toHaveLength(14);
    for (const [trap, mesh, ...teeth] of bucketBlocks(B)) {
      expect(trap!.toneOffset).toBe(0);
      for (const t of teeth) expect(t.toneOffset).toBe(0);
      expect(mesh!.toneOffset).toBe(-2);
      const c = mean(trap!.pts), cm = mean(mesh!.pts);
      expect(dist(c, cm)).toBeCloseTo(0, 6);
      mesh!.pts.forEach((p, i) => expect(dist(p, c)).toBeCloseTo(0.6 * dist(trap!.pts[i]!, c), 6));
    }
  });

  it("buckets: the teeth are on the greater-angle side", () => {
    const n = 14;
    expect(bucketBlocks(B)).toHaveLength(n);
    bucketBlocks(B).forEach(([, , ...teeth], k) => {
      expect(teeth).toHaveLength(2);
      for (const t of teeth) {
        expect(t.pts).toHaveLength(3);
        t.pts.forEach((p, i) => expect(dist(p, t.pts[(i + 1) % 3]!)).toBeCloseTo(1.2 / 3, 6));
        const da = wrap(planeAngle(AT, mean(t.pts)) - (2 * Math.PI * k) / n);
        expect(da).toBeGreaterThan((0.3 * Math.PI) / n);
        expect(da).toBeLessThan(Math.PI / n);
        // the apex (third point) sits at a greater angle than the midpoint of its base
        expect(wrap(planeAngle(AT, t.pts[2]!) - planeAngle(AT, mean([t.pts[0]!, t.pts[1]!])))).toBeGreaterThan(0);
      }
    });
  });

  it("buckets: rotating by π/n moves bucket 0 and keeps the face count", () => {
    const B2: Wheel = { ...B, angle: Math.PI / 14 };
    expect(tessellateAll(B2)).toHaveLength(tessellateAll(B).length);
    const t0 = bucketBlocks(B)[0]![0]!, t1 = bucketBlocks(B2)[0]![0]!;
    expect(Math.max(...t0.pts.map((p, i) => dist(p, t1.pts[i]!)))).toBeGreaterThan(0.1);
    expect(wrap(planeAngle(AT, mean(t1.pts)) - Math.PI / 14)).toBeCloseTo(0, 6);
  });

  it("buckets: bounds includes r + depth", () => {
    const b = bounds({ ...B, angle: Math.PI / 2 });
    expect(b.max.z).toBeGreaterThan(9.2 + 5.5 + 0.9 * 1.2);
    expect(b.max.z).toBeLessThanOrEqual(9.2 + 5.5 + 1.2 + 1e-6);
  });

  it("buckets without hollow: spokes and hub remain", () => {
    expect(tessellateAll({ ...B, hollow: undefined, slots: undefined })).toHaveLength(28 + 28 + 1 + 14 * 4);
  });

  it("buckets with teeth 0: trapezoid and mesh per bucket", () => {
    const w: Wheel = { ...B, buckets: { n: 14, depth: 1.2, teeth: 0, mat: "steel" } };
    const blocks = bucketBlocks(w);
    expect(blocks).toHaveLength(14);
    for (const b of blocks) expect(b.map((f) => f.pts.length)).toEqual([4, 4]);
  });

  it("buckets with gondolas: the gondolas do not change", () => {
    const g = { mat: "glass" as const, w: 0.8, d: 0.6, h: 0.7 };
    const plain: Wheel = { kind: "wheel", at: AT, r: 5.5, width: 0.5, mat: "rust", sides: 12, angle: 0.3, gondolas: g };
    const withB: Wheel = { ...plain, buckets: { n: 14, depth: 1.2, teeth: 2, mat: "steel" } };
    expect(tessellateAll(withB).filter((f) => f.mat === "glass")).toEqual(tessellateAll(plain).filter((f) => f.mat === "glass"));
  });
});

describe("beam", () => {
  const beam = (from: Vec3, to: Vec3, w: number, h: number): Solid => ({ kind: "beam", from, to, w, h, mat: "steel" });
  const corners = (s: Solid) => tessellateAll(s).flatMap((f) => f.pts);
  const finite = (s: Solid) => corners(s).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

  it("horizontal: the bounds match those of the equivalent box", () => {
    const b = bounds(beam(v3(0, 1, 2), v3(4, 1, 2), 2, 1));
    const box = bounds({ kind: "prism", at: v3(0, 0, 1.5), w: 4, d: 2, h: 1, mat: "steel" });
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(box.min[k], 9); expect(b.max[k]).toBeCloseTo(box.max[k], 9); }
  });

  it("at 45°: the bounds are exactly those of its 8 vertices, with a level cross-section", () => {
    const r = Math.SQRT1_2, w = 0.4, h = 0.6;
    // axis (1, 0, 1)/√2; side (0, 1, 0); up (−1, 0, 1)/√2
    const pts: Vec3[] = [];
    for (const e of [v3(0, 0, 0), v3(3, 0, 3)]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      pts.push(v3(e.x - sz * r * h / 2, e.y + sy * w / 2, e.z + sz * r * h / 2));
    const b = bounds(beam(v3(0, 0, 0), v3(3, 0, 3), w, h));
    const ax = (k: "x" | "y" | "z") => pts.map((p) => p[k]);
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(Math.min(...ax(k)), 9); expect(b.max[k]).toBeCloseTo(Math.max(...ax(k)), 9); }
    // level: each vertex has its width-edge partner at the same z and `w` away in plan
    const all = corners(beam(v3(0, 0, 0), v3(3, 2, 3), w, h));
    for (const p of all)
      expect(all.some((q) => Math.abs(q.z - p.z) < 1e-9 && Math.abs(Math.hypot(q.x - p.x, q.y - p.y) - w) < 1e-9)).toBe(true);
  });

  it("tessellation: 6 flat faces, closed (each edge shared by two faces) and with the normal pointing outward", () => {
    const s = beam(v3(1, 2, 0.5), v3(4, 0, 5), 0.5, 0.8);
    const faces = tessellateAll(s);
    expect(faces).toHaveLength(6);
    const key = (p: Vec3) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
    const edges = new Map<string, number>();
    const mid = v3(2.5, 1, 2.75);
    for (const f of faces) {
      expect(f.pts).toHaveLength(4);
      for (const p of f.pts) expect(dot(f.normal, v3(p.x - f.pts[0]!.x, p.y - f.pts[0]!.y, p.z - f.pts[0]!.z))).toBeCloseTo(0, 9); // flat
      expect(dot(f.normal, v3(f.pts[0]!.x - mid.x, f.pts[0]!.y - mid.y, f.pts[0]!.z - mid.z))).toBeGreaterThan(0); // outward
      f.pts.forEach((p, i) => { const q = f.pts[(i + 1) % 4]!; const e = [key(p), key(q)].sort().join("|"); edges.set(e, (edges.get(e) ?? 0) + 1); });
    }
    expect(edges.size).toBe(12);
    for (const n of edges.values()) expect(n).toBe(2);
  });

  it("consistent shading: the top face of a horizontal beam is 'top' and the visible ones come out of tessellate", () => {
    const faces = tessellateAll(beam(v3(0, 0, 1), v3(4, 0, 1), 1, 1));
    expect(faces.filter((f) => f.tone === "top")).toHaveLength(1);
    expect(tessellate(beam(v3(0, 0, 1), v3(4, 0, 1), 1, 1)).every((f) => f.mat === "steel")).toBe(true);
  });

  it("swapping from/to gives the same bounds; so does a descending beam", () => {
    const a = bounds(beam(v3(0, 0, 0), v3(3, 1, 3), 0.4, 0.6)), b = bounds(beam(v3(3, 1, 3), v3(0, 0, 0), 0.4, 0.6));
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(a.min[k], 9); expect(b.max[k]).toBeCloseTo(a.max[k], 9); }
  });

  it("vertical: cross-section w along y, h along x, no NaN", () => {
    const s = beam(v3(0, 0, 0), v3(0, 0, 5), 2, 1);
    expect(finite(s)).toBe(true);
    const b = bounds(s);
    expect(b.max.y - b.min.y).toBeCloseTo(2, 9); expect(b.max.x - b.min.x).toBeCloseTo(1, 9); expect(b.max.z - b.min.z).toBeCloseTo(5, 9);
  });

  it("zero length does not break: finite vertices and bounds, tessellate does not throw", () => {
    const s = beam(v3(1, 1, 1), v3(1, 1, 1), 0.4, 0.4);
    expect(finite(s)).toBe(true);
    const b = bounds(s);
    for (const k of ["x", "y", "z"] as const) { expect(Number.isFinite(b.min[k])).toBe(true); expect(Number.isFinite(b.max[k])).toBe(true); }
    expect(() => tessellate(s)).not.toThrow();
    for (const f of tessellateAll(s)) expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
  });

  it("at 45°: each face carries the tone shadeTone gives its normal; the top face is a slope", () => {
    const faces = tessellateAll(beam(v3(0, 0, 4), v3(4.5, 0, 8.5), 0.4, 0.5));
    for (const f of faces) expect(f.tone).toBe(shadeTone(f.normal));
    expect(faces.some((f) => f.tone === "up" || f.tone === "down")).toBe(true);
  });
});

describe("plates non-regression", () => {
  it("a prism without plates tessellates exactly as before plates existed", () => {
    expect(tessellateAll({ kind: "prism", at: v3(1, 2, 0), w: 3, d: 2, h: 4, mat: "brick" })).toMatchInlineSnapshot(`
      [
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "top",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 0,
            "z": -1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
      ]
    `);
    expect(tessellateAll({ kind: "prism", at: v3(1, 2, 0), w: 3, d: 2, h: 4, mat: "brick", facade: { floors: 1, cols: 1, bands: false } })).toMatchInlineSnapshot(`
      [
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "top",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 0,
            "z": -1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1.75,
              "y": 2,
              "z": 1,
            },
            {
              "x": 3.25,
              "y": 2,
              "z": 1,
            },
            {
              "x": 3.25,
              "y": 2,
              "z": 3,
            },
            {
              "x": 1.75,
              "y": 2,
              "z": 3,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2.5,
              "z": 1,
            },
            {
              "x": 4,
              "y": 3.5,
              "z": 1,
            },
            {
              "x": 4,
              "y": 3.5,
              "z": 3,
            },
            {
              "x": 4,
              "y": 2.5,
              "z": 3,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 3.25,
              "y": 4,
              "z": 1,
            },
            {
              "x": 1.75,
              "y": 4,
              "z": 1,
            },
            {
              "x": 1.75,
              "y": 4,
              "z": 3,
            },
            {
              "x": 3.25,
              "y": 4,
              "z": 3,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 3.5,
              "z": 1,
            },
            {
              "x": 1,
              "y": 2.5,
              "z": 1,
            },
            {
              "x": 1,
              "y": 2.5,
              "z": 3,
            },
            {
              "x": 1,
              "y": 3.5,
              "z": 3,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
      ]
    `);
    expect(tessellateAll({ kind: "ramp", at: v3(0, 0, 0), w: 4, d: 2, h: 2, mat: "steel", dir: "s" })).toMatchInlineSnapshot(`
      [
        {
          "mat": "steel",
          "normal": {
            "x": -0,
            "y": -0,
            "z": -1,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 0,
            "y": 0.7071067811865475,
            "z": 0.7071067811865475,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 2,
            },
            {
              "x": 4,
              "y": 0,
              "z": 2,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
          ],
          "tone": "up",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": -1,
            "y": -0,
            "z": -0,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 0,
              "z": 2,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 2,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 2,
            },
            {
              "x": 0,
              "y": 0,
              "z": 2,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 0,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
      ]
    `);
  });
});

describe("plates", () => {
  const P: Solid & { kind: "prism" } = { kind: "prism", at: v3(0, 0, 0), w: 4, d: 3, h: 6, mat: "brick" };
  const plate = (wall: number, extra: Partial<Plate> = {}): Plate => ({ wall, shape: "rect", u0: 0.25, u1: 0.75, z0: 1, z1: 3, mat: "steel", ...extra });
  const near = (a: number, lo: number, hi: number) => a >= lo - 1e-9 && a <= hi + 1e-9;
  const isSouth = (f: Face) => f.mat === "brick" && f.pts.every((p) => p.y === 3) && Math.abs(f.normal.z) < 1e-6;

  it("rect on the south wall: comes right after the south face, coplanar and inside its rectangle", () => {
    const s = { ...P, plates: [plate(2)] };
    for (const faces of [tessellateAll(s), tessellate(s)]) {
      const i = faces.findIndex(isSouth);
      expect(i).toBeGreaterThanOrEqual(0);
      const pl = faces[i + 1]!;
      expect(pl.mat).toBe("steel");
      expect(pl.normal).toEqual(faces[i]!.normal);
      expect(pl.tone).toBe(faces[i]!.tone);
      expect(pl.toneOffset).toBe(0);
      expect(pl.pts).toHaveLength(4);
      for (const p of pl.pts) { expect(p.y).toBe(3); expect(near(p.x, 1, 3)).toBe(true); expect(near(p.z, 1, 3)).toBe(true); }
      expect(faces.filter((f) => f.mat === "steel")).toHaveLength(1);
    }
  });

  it("the plate's toneOffset is honored", () => {
    const pl = tessellateAll({ ...P, plates: [plate(2, { toneOffset: -2 })] }).find((f) => f.mat === "steel")!;
    expect(pl.toneOffset).toBe(-2);
  });

  it("plate on the north wall: it is in tessellateAll with the north normal and does not appear in tessellate", () => {
    const s = { ...P, plates: [plate(0)] };
    const all = tessellateAll(s).find((f) => f.mat === "steel")!;
    expect(all.normal.y).toBeLessThan(0);
    expect(all.pts.every((p) => p.y === 0)).toBe(true);
    expect(tessellate(s).some((f) => f.mat === "steel")).toBe(false);
  });

  it("disc: 8-point octagon touching the four edges of the rectangle; tri: 3 points with the apex at the top middle", () => {
    const disc = tessellateAll({ ...P, plates: [plate(2, { shape: "disc" })] }).find((f) => f.mat === "steel")!;
    expect(disc.pts).toHaveLength(8);
    for (const p of disc.pts) { expect(p.y).toBe(3); expect(near(p.x, 1, 3)).toBe(true); expect(near(p.z, 1, 3)).toBe(true); }
    expect(Math.min(...disc.pts.map((p) => p.x))).toBeCloseTo(1, 9);
    expect(Math.max(...disc.pts.map((p) => p.x))).toBeCloseTo(3, 9);
    expect(Math.min(...disc.pts.map((p) => p.z))).toBeCloseTo(1, 9);
    expect(Math.max(...disc.pts.map((p) => p.z))).toBeCloseTo(3, 9);
    const tri = tessellateAll({ ...P, plates: [plate(2, { shape: "tri" })] }).find((f) => f.mat === "steel")!;
    expect(tri.pts).toHaveLength(3);
    const exp = [v3(3, 3, 1), v3(1, 3, 1), v3(2, 3, 3)]; // the south edge runs from (4, 3) to (0, 3): u grows toward the west
    tri.pts.forEach((p, k) => { for (const c of ["x", "y", "z"] as const) expect(p[c]).toBeCloseTo(exp[k]![c], 9); });
  });

  it("5-sided poly: the wall 3 plate lands on edge 3, and a wall 1 one runs along the diagonal edge", () => {
    const footprint = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 4 }];
    const s: Solid = { kind: "poly", footprint, z: 1, h: 3, mat: "rock", plates: [plate(3, { u0: 0, u1: 1, z0: 2, z1: 3 }), plate(1, { mat: "glass", z0: 2, z1: 3 })] };
    const all = tessellateAll(s);
    const edge3 = all.findIndex((f) => f.mat === "rock" && f.pts.length === 4 && f.pts.some((p) => p.x === 4 && p.y === 6) && f.pts.some((p) => p.x === 0 && p.y === 4));
    expect(edge3).toBeGreaterThanOrEqual(0);
    const pl = all[edge3 + 1]!;
    expect(pl.mat).toBe("steel");
    expect(pl.normal).toEqual(all[edge3]!.normal);
    const plan = pl.pts.map((p) => `${p.x},${p.y}`);
    expect(plan).toContain("4,6");
    expect(plan).toContain("0,4");
    const diag = all.find((f) => f.mat === "glass")!;
    const xs = diag.pts.map((p) => p.x), ys = diag.pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(6.5, 9); expect(Math.max(...xs)).toBeCloseTo(7.5, 9);
    expect(Math.min(...ys)).toBeCloseTo(0.75, 9); expect(Math.max(...ys)).toBeCloseTo(2.25, 9);
  });

  it("facade and plates on the same wall: first the wall, then the facade, then the plates; the other walls do not carry it", () => {
    const facade = { floors: 2, cols: 1, bands: false as const };
    const all = tessellateAll({ ...P, facade, plates: [plate(2)] });
    const i = all.findIndex(isSouth);
    const n = facadeFaces(all[i]!, facade).length;
    expect(n).toBeGreaterThan(0);
    for (const f of all.slice(i + 1, i + 1 + n)) expect(f.mat === "glass" || (f.mat === "brick" && f.toneOffset === -1)).toBe(true);
    expect(all[i + 1 + n]!.mat).toBe("steel");
    expect(all.filter((f) => f.mat === "steel")).toHaveLength(1);
  });

  it("two plates on the same wall come out in array order, after the east wall", () => {
    const all = tessellateAll({ ...P, plates: [plate(1, { mat: "steel" }), plate(1, { mat: "glass" })] });
    const i = all.findIndex((f) => f.mat === "brick" && f.pts.every((p) => p.x === 4) && Math.abs(f.normal.z) < 1e-6);
    expect(all[i + 1]!.mat).toBe("steel");
    expect(all[i + 2]!.mat).toBe("glass");
  });

  it("bounds the same with and without plates, even with a plate that sticks out", () => {
    expect(bounds({ ...P, plates: [plate(2)] })).toEqual(bounds(P));
    expect(bounds({ ...P, plates: [plate(2, { u0: -0.5, u1: 1.5, z0: 5, z1: 9 })] })).toEqual(bounds(P));
  });

  it("roof gable carries plates on walls and gable ends; roof step applies them only to the box", () => {
    const gable = tessellateAll({ ...P, roof: "gable", plates: [plate(2)] });
    expect(gable.filter((f) => f.mat === "steel")).toHaveLength(1);
    expect(isSouth(gable[gable.findIndex((f) => f.mat === "steel") - 1]!)).toBe(true);
    const step = tessellateAll({ ...P, roof: "step", plates: [plate(2)] });
    expect(step.filter((f) => f.mat === "steel")).toHaveLength(1);
    const i = step.findIndex((f) => f.mat === "steel");
    expect(isSouth(step[i - 1]!)).toBe(true);
  });

  it("wall out of range: does not throw and emits no plate", () => {
    for (const wall of [4, -1, 1.5]) expect(tessellateAll({ ...P, plates: [plate(wall)] })).toEqual(tessellateAll(P));
  });

  describe("on ramp", () => {
    const R: Solid & { kind: "ramp" } = { kind: "ramp", at: v3(0, 0, 0), w: 4, d: 2, h: 2, mat: "steel", dir: "n" };
    const rp = (wall: number, extra: Partial<Plate> = {}): Plate => plate(wall, { mat: "glass", z0: 0.2, z1: 0.8, ...extra });
    const wallOf = (faces: Face[], pred: (p: Vec3) => boolean) => faces.findIndex((f) => f.mat === "steel" && Math.abs(f.normal.z) < 1e-6 && f.pts.every(pred));

    it("plate on wall 2: comes after the south side, in tessellateAll and in tessellate", () => {
      const s = { ...R, plates: [rp(2)] };
      for (const faces of [tessellateAll(s), tessellate(s)]) {
        const i = wallOf(faces, (p) => p.y === 2);
        expect(i).toBeGreaterThanOrEqual(0);
        const pl = faces[i + 1]!;
        expect(pl.mat).toBe("glass");
        expect(pl.normal).toEqual(faces[i]!.normal);
        expect(pl.pts.every((p) => p.y === 2)).toBe(true);
      }
    });

    it("plate on wall 3 (west): runs along the edge from (0, 2) to (0, 0), after the west wall", () => {
      const all = tessellateAll({ ...R, plates: [rp(3, { u0: 0.1, u1: 0.3, z0: 0.5, z1: 1.5 })] });
      const i = wallOf(all, (p) => p.x === 0);
      const pl = all[i + 1]!;
      expect(pl.mat).toBe("glass");
      expect(pl.normal).toEqual(all[i]!.normal);
      for (const p of pl.pts) { expect(p.x).toBe(0); expect(near(p.y, 1.4, 1.8)).toBe(true); }
    });

    it("plate on wall 1 taller than the profile: not clipped", () => {
      const pl = tessellateAll({ ...R, plates: [rp(1, { u0: 0, u1: 0.2, z0: 0.5, z1: 1.9 })] }).find((f) => f.mat === "glass")!;
      expect(Math.max(...pl.pts.map((p) => p.z))).toBeCloseTo(1.9, 9);
      expect(pl.pts.every((p) => p.x === 4)).toBe(true);
    });

    it("bounds the same with and without plates", () => {
      expect(bounds({ ...R, plates: [rp(2), rp(1, { z1: 5 })] })).toEqual(bounds(R));
    });
  });
});

describe("roofMat on gable roof (#249)", () => {
  const house = (w: number, d: number): Solid => ({ kind: "prism", at: v3(1, 2, 0), w, d, h: 3, mat: "whitewash", roof: "gable" });
  it("gable without roofMat: faces identical to today", () => {
    expect(tessellateAll(house(5, 4))).toMatchSnapshot();
    expect(tessellateAll(house(4, 5))).toMatchSnapshot();
  });
  it("gable with roofMat: only the two slopes carry roofMat; bounds does not change", () => {
    for (const [w, d] of [[5, 4], [4, 5]] as const) {
      const base = house(w, d), roofed = { ...base, roofMat: "tile" } as Solid;
      const all = tessellateAll(roofed), tiled = all.filter((f) => f.mat === "tile");
      expect(tiled).toHaveLength(2);
      for (const f of tiled) expect(f.normal.z).toBeGreaterThan(0);
      expect(all.filter((f) => f.mat === "whitewash")).toHaveLength(5);
      expect(all.map((f) => f.pts)).toEqual(tessellateAll(base).map((f) => f.pts));
      expect(bounds(roofed)).toEqual(bounds(base));
    }
  });
});

describe("orientation by winding direction", () => {
  it("concave poly (L): each wall points outward in both winding directions", () => {
    const L = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }];
    for (const footprint of [L, [...L].reverse()]) {
      const walls = tessellateAll({ kind: "poly", footprint, z: 0, h: 3, mat: "concrete" }).filter((f) => Math.abs(f.normal.z) < 1e-6);
      expect(walls).toHaveLength(6);
      for (const f of walls) {
        expect(Math.hypot(f.normal.x, f.normal.y)).toBeCloseTo(1, 9);
        const cx = mean(f.pts, "x"), cy = mean(f.pts, "y");
        expect(inside({ x: cx + 0.1 * f.normal.x, y: cy + 0.1 * f.normal.y }, L)).toBe(false);
      }
    }
  });

  it("plates of a clockwise poly land on their wall (#291): wall indexes the footprint as written", () => {
    const fp = [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 0 }]; // clockwise: extrude reverses it
    expect(signed(fp)).toBeLessThan(0);
    const plate: Plate = { wall: 0, shape: "rect", u0: 0.1, u1: 0.4, z0: 1, z1: 2, mat: "steel" }; // asymmetric: u runs in the direction of the original edge
    const faces = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "rock", plates: [plate] });
    const pl = faces.filter((f) => f.mat === "steel");
    expect(pl).toHaveLength(1);
    // the original edge 0 runs from (0,0) to (0,5): the west wall, normal (-1, 0)
    expect(pl[0]!.normal.x).toBeCloseTo(-1, 9);
    expect(pl[0]!.normal.y).toBeCloseTo(0, 9);
    for (const p of pl[0]!.pts) { expect(p.x).toBeCloseTo(0, 9); expect(p.y).toBeGreaterThanOrEqual(0.5 - 1e-9); expect(p.y).toBeLessThanOrEqual(2 + 1e-9); }
    const wall = faces[faces.indexOf(pl[0]!) - 1]!;
    expect(wall.pts.every((p) => p.x === 0)).toBe(true);
    expect(wall.normal).toEqual(pl[0]!.normal);
  });

  it("an already canonical footprint is not reversed: wall i runs from footprint[i] to footprint[i+1]", () => {
    const fp = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 4 }];
    const walls = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "rock" }).slice(2);
    walls.forEach((f, i) => {
      expect({ x: f.pts[0]!.x, y: f.pts[0]!.y }).toEqual(fp[i]);
      expect({ x: f.pts[1]!.x, y: f.pts[1]!.y }).toEqual(fp[(i + 1) % fp.length]);
    });
  });
});

function signed(pts: { x: number; y: number }[]): number {
  return pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]!; return a + p.x * q.y - q.x * p.y; }, 0);
}

describe("tone", () => {
  it("tone: 1 adds one unit to the toneOffset of every face, including facade and stepped-roof ones", () => {
    const cases: Solid[] = [prism, { ...prism, facade: { floors: 2, cols: 2 } }, { ...prism, w: 10, d: 10, roof: "step" }];
    for (const s of cases) {
      const plain = tessellateAll(s), toned = tessellateAll({ ...s, tone: 1 });
      expect(toned).toHaveLength(plain.length);
      toned.forEach((f, i) => expect(f.toneOffset).toBe(plain[i]!.toneOffset + 1));
    }
    expect(tessellateAll({ ...prism, facade: { floors: 2, cols: 2 } }).some((f) => f.mat === "glass")).toBe(true);
  });
});

describe("hip", () => {
  const hipOf = (w: number, d: number): Solid => ({ kind: "prism", at: v3(1, 2, 3), w, d, h: 4, mat: "concrete", roof: "hip" });
  const slopes = (s: Solid) => tessellateAll(s).filter((f) => f.normal.z > 0.3 && f.normal.z < 0.997);

  it("hip roof: 9 faces, four sloped planes, ridge at h·(1 + GABLE_RATIO)", () => {
    for (const s of [hipOf(10, 6), hipOf(6, 10)]) {
      expect(tessellateAll(s)).toHaveLength(9);
      expect(slopes(s)).toHaveLength(4);
      expect(bounds(s).max.z).toBeCloseTo(3 + 4 * (1 + GABLE_RATIO), 9);
    }
    expect(bounds(hipOf(6, 10))).toEqual({ min: { x: 1, y: 2, z: 3 }, max: { x: 7, y: 12, z: expect.closeTo(3 + 4 * (1 + GABLE_RATIO), 9) } });
  });

  it("hip: the ridge runs along the long axis with length |w − d| and each slope faces its side", () => {
    for (const [s, axis] of [[hipOf(10, 6), "x"], [hipOf(6, 10), "y"]] as const) {
      const ridge = tessellateAll(s).flatMap((f) => f.pts).filter((p) => p.z > 3 + 4 + 1e-9);
      const along = ridge.map((p) => (axis === "x" ? p.x : p.y));
      expect(Math.max(...along) - Math.min(...along)).toBeCloseTo(4, 9);
      const dirs = slopes(s).map((f) => [Math.sign(Math.round(f.normal.x * 1e6)), Math.sign(Math.round(f.normal.y * 1e6))].join()).sort();
      expect(dirs).toEqual(["-1,0", "0,-1", "0,1", "1,0"]);
    }
  });

  it("hip with w === d: the ridge is a point and no normal is NaN", () => {
    const all = tessellateAll(hipOf(6, 6));
    expect(all).toHaveLength(9);
    for (const f of all) expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
    expect(slopes(hipOf(6, 6))).toHaveLength(4);
    expect(slopes(hipOf(6, 6)).every((f) => f.pts.length === 3)).toBe(true); // the long slopes become triangles
  });
});

describe("dome", () => {
  const d: Solid = { kind: "dome", at: v3(10, 20, 2), r: 4, h: 3, mat: "concrete" };

  it("12×3 dome: 37 faces, sides not facing the ground, base facing down and discarded", () => {
    const all = tessellateAll(d);
    expect(all).toHaveLength(37);
    const base = all.filter((f) => f.pts.every((p) => p.z === 2));
    expect(base).toHaveLength(1);
    expect(base[0]!.normal.z).toBeLessThan(0);
    for (const f of all.filter((f) => f !== base[0])) expect(f.normal.z).toBeGreaterThanOrEqual(0);
    expect(all.filter((f) => f.pts.length === 3)).toHaveLength(12);
    expect(bounds(d).max.z).toBeCloseTo(5, 9);
    const inset = 4 * Math.cos(Math.PI / 12); // `regular` leaves flat faces to the four winds
    expect(bounds(d).min).toEqual({ x: expect.closeTo(10 - inset, 9), y: expect.closeTo(20 - inset, 9), z: 2 });
    expect(tessellate(d).some((f) => f.normal.z < 0)).toBe(false);
  });

  it("configurable sides and rings", () => {
    expect(tessellateAll({ ...d, sides: 16, rings: 4 })).toHaveLength(65);
  });

  it("flat dome and tall dome: every side faces up and away from the axis", () => {
    for (const [r, h] of [[10, 1], [1, 10]] as const) {
      const s: Solid = { kind: "dome", at: v3(0, 0, 0), r, h, mat: "concrete", rings: 4 };
      for (const f of tessellateAll(s).slice(1)) {
        expect(f.normal.z).toBeGreaterThanOrEqual(0);
        expect(f.normal.x * mean(f.pts, "x") + f.normal.y * mean(f.pts, "y")).toBeGreaterThan(0);
      }
    }
  });
});

describe("vault", () => {
  const vx: Solid = { kind: "vault", at: v3(0, 0, 1), len: 12, w: 6, h: 3, axis: "x", mat: "concrete" };

  it("6-segment vault: 9 faces, vertical opposite gable ends, strips facing up, base facing down", () => {
    const all = tessellateAll(vx);
    expect(all).toHaveLength(9);
    const gables = all.filter((f) => Math.abs(f.normal.z) < 1e-6);
    expect(gables).toHaveLength(2);
    expect(gables[0]!.normal.x + gables[1]!.normal.x).toBeCloseTo(0, 9);
    expect(Math.abs(gables[0]!.normal.x)).toBeCloseTo(1, 9);
    expect(gables.every((g) => g.pts.length === 7)).toBe(true);
    expect(all.filter((f) => f.normal.z < -1e-6)).toHaveLength(1);
    expect(all.filter((f) => f.normal.z > 1e-6)).toHaveLength(6);
    expect(bounds(vx)).toEqual({ min: { x: 0, y: 0, z: 1 }, max: { x: 12, y: expect.closeTo(6, 9), z: expect.closeTo(4, 9) } });
  });

  it("flat vault and tall vault: every strip faces up and away from the axis", () => {
    for (const [w, h] of [[10, 1], [2, 10]] as const) {
      const strips = tessellateAll({ kind: "vault", at: v3(0, 0, 0), len: 8, w, h, axis: "x", mat: "concrete" }).filter((f) => f.normal.z > 1e-6);
      expect(strips).toHaveLength(6);
      for (const f of strips) {
        const off = mean(f.pts, "y") - w / 2;
        if (Math.abs(off) > 1e-9) expect(f.normal.y * off).toBeGreaterThan(0);
      }
    }
  });

  it("axis y swaps the extents of the AABB", () => {
    const b = bounds({ ...vx, axis: "y" });
    expect(b.max.x).toBeCloseTo(6, 9);
    expect(b.max.y).toBeCloseTo(12, 9);
    const gables = tessellateAll({ ...vx, axis: "y" }).filter((f) => Math.abs(f.normal.z) < 1e-6);
    expect(gables.map((g) => [g.normal.x, g.normal.y]).sort((a, b) => a[1]! - b[1]!)).toEqual([[expect.closeTo(0, 9), -1], [expect.closeTo(0, 9), 1]]);
  });
});
