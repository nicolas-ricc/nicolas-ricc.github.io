import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { createRng, SEED } from "../map/seed";
import { blockAt, faces, newCtx } from "./neighborhood-fixtures";
import { plaza } from "./neighborhood-plaza";
import { suburbBlocks, type SprawlBlock } from "./sprawl-grid";
import { MAX_TECH_H, tech } from "./tech";
import { FACE_CAPS, blockRect, facesIn, insideInflated } from "./tech-budget";
import { PLAZAS, blockParity, zoneKinds } from "./tech-zoning";
import { zoneRng } from "./world";

type Prism = Solid & { kind: "prism" };
type Poly = Solid & { kind: "poly" };
type Cylinder = Solid & { kind: "cylinder" };
type Cone = Solid & { kind: "cone" };
type Ramp = Solid & { kind: "ramp" };
type Beam = Solid & { kind: "beam" };

const EPS = 1e-9;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
/** Boxes disjoint in x, y or z; touching is fine. */
const apart = (a: Solid, b: Solid): boolean => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x + EPS || q.max.x <= p.min.x + EPS || p.max.y <= q.min.y + EPS || q.max.y <= p.min.y + EPS || p.max.z <= q.min.z + EPS || q.max.z <= p.min.z + EPS;
};
const one = <T,>(xs: T[], what: string): T => { expect(xs, what).toHaveLength(1); return xs[0]!; };

/** The pieces of a plaza, classified by shape, material and measurements. */
function parts(ss: readonly Solid[]) {
  const prisms = (mat: string, w: number, d: number, h: number) => ss.filter((s): s is Prism => s.kind === "prism" && s.mat === mat && near(s.w, w) && near(s.d, d) && near(s.h, h));
  return {
    paths: ss.filter((s): s is Poly => s.kind === "poly" && s.mat === "paving"),
    strips: ss.filter((s) => s.kind === "strip"),
    ring: ss.filter((s): s is Cylinder => s.kind === "cylinder" && s.mat === "signal"),
    roof: ss.filter((s): s is Cone => s.kind === "cone" && s.mat === "safety"),
    ramp: ss.filter((s): s is Ramp => s.kind === "ramp" && s.mat === "signal"),
    platform: prisms("steel", 0.8, 0.8, 2),
    posts: prisms("steel", 0.2, 0.2, 2.4),
    beam: ss.filter((s): s is Beam => s.kind === "beam" && s.mat === "steel"),
    seats: prisms("safety", 0.6, 0.3, 0.15),
    sand: prisms("sand", 3, 3, 0.2),
    benches: prisms("concrete", 1.6, 0.5, 0.45),
    trees: ss.filter((s): s is Cone => s.kind === "cone" && s.mat === "leaf"),
    lamps: prisms("steel", 0.6, 0.6, 5),
  };
}
type Parts = ReturnType<typeof parts>;

/** Quadrant (in local coordinates) of the footprint center of a set of solids. */
function quadrant(b: SprawlBlock, ss: readonly Solid[]): string {
  const bs = ss.map(bounds), cx = (Math.min(...bs.map((q) => q.min.x)) + Math.max(...bs.map((q) => q.max.x))) / 2 - b.x, cy = (Math.min(...bs.map((q) => q.min.y)) + Math.max(...bs.map((q) => q.max.y))) / 2 - b.y;
  return (cy < 9 ? "N" : "S") + (cx > 12 ? "E" : "W");
}

/** Signed distances from a point to the axes of the two paths (NW→SE and SW→NE). */
const axes = (b: SprawlBlock, px: number, py: number): [number, number] => [(3 * (px - b.x) - 4 * (py - b.y)) / 5, (3 * (px - b.x) + 4 * (py - b.y) - 72) / 5];
/** The four corners of the footprint box on the same side of each axis and at ≥ 0.6 from it (outside the 1.2 path). */
function offPaths(b: SprawlBlock, s: Solid): boolean {
  const q = bounds(s), corners = [[q.min.x, q.min.y], [q.max.x, q.min.y], [q.min.x, q.max.y], [q.max.x, q.max.y]] as const;
  return [0, 1].every((k) => { const d = corners.map(([px, py]) => axes(b, px, py)[k]!); return d.every((v) => v >= 0.6 - EPS) || d.every((v) => v <= -0.6 + EPS); });
}

/** Groups that cannot overlap each other: each play structure, each bench, each tree. */
const groups = (p: Parts): Solid[][] => [[...p.ring, ...p.roof], [...p.platform, ...p.ramp], [...p.posts, ...p.beam, ...p.seats], p.sand, ...p.benches.map((s) => [s]), ...p.trees.map((s) => [s])];

