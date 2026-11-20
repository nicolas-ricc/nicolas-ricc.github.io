import { describe, expect, it } from "vitest";
import { polygonNormal, type Vec3 } from "../iso/geometry";
import { clipPolygon, lerp2 } from "../iso/clip";
import type { MeshFace } from "../iso/solids";
import { groundDiagonal } from "../kit/lettering";
import { BOARD_PAD, BOARD_TOP, LAYOUT, PLATFORM_SITES, RAFT, REST_POSE, WRITING_CAP, buildRaft, raftAt, raftEnvelope, raftPlane, type WritingSite } from "./raft";

const SITES: WritingSite[] = ["wide", "tall"];
const plan = buildRaft();
const INK = { a0: Math.min(...LAYOUT.map((g) => g.box.x0)), a1: Math.max(...LAYOUT.map((g) => g.box.x1)), b0: Math.min(...LAYOUT.map((g) => g.box.y0)), b1: Math.max(...LAYOUT.map((g) => g.box.y1)) };
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
/** World point to (a, b) text coordinates through a plane with orthonormal u, v. */
const toText = (p: Vec3, site: WritingSite) => {
  const pl = raftPlane(site), d = { x: p.x - pl.origin.x, y: p.y - pl.origin.y, z: p.z - pl.origin.z };
  return { x: dot(d, pl.u), y: dot(d, pl.v) };
};
const area2 = (pts: readonly { x: number; y: number }[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};
/** The faces of the mesh, grouped: beams, sheet and, per plank in list order, its 6 faces and its decals. */
const groups = (faces: readonly MeshFace[]) => {
  const beams = faces.slice(0, 18), sheet = faces[18]!, planks: { faces: MeshFace[]; decals: MeshFace[] }[] = [];
  let i = 19;
  while (i < faces.length) {
    const own = faces.slice(i, i + 6); i += 6;
    const decals: MeshFace[] = [];
    while (i < faces.length && faces[i]!.mat === "navy") decals.push(faces[i++]!);
    planks.push({ faces: own, decals });
  }
  return { beams, sheet, planks };
};

describe("raft (#454)", () => {
  it("cap 20, BOARD_TOP −0.4, BOARD_PAD 1.6 and the raft constants", () => {
    expect(WRITING_CAP).toBe(20);
    expect(BOARD_TOP).toBe(-0.4);
    expect(BOARD_PAD).toBe(1.6);
    expect(RAFT).toEqual({ plankW: 2.4, joint: 0.15, plankH: 0.5, ragged: 0.3, beamW: 1.4, beamH: 0.5, beamInset: 1.5, beamOverhang: 1.2 });
    expect(REST_POSE).toEqual({ dz: 0, pitch: 0, roll: 0 });
  });

  it("the sheet is the ink box grown by BOARD_PAD on each side", () => {
    expect(plan.sheet.a0).toBeCloseTo(INK.a0 - BOARD_PAD, 9);
    expect(plan.sheet.a1).toBeCloseTo(INK.a1 + BOARD_PAD, 9);
    expect(plan.sheet.b0).toBeCloseTo(INK.b0 - BOARD_PAD, 9);
    expect(plan.sheet.b1).toBeCloseTo(INK.b1 + BOARD_PAD, 9);
  });

  it.each(SITES)("%s: the sheet face spans [sheet.a0, sheet.a1] × the plank block in b at z −0.9", (site) => {
    // The oracle's backing reaches the far margin row of the last glyph only through this face: it must cover the whole plank block, not just the sheet.
    const { sheet, planks } = plan, f = groups(raftAt(site, REST_POSE).faces).sheet, t = f.pts.map((q) => toText(q, site));
    const lo = planks.at(-1)!.b0, hi = planks[0]!.b1;
    expect(Math.min(...t.map((q) => q.x))).toBeCloseTo(sheet.a0, 9);
    expect(Math.max(...t.map((q) => q.x))).toBeCloseTo(sheet.a1, 9);
    expect(Math.min(...t.map((q) => q.y))).toBeCloseTo(Math.min(sheet.b0, lo), 9);
    expect(Math.max(...t.map((q) => q.y))).toBeCloseTo(Math.max(sheet.b1, hi), 9);
    expect(Math.min(sheet.b0, lo)).toBe(lo); // the block is the longer one
    expect(Math.max(sheet.b1, hi)).toBe(hi);
    for (const q of f.pts) expect(q.z).toBeCloseTo(BOARD_TOP - 0.5, 9);
  });
  it("N planks at pitch 2.55, 2.4 wide, back to front, the block centred on the sheet", () => {
    const { sheet, planks } = plan, N = Math.ceil((sheet.b1 - sheet.b0 + 0.15) / 2.55);
    expect(planks).toHaveLength(N);
    for (const p of planks) expect(p.b1 - p.b0).toBeCloseTo(2.4, 9);
    for (let k = 0; k + 1 < N; k++) expect(planks[k]!.b0 - planks[k + 1]!.b0).toBeCloseTo(2.55, 9);
    const lo = planks.at(-1)!.b0, hi = planks[0]!.b1;
    expect(hi - lo).toBeCloseTo(N * 2.55 - 0.15, 9);
    expect((lo + hi) / 2).toBeCloseTo((sheet.b0 + sheet.b1) / 2, 9);
  });

  it("ragged ends within ±0.3 of the sheet, not all equal, and tones in {0, 1} with both present", () => {
    for (const p of plan.planks) {
      expect(Math.abs(p.a0 - plan.sheet.a0)).toBeLessThanOrEqual(0.3 + 1e-12);
      expect(Math.abs(p.a1 - plan.sheet.a1)).toBeLessThanOrEqual(0.3 + 1e-12);
      expect([0, 1]).toContain(p.tone);
    }
    expect(new Set(plan.planks.map((p) => p.a0)).size).toBeGreaterThan(1);
    expect(new Set(plan.planks.map((p) => p.tone))).toEqual(new Set([0, 1]));
  });

  it("3 beams at a0 + 1.5, the centre and a1 − 1.5, 1.4 wide, overhanging the block by 1.2", () => {
    const { sheet, planks, beams } = plan, lo = planks.at(-1)!.b0, hi = planks[0]!.b1;
    expect(beams).toHaveLength(3);
    [sheet.a0 + 1.5, (sheet.a0 + sheet.a1) / 2, sheet.a1 - 1.5].forEach((c, i) => {
      expect((beams[i]!.a0 + beams[i]!.a1) / 2).toBeCloseTo(c, 9);
      expect(beams[i]!.a1 - beams[i]!.a0).toBeCloseTo(1.4, 9);
      expect(beams[i]!.b0).toBeCloseTo(lo - 1.2, 9);
      expect(beams[i]!.b1).toBeCloseTo(hi + 1.2, 9);
    });
  });

  it("raftEnvelope is [sheet.a0 − 0.3, sheet.a1 + 0.3] × [block − 1.2, block + 1.2]", () => {
    const { sheet, planks } = plan;
    expect(raftEnvelope()).toEqual({ a0: sheet.a0 - 0.3, a1: sheet.a1 + 0.3, b0: planks.at(-1)!.b0 - 1.2, b1: planks[0]!.b1 + 1.2 });
  });

  it.each(SITES)("%s: raftPlane at rest is groundDiagonal with the sheet centre on the site at z BOARD_TOP", (site) => {
    const pl = raftPlane(site), g = groundDiagonal(pl.origin), c = PLATFORM_SITES[site];
    expect(pl.u).toEqual(g.u);
    expect(pl.v).toEqual(g.v);
    const ca = (plan.sheet.a0 + plan.sheet.a1) / 2, cb = (plan.sheet.b0 + plan.sheet.b1) / 2;
    expect(pl.origin.x + pl.u.x * ca + pl.v.x * cb).toBeCloseTo(c.x, 9);
    expect(pl.origin.y + pl.u.y * ca + pl.v.y * cb).toBeCloseTo(c.y, 9);
    expect(pl.origin.z).toBeCloseTo(BOARD_TOP, 12);
    expect(raftPlane(site, REST_POSE)).toEqual(pl);
  });

  it.each(SITES)("%s: one timber mesh; face order beams (−2), sheet (−5), then per plank back to front its 6 faces and its navy decals", (site) => {
    const r = raftAt(site);
    expect(r).toMatchObject({ kind: "mesh", mat: "timber" });
    const { beams, sheet, planks } = groups(r.faces);
    for (const f of beams) { expect(f.mat ?? "timber").toBe("timber"); expect(f.toneOffset).toBe(-2); }
    expect(sheet.mat ?? "timber").toBe("timber");
    expect(sheet.toneOffset).toBe(-5);
    expect(sheet.pts.every((p) => Math.abs(p.z - -0.9) < 1e-12)).toBe(true);
    expect(planks).toHaveLength(plan.planks.length);
    planks.forEach((g, k) => {
      for (const f of g.faces) { expect(f.mat ?? "timber").toBe("timber"); expect(f.toneOffset ?? 0).toBe(plan.planks[k]!.tone); }
      for (const d of g.decals) { expect(d.mat).toBe("navy"); expect(d.toneOffset ?? 0).toBe(plan.planks[k]!.tone); }
    });
    expect(planks.reduce((n, g) => n + g.decals.length, 0)).toBeGreaterThan(0);
  });

  it.each(SITES)("%s: every decal lies inside its plank's rectangle (±1e-9), on its top at BOARD_TOP", (site) => {
    const { planks } = groups(raftAt(site).faces);
    planks.forEach((g, k) => {
      const p = plan.planks[k]!;
      for (const d of g.decals) for (const q of d.pts) {
        const t = toText(q, site);
        expect(t.x).toBeGreaterThanOrEqual(p.a0 - 1e-9);
        expect(t.x).toBeLessThanOrEqual(p.a1 + 1e-9);
        expect(t.y).toBeGreaterThanOrEqual(p.b0 - 1e-9);
        expect(t.y).toBeLessThanOrEqual(p.b1 + 1e-9);
        expect(Math.abs(q.z - BOARD_TOP)).toBeLessThanOrEqual(1e-9);
      }
    });
  });

  it("decal area is conserved: per glyph, its decals plus its parts in the joints equal its triangles (±1e-6)", () => {
    const { planks } = groups(raftAt("wide").faces), decals = planks.flatMap((g) => g.decals);
    const joints = plan.planks.slice(0, -1).map((p, k) => ({ x0: -1e6, x1: 1e6, y0: plan.planks[k + 1]!.b1, y1: p.b0 }));
    let total = 0, kept = 0, cut = 0;
    for (const g of LAYOUT) for (const t of g.quads) {
      total += area2(t);
      for (const j of joints) cut += area2(clipPolygon(t, j, lerp2));
    }
    for (const d of decals) kept += area2(d.pts.map((q) => toText(q, "wide")));
    expect(cut).toBeGreaterThan(0);
    expect(kept + cut).toBeCloseTo(total, 6);
  });

  it.each(SITES)("%s: every decal's normal is +z at rest and every mesh vertex is at z ≤ BOARD_TOP", (site) => {
    const r = raftAt(site);
    for (const f of r.faces) for (const p of f.pts) expect(p.z).toBeLessThanOrEqual(BOARD_TOP + 1e-9);
    for (const f of r.faces.filter((f) => f.mat === "navy")) expect(polygonNormal(f.pts).z).toBeGreaterThan(0);
  });

  it("every plank top faces +z and has the plank's rectangle", () => {
    const { planks } = groups(raftAt("wide").faces);
    planks.forEach((g) => expect(g.faces.filter((f) => polygonNormal(f.pts).z > 0.99 && f.pts.every((p) => Math.abs(p.z - BOARD_TOP) < 1e-9))).toHaveLength(1));
  });

  it("deterministic: two builds are equal", () => {
    expect(buildRaft()).toEqual(buildRaft());
    expect(raftAt("tall")).toEqual(raftAt("tall"));
  });

  it("the face count stays under the budget (≤ 1200)", () => {
    expect(raftAt("wide").faces.length).toBeLessThanOrEqual(1200);
  });

  describe("posed (pitch 0.02, roll 0.015, dz 0.1)", () => {
    const pose = { dz: 0.1, pitch: 0.02, roll: 0.015 };
    it.each(SITES)("%s: keeps every vertex-to-vertex distance (±1e-9)", (site) => {
      const a = raftAt(site).faces.flatMap((f) => f.pts), b = raftAt(site, pose).faces.flatMap((f) => f.pts);
      expect(b).toHaveLength(a.length);
      const d = (p: Vec3, q: Vec3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
      for (let i = 0; i < a.length; i += 7) for (let j = i + 1; j < a.length; j += 131) expect(Math.abs(d(b[i]!, b[j]!) - d(a[i]!, a[j]!))).toBeLessThanOrEqual(1e-9);
    });
    it.each(SITES)("%s: the posed plane has unit, perpendicular u′ and v′", (site) => {
      const { u, v } = raftPlane(site, pose);
      expect(Math.hypot(u.x, u.y, u.z)).toBeCloseTo(1, 9);
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 9);
      expect(dot(u, v)).toBeCloseTo(0, 9);
      expect(u.z).not.toBe(0);
    });
    it("every decal's normal equals its plank top's normal (±1e-9)", () => {
      const { planks } = groups(raftAt("wide", pose).faces);
      for (const g of planks) {
        const top = g.faces.map((f) => polygonNormal(f.pts)).reduce((a, n) => (n.z > a.z ? n : a));
        for (const d of g.decals) {
          const n = polygonNormal(d.pts), len = Math.hypot(n.x, n.y, n.z), tl = Math.hypot(top.x, top.y, top.z);
          expect(Math.abs(n.x / len - top.x / tl) + Math.abs(n.y / len - top.y / tl) + Math.abs(n.z / len - top.z / tl)).toBeLessThanOrEqual(1e-9);
        }
      }
    });
  });
});
