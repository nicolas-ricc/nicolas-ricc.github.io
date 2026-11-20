import { describe, expect, it } from "vitest";
import { polygonNormal, type Vec3 } from "../iso/geometry";
import { clipPolygon, lerp2 } from "../iso/clip";
import type { MeshFace } from "../iso/solids";
import { groundDiagonal } from "../kit/lettering";
import { SIGN_FONT, SIGN_RULES } from "../kit/legibility";
import { waterCellMat } from "./terrain";
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
/** The faces of the mesh, grouped, past the leading shadow and foam rings: beams, sheet and, per plank in list order, its 10 prism faces (then 2 grain and 6 nail faces, skipped) and its decals. */
const groups = (faces: readonly MeshFace[]) => {
  const first = faces.findIndex((f) => f.mat === undefined); // the first beam face: the rings carry their own material, the timber faces none
  const beams = faces.slice(first, first + 30), sheet = faces[first + 30]!, planks: { faces: MeshFace[]; decals: MeshFace[] }[] = [];
  let i = first + 31;
  while (i < faces.length) {
    const own = faces.slice(i, i + 10); i += 18;
    const decals: MeshFace[] = [];
    while (i < faces.length && faces[i]!.mat === "navy") decals.push(faces[i++]!);
    planks.push({ faces: own, decals });
  }
  return { beams, sheet, planks };
};