/** Paths, carousel, slide, swings and sandbox according to parity. */
function checkPlay(b: SprawlBlock, p: Parts): void {
  const at = `${b.x},${b.y}`, { x, y } = b;
  expect(p.strips, at).toHaveLength(0);
  expect(p.paths, at).toHaveLength(2);
  const fps = p.paths.map((s) => { expect(s.z, at).toBeCloseTo(0.05, 9); return s.footprint.map((q) => [+(q.x - x).toFixed(6), +(q.y - y).toFixed(6)]); });
  expect(fps, at).toContainEqual([[-1, 0], [1, 0], [25, 18], [23, 18]]);
  expect(fps, at).toContainEqual([[-1, 18], [23, 0], [25, 0], [1, 18]]);

  const ring = one(p.ring, `carousel ${at}`), roof = one(p.roof, `roof ${at}`);
  expect([ring.r, ring.h, ring.at.z]).toEqual([1.6, 0.4, 0.05]);
  expect([roof.r, roof.h]).toEqual([1.9, 1.2]);
  expect(roof.at.x).toBeCloseTo(ring.at.x, 9); expect(roof.at.y).toBeCloseTo(ring.at.y, 9); expect(roof.at.z).toBeCloseTo(ring.at.z + ring.h, 9);
  const carousel = quadrant(b, [ring, roof]), swingsQ = blockParity(b) === 0 ? "SW" : "NE";
  expect(carousel, at).toBe(blockParity(b) === 0 ? "NE" : "SW");

  const ramp = one(p.ramp, `ramp ${at}`), plat = one(p.platform, `platform ${at}`);
  expect([ramp.w, ramp.d, ramp.h, ramp.dir]).toEqual([0.8, 2.4, 1.8, "s"]);
  expect(ramp.at.x).toBeCloseTo(plat.at.x, 9); expect(ramp.at.y).toBeCloseTo(plat.at.y + plat.d, 9);
  expect(quadrant(b, [ramp, plat]), at).toBe("SE");

  expect(p.posts, at).toHaveLength(2);
  const [w, e] = [...p.posts].sort((a, c) => a.at.x - c.at.x) as [Prism, Prism];
  expect(e.at.x - w.at.x).toBeCloseTo(2.6, 9); expect(e.at.y).toBeCloseTo(w.at.y, 9);
  const beam = one(p.beam, `beam ${at}`);
  expect(beam.from.z).toBeCloseTo(beam.to.z, 9); expect(beam.from.y).toBeCloseTo(beam.to.y, 9);
  expect(Math.min(beam.from.x, beam.to.x)).toBeLessThanOrEqual(w.at.x + w.w / 2 + EPS); expect(Math.max(beam.from.x, beam.to.x)).toBeGreaterThanOrEqual(e.at.x + e.w / 2 - EPS);
  expect(p.seats, at).toHaveLength(2);
  for (const s of p.seats) { expect(s.at.x).toBeGreaterThanOrEqual(w.at.x + w.w - EPS); expect(s.at.x + s.w).toBeLessThanOrEqual(e.at.x + EPS); expect(s.at.z + s.h).toBeLessThanOrEqual(beam.from.z - beam.h / 2 + EPS); }
  expect(quadrant(b, [...p.posts, beam, ...p.seats]), at).toBe(swingsQ);

  expect(quadrant(b, [one(p.sand, `sandbox ${at}`)]), at).toBe("NW");
}

/** Benches, trees, street lamps, clear paths and no overlaps. */
function checkRest(b: SprawlBlock, p: Parts, dots: readonly (Accent & { kind: "dot" })[]): void {
  const at = `${b.x},${b.y}`;
  expect(p.benches, at).toHaveLength(2);
  expect(p.trees.length, at).toBeGreaterThanOrEqual(2);
  for (const t of p.trees) { expect(t.r).toBeGreaterThanOrEqual(1.5); expect(t.r).toBeLessThanOrEqual(2); expect(t.h).toBeGreaterThanOrEqual(4); expect(t.h).toBeLessThanOrEqual(5.5); }
  expect(p.lamps, at).toHaveLength(2);
  for (const l of p.lamps) expect(dots.filter((d) => d.color === "amber" && d.at.x >= l.at.x - EPS && d.at.x <= l.at.x + l.w + EPS && d.at.y >= l.at.y - EPS && d.at.y <= l.at.y + l.d + EPS), at).toHaveLength(1);
  const gs = groups(p);
  for (const g of gs) for (const s of g) expect(offPaths(b, s), `${at} on a path: ${JSON.stringify(bounds(s))}`).toBe(true);
  const all = gs.flat(); // also within each play structure: beam and posts, roof and disc, ramp and platform only touch
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(apart(all[i]!, all[j]!), `${at} ${JSON.stringify(bounds(all[i]!))} × ${JSON.stringify(bounds(all[j]!))}`).toBe(true);
}

// synthetic blocks: (36, 328) parity 0, (6, 328) parity 1; plus the two fixed plazas
const base = blockAt(PLAZAS[0].x, PLAZAS[0].y);
const synth = [{ ...base, x: 36, y: 328 }, { ...base, x: 6, y: 328 }, base, blockAt(PLAZAS[1].x, PLAZAS[1].y)];
const build = (b: SprawlBlock, seed = 7) => { const ctx = newCtx(createRng(seed)); plaza(ctx, b); return ctx; };
const dotsOf = (accents: readonly Accent[]) => accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");

describe("neighborhood plaza (#254), direct call", () => {
  it("the synthetic ones cover both parities and so do the fixed ones", () => {
    expect(synth.map(blockParity)).toEqual([0, 1, 0, 1]);
  });

  for (const b of synth) {
    it(`(${b.x},${b.y}) parity ${blockParity(b)}: diagonal paths and play structures in their quadrant`, () => {
      for (const seed of [1, 2, 3]) checkPlay(b, parts(build(b, seed).solids));
    });
    it(`(${b.x},${b.y}): play structures off the paths and without overlapping`, () => {
      for (const seed of [1, 2, 3]) {
        const p = parts(build(b, seed).solids), play = groups(p).slice(0, 4);
        for (const g of play) for (const s of g) expect(offPaths(b, s), JSON.stringify(bounds(s))).toBe(true);
        for (let i = 0; i < play.length; i++) for (let j = i + 1; j < play.length; j++) for (const a of play[i]!) for (const c of play[j]!) expect(apart(a, c)).toBe(true);
      }
    });
    it(`(${b.x},${b.y}): benches, trees and street lamps; within the cap`, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const ctx = build(b, seed);
        checkRest(b, parts(ctx.solids), dotsOf(ctx.accents));
        expect(faces(ctx)).toBeLessThanOrEqual(FACE_CAPS.plaza);
      }
    });
  }

  it("variety: the same block with another seed moves the slide or the sandbox", () => {
    const xs = (seed: number) => { const p = parts(build(base, seed).solids); return [one(p.platform, "platform").at.x, one(p.sand, "sandbox").at.x]; };
    expect(xs(1)).not.toEqual(xs(2));
  });
});

// the real world: the `plaza` blocks according to the pre-pass
const scene = tech(zoneRng(SEED, "cv", 2));
const everything = [...scene.solids, ...scene.ground];
const blocks = suburbBlocks(), kinds = zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const plazaBlocks = blocks.filter((_, i) => kinds[i] === "plaza");
const own = (b: SprawlBlock) => everything.filter((s) => insideInflated(s, blockRect(b)));
const dotsIn = (b: SprawlBlock) => { const r = blockRect(b); return dotsOf(scene.accents).filter((d) => d.at.x >= r.x0 && d.at.x <= r.x1 && d.at.y >= r.y0 && d.at.y <= r.y1); };

describe("neighborhood plaza (#254), over the world", () => {
  it("there are 7 plazas, including the two fixed ones", () => {
    expect(plazaBlocks).toHaveLength(7);
    for (const p of PLAZAS) expect(plazaBlocks.some((b) => b.x === p.x && b.y === p.y)).toBe(true);
  });

  it("each plaza: paths, play structures by parity, benches, trees and street lamps, no overlaps and nothing on the paths", () => {
    for (const b of plazaBlocks) { const p = parts(own(b)); checkPlay(b, p); checkRest(b, p, dotsIn(b)); }
  });

  it("each plaza within the face cap and the height", () => {
    for (const b of plazaBlocks) {
      expect(facesIn(everything, blockRect(b)), `${b.x},${b.y}`).toBeLessThanOrEqual(FACE_CAPS.plaza);
      for (const s of own(b)) {
        const slender = (s.kind === "prism" && Math.min(s.w, s.d) <= 3) || (s.kind === "cylinder" && s.r <= 3);
        if (!slender) expect(bounds(s).max.z).toBeLessThanOrEqual(MAX_TECH_H + 1.5);
      }
    }
  });
});