describe("raft (#454)", () => {
  it("cap 17.25, BOARD_TOP −0.4, BOARD_PAD 1.7 and the raft constants", () => {
    expect(WRITING_CAP).toBe(17.25);
    expect(BOARD_TOP).toBe(-0.4);
    expect(BOARD_PAD).toBe(1.7);
    expect(RAFT).toEqual({ plankW: 2.4, joint: 0.15, plankH: 0.5, ragged: 0.3, beamW: 1.4, beamH: 0.5, beamInset: 1.5, beamOverhang: 1.2, wetZ: -0.7, ringZ: -0.98, foamW: 1.0, shadowW: 2.0, segment: 4, grainW: 0.06, grainEdge: 0.2, nail: 0.12, nailDa: 0.35, nailDb: 0.6 });
    expect(REST_POSE).toEqual({ dz: 0, pitch: 0, roll: 0 });
  });
  it("BOARD_PAD covers the oracle's backing margin past the ragged ends (#460)", () => {
    expect(BOARD_PAD).toBeGreaterThanOrEqual(SIGN_RULES.backingW * SIGN_FONT.width + RAFT.ragged);
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

  it.each(SITES)("%s: one timber mesh; face order rings, beams (−2 / −5), sheet (−5), then per plank back to front its 10 prism faces and its navy decals", (site) => {
    const r = raftAt(site);
    expect(r).toMatchObject({ kind: "mesh", mat: "timber" });
    const { beams, sheet, planks } = groups(r.faces);
    for (const f of beams) { expect(f.mat ?? "timber").toBe("timber"); expect([-2, -5]).toContain(f.toneOffset); } // top and upper sides −2, bottom and lower sides −5
    expect(sheet.mat ?? "timber").toBe("timber");
    expect(sheet.toneOffset).toBe(-5);
    expect(sheet.pts.every((p) => Math.abs(p.z - -0.9) < 1e-12)).toBe(true);
    expect(planks).toHaveLength(plan.planks.length);
    planks.forEach((g, k) => {
      for (const f of g.faces) { expect(f.mat ?? "timber").toBe("timber"); expect([plan.planks[k]!.tone, plan.planks[k]!.tone - 2]).toContain(f.toneOffset ?? 0); } // the lower side parts are 2 darker
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

describe("water contact and texture (#455)", () => {
  const E = raftEnvelope();
  const shadowMat = (site: WritingSite) => waterCellMat(PLATFORM_SITES[site].x, PLATFORM_SITES[site].y) ?? "water";
  /** The final layout: shadow run, foam run, 3 × 10 beam faces, the sheet, then per plank 10 prism + 2 grain + 6 nail faces and its navy run. */
  const layout = (site: WritingSite) => {
    const faces = raftAt(site).faces, sm = shadowMat(site);
    let i = 0;
    const run = (ok: (f: MeshFace) => boolean) => { const s = i; while (i < faces.length && ok(faces[i]!)) i++; return faces.slice(s, i); };
    const shadow = run((f) => f.mat === sm), foam = run((f) => f.mat === "foam");
    const beams = faces.slice(i, i + 30); i += 30;
    const sheet = faces[i++]!, planks: { prism: MeshFace[]; grain: MeshFace[]; nails: MeshFace[]; decals: MeshFace[]; start: number }[] = [];
    while (i < faces.length) {
      const start = i, prism = faces.slice(i, i + 10), grain = faces.slice(i + 10, i + 12), nails = faces.slice(i + 12, i + 18);
      i += 18;
      planks.push({ prism, grain, nails, decals: run((f) => f.mat === "navy"), start });
    }
    return { faces, shadow, foam, beams, sheet, planks };
  };
  /** Per-axis (Chebyshev) distance of a text point outside the envelope; negative inside. */
  const axisDist = (q: { x: number; y: number }) => Math.max(E.a0 - q.x, q.x - E.a1, E.b0 - q.y, q.y - E.b1);
  const zs = (f: MeshFace) => [Math.min(...f.pts.map((p) => p.z)), Math.max(...f.pts.map((p) => p.z))];
  const rectOf = (f: MeshFace, site: WritingSite) => { const t = f.pts.map((q) => toText(q, site)); return { a0: Math.min(...t.map((q) => q.x)), a1: Math.max(...t.map((q) => q.x)), b0: Math.min(...t.map((q) => q.y)), b1: Math.max(...t.map((q) => q.y)) }; };
  const isSide = (f: MeshFace) => Math.abs(polygonNormal(f.pts).z) < 1e-9;
  const segs = (L: number) => Math.max(1, Math.round(L / 4));
  const ringCount = (d0: number, d1: number) => 2 * segs(E.a1 - E.a0 + 2 * d1) + 2 * segs(E.b1 - E.b0 + 2 * d0);

  it.each(SITES)("%s: the layout consumes every face: shadow, foam, beams, sheet, planks (prism < grain < nails < decals)", (site) => {
    const l = layout(site);
    expect(l.shadow).toHaveLength(ringCount(1, 3));
    expect(l.foam).toHaveLength(ringCount(0, 1));
    expect(l.planks).toHaveLength(plan.planks.length);
    expect(l.planks.at(-1)!.start + 18 + l.planks.at(-1)!.decals.length).toBe(l.faces.length);
    for (const f of [...l.beams, l.sheet]) expect(f.mat ?? "timber").toBe("timber");
    for (const g of l.planks) for (const f of [...g.prism, ...g.grain, ...g.nails]) expect(f.mat ?? "timber").toBe("timber");
  });

  it.each(SITES)("%s: shadow ring in the site's water material (waterCellMat ?? water) at −5; foam ring alternating 0 / −1", (site) => {
    const l = layout(site);
    for (const f of l.shadow) { expect(f.mat).toBe(shadowMat(site)); expect(f.toneOffset).toBe(-5); }
    l.foam.forEach((f, k) => expect(f.toneOffset ?? 0).toBe(k % 2 ? -1 : 0));
  });

  it.each(SITES)("%s: ring faces are 4-point rectangles at z −0.98 facing up, segments 2..6 u long", (site) => {
    const l = layout(site);
    for (const f of [...l.shadow, ...l.foam]) {
      expect(f.pts).toHaveLength(4);
      for (const p of f.pts) expect(p.z).toBeCloseTo(-0.98, 9);
      expect(polygonNormal(f.pts).z).toBeGreaterThan(0);
      const r = rectOf(f, site), long = Math.max(r.a1 - r.a0, r.b1 - r.b0);
      expect(long).toBeGreaterThanOrEqual(2);
      expect(long).toBeLessThanOrEqual(6);
    }
  });

  it.each(SITES)("%s: foam vertices at per-axis distance [0, 1] of raftEnvelope(), shadow vertices at [1, 3]", (site) => {
    const l = layout(site);
    const check = (fs: MeshFace[], lo: number, hi: number) => {
      for (const f of fs) {
        const ds = f.pts.map((q) => axisDist(toText(q, site)));
        for (const d of ds) { expect(d).toBeGreaterThanOrEqual(lo - 1e-9); expect(d).toBeLessThanOrEqual(hi + 1e-9); }
        expect(Math.min(...ds)).toBeCloseTo(lo, 9); // touches the inner edge of its ring
      }
    };
    check(l.foam, 0, 1);
    check(l.shadow, 1, 3);
  });

  it.each(SITES)("%s: ring faces are pairwise disjoint (overlap area ≤ 1e-9) and cover their rings", (site) => {
    const l = layout(site), rs = [...l.shadow, ...l.foam].map((f) => rectOf(f, site));
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i]!, b = rs[j]!, w = Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0), h = Math.min(a.b1, b.b1) - Math.max(a.b0, b.b0);
      expect(w > 0 && h > 0 ? w * h : 0).toBeLessThanOrEqual(1e-9);
    }
    const W = E.a1 - E.a0, H = E.b1 - E.b0, sum = (fs: MeshFace[]) => fs.reduce((s, f) => { const r = rectOf(f, site); return s + (r.a1 - r.a0) * (r.b1 - r.b0); }, 0);
    expect(sum(l.foam)).toBeCloseTo((W + 2) * (H + 2) - W * H, 6);
    expect(sum(l.shadow)).toBeCloseTo((W + 6) * (H + 6) - (W + 2) * (H + 2), 6);
  });

  it.each(SITES)("%s: beams, 10 faces each: sides split exactly at z −1 ([−1, −0.9] at −2, [−1.4, −1] at −5), top −2 at −0.9, bottom −5 at −1.4", (site) => {
    const { beams } = layout(site);
    for (let b = 0; b < 3; b++) {
      const own = beams.slice(b * 10, b * 10 + 10), sides = own.filter(isSide), flats = own.filter((f) => !isSide(f));
      expect(sides).toHaveLength(8);
      for (const f of sides) {
        const [lo, hi] = zs(f) as [number, number];
        if (Math.abs(lo - -1) < 1e-12) { expect(hi).toBeCloseTo(-0.9, 12); expect(f.toneOffset).toBe(-2); }
        else { expect(lo).toBeCloseTo(-1.4, 12); expect(hi).toBeCloseTo(-1, 12); expect(f.toneOffset).toBe(-5); }
      }
      expect(sides.filter((f) => f.toneOffset === -5)).toHaveLength(4);
      const top = flats.find((f) => polygonNormal(f.pts).z > 0)!, bottom = flats.find((f) => polygonNormal(f.pts).z < 0)!;
      expect(top.toneOffset).toBe(-2);
      expect(zs(top)[0]).toBeCloseTo(-0.9, 12);
      expect(bottom.toneOffset).toBe(-5);
      expect(zs(bottom)[0]).toBeCloseTo(-1.4, 12);
    }
  });

  it.each(SITES)("%s: planks, 10 prism faces each: sides split exactly at z −0.7 ([−0.7, −0.4] at the tone, [−0.9, −0.7] at tone − 2)", (site) => {
    layout(site).planks.forEach((g, k) => {
      const t = plan.planks[k]!.tone, sides = g.prism.filter(isSide), flats = g.prism.filter((f) => !isSide(f));
      expect(sides).toHaveLength(8);
      expect(flats).toHaveLength(2);
      for (const f of flats) expect(f.toneOffset ?? 0).toBe(t);
      for (const f of sides) {
        const [lo, hi] = zs(f) as [number, number];
        if (Math.abs(hi - BOARD_TOP) < 1e-12) { expect(lo).toBeCloseTo(-0.7, 12); expect(f.toneOffset ?? 0).toBe(t); }
        else { expect(lo).toBeCloseTo(-0.9, 12); expect(hi).toBeCloseTo(-0.7, 12); expect(f.toneOffset).toBe(t - 2); }
      }
    });
  });

  it.each(SITES)("%s: grain, 2 per plank: 0.06 wide, 30–60 % of the plank long, ≥ 0.2 from its long edges, tone − 1", (site) => {
    layout(site).planks.forEach((g, k) => {
      const p = plan.planks[k]!;
      expect(g.grain).toHaveLength(2);
      for (const f of g.grain) {
        const r = rectOf(f, site);
        expect(r.b1 - r.b0).toBeCloseTo(0.06, 9);
        expect((r.a1 - r.a0) / (p.a1 - p.a0)).toBeGreaterThanOrEqual(0.3 - 1e-9);
        expect((r.a1 - r.a0) / (p.a1 - p.a0)).toBeLessThanOrEqual(0.6 + 1e-9);
        expect(r.a0).toBeGreaterThanOrEqual(p.a0 - 1e-9);
        expect(r.a1).toBeLessThanOrEqual(p.a1 + 1e-9);
        expect(r.b0).toBeGreaterThanOrEqual(p.b0 + 0.2 - 1e-9);
        expect(r.b1).toBeLessThanOrEqual(p.b1 - 0.2 + 1e-9);
        expect(f.toneOffset).toBe(p.tone - 1);
      }
    });
  });

  it.each(SITES)("%s: nails, 2 per plank × beam: 0.12 squares at (beam ± 0.35, plank centre ± 0.6), paired − − / + +, over the beam, tone − 2", (site) => {
    layout(site).planks.forEach((g, k) => {
      const p = plan.planks[k]!, bc = (p.b0 + p.b1) / 2;
      expect(g.nails).toHaveLength(6);
      g.nails.forEach((f, i) => {
        const beam = plan.beams[Math.floor(i / 2)]!, ac = (beam.a0 + beam.a1) / 2, s = i % 2 ? 1 : -1, r = rectOf(f, site);
        expect((r.a0 + r.a1) / 2).toBeCloseTo(ac + s * 0.35, 9);
        expect((r.b0 + r.b1) / 2).toBeCloseTo(bc + s * 0.6, 9);
        expect(r.a1 - r.a0).toBeCloseTo(0.12, 9);
        expect(r.b1 - r.b0).toBeCloseTo(0.12, 9);
        expect(r.a0).toBeGreaterThanOrEqual(beam.a0);
        expect(r.a1).toBeLessThanOrEqual(beam.a1);
        expect(r.b0).toBeGreaterThanOrEqual(p.b0);
        expect(r.b1).toBeLessThanOrEqual(p.b1);
        expect(f.toneOffset).toBe(p.tone - 2);
      });
    });
  });

  it.each(SITES)("%s: grain and nails lie on the plank top (z −0.4, facing up), each < 1/10 of the top's area", (site) => {
    layout(site).planks.forEach((g, k) => {
      const p = plan.planks[k]!, top = (p.a1 - p.a0) * (p.b1 - p.b0);
      for (const f of [...g.grain, ...g.nails]) {
        for (const q of f.pts) expect(Math.abs(q.z - BOARD_TOP)).toBeLessThanOrEqual(1e-9);
        expect(polygonNormal(f.pts).z).toBeGreaterThan(0);
        expect(area2(f.pts.map((q) => toText(q, site)))).toBeLessThan(top / 10);
      }
    });
  });

  it("decals are merged: fewer than 300 decal faces, each convex in text space", () => {
    const decals = raftAt("wide").faces.filter((f) => f.mat === "navy");
    expect(decals.length).toBeLessThan(300);
    for (const d of decals) {
      const t = d.pts.map((q) => toText(q, "wide")), n = t.length;
      let sign = 0;
      for (let i = 0; i < n; i++) {
        const o = t[i]!, a = t[(i + 1) % n]!, b = t[(i + 2) % n]!, c = (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        if (Math.abs(c) > 1e-9) { if (!sign) sign = Math.sign(c); expect(Math.sign(c)).toBe(sign); }
      }
    }
  });

  it.each(SITES)("%s: deterministic, tones still {0, 1}, and ≤ 1200 faces", (site) => {
    expect(raftAt(site)).toEqual(raftAt(site));
    expect(new Set(buildRaft().planks.map((p) => p.tone))).toEqual(new Set([0, 1]));
    expect(raftAt(site).faces.length).toBeLessThanOrEqual(1200);
  });
});
