import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { createRng, SEED } from "../map/seed";
import { blockAt, newCtx } from "./neighborhood-fixtures";
import { club } from "./neighborhood-club";
import { MAX_TECH_H, tech } from "./tech";
import { FACE_CAPS, blockRect, facesIn, insideInflated } from "./tech-budget";
import { CLUB } from "./tech-zoning";
import { zoneRng } from "./world";

type Prism = Solid & { kind: "prism" };
type Ramp = Solid & { kind: "ramp" };
type Beam = Solid & { kind: "beam" };
type Cone = Solid & { kind: "cone" };

const EPS = 1e-9;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
/** Boxes disjoint in x, y or z; touching is fine. */
const apart = (a: Solid, b: Solid): boolean => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x + EPS || q.max.x <= p.min.x + EPS || p.max.y <= q.min.y + EPS || q.max.y <= p.min.y + EPS || p.max.z <= q.min.z + EPS || q.max.z <= p.min.z + EPS;
};

// the real world: the CLUB block inside the `tech` scene
const scene = tech(zoneRng(SEED, "cv", 2));
const everything = [...scene.solids, ...scene.ground];
const b = blockAt(CLUB.x, CLUB.y), x = b.x, y = b.y, rect = blockRect(b);
const own = everything.filter((s) => insideInflated(s, rect));
const homes = scene.homes.filter((w) => w.pts.every((q) => q.x >= rect.x0 && q.x <= rect.x1 && q.y >= rect.y0 && q.y <= rect.y1));
const dots = scene.accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot" && a.at.x >= rect.x0 && a.at.x <= rect.x1 && a.at.y >= rect.y0 && a.at.y <= rect.y1);
const prisms = (mat: string, w: number, d: number, h: number) => own.filter((s): s is Prism => s.kind === "prism" && s.mat === mat && near(s.w, w) && near(s.d, d) && near(s.h, h));
const one = <T,>(xs: T[], what: string): T => { expect(xs, what).toHaveLength(1); return xs[0]!; };

const front = () => one(prisms("stone", 10, 6, 9), "front");
const gym = () => one(prisms("whitewash", 14, 9, 5), "gym");
const vaults = () => own.filter((s): s is Ramp => s.kind === "ramp" && s.mat === "steel" && near(s.w, 14.4) && near(s.d, 4.4) && near(s.h, 1.6));
const ridge = () => one(prisms("steel", 14.4, 0.4, 0.2), "ridge");
const floor = () => one(prisms("hullBlue", 5, 14, 0.1), "floor");
const paint = () => one(prisms("leaf", 3.6, 11, 0.05), "paint");
const hoopPosts = () => prisms("steel", 0.2, 0.2, 3);
const boards = () => prisms("whitewash", 1.2, 0.15, 0.8);
const fencePosts = () => prisms("steel", 0.15, 0.15, 3);
const wires = () => own.filter((s): s is Beam => s.kind === "beam" && s.mat === "steel" && near(s.w, 0.15) && near(s.h, 0.15));
const towers = () => prisms("steel", 0.3, 0.3, 8);
const trees = () => own.filter((s): s is Cone => s.kind === "cone" && s.mat === "leaf" && near(s.r, 1.4) && near(s.h, 4));

describe("Pedro Echagüe club (#253), over the world", () => {
  it("stone front 10×6 h 9 with blue and yellow sign and staircase window on the south wall", () => {
    const f = front(), ps = f.plates ?? [];
    expect(f.at.x).toBeCloseTo(x + 2, 9); expect(f.at.y).toBeCloseTo(y + 11, 9); expect(f.at.z).toBeCloseTo(0.3, 9);
    const blue = ps.findIndex((p) => p.wall === 2 && p.mat === "hullBlue" && near(p.u0, 0.08) && near(p.u1, 0.72) && near(p.z0, 7.3) && near(p.z1, 8.7));
    const yellow = ps.findIndex((p) => p.wall === 2 && p.mat === "safety" && near(p.u0, 0.14) && near(p.u1, 0.66) && near(p.z0, 7.55) && near(p.z1, 8.45));
    expect(blue).toBeGreaterThanOrEqual(0); expect(yellow).toBeGreaterThan(blue);
    expect(ps.some((p) => p.wall === 2 && p.mat === "glass" && near(p.z0, 0.6) && near(p.z1, 8.4))).toBe(true);
    expect(ps.filter((p) => p.wall === 2 && p.mat === "glass" && near(p.z1 - p.z0, 1.4))).toHaveLength(6);
    expect(ps.filter((p) => p.wall === 1 && p.mat === "glass" && near(p.z1 - p.z0, 1.4))).toHaveLength(3);
    expect(ps.some((p) => p.wall === 2 && p.mat === "officeDark")).toBe(true);
  });

  it("whitewash gym 14×9 h 5 with a two-ramp steel vault at z 5 and ridge at z 6.6", () => {
    const g = gym();
    expect(g.at.x).toBeCloseTo(x + 2, 9); expect(g.at.y).toBeCloseTo(y + 1, 9);
    const vs = vaults();
    expect(vs).toHaveLength(2);
    for (const v of vs) expect(v.at.z).toBeCloseTo(5, 9);
    expect(vs.map((v) => v.dir).sort()).toEqual(["n", "s"]);
    expect(ridge().at.z).toBeCloseTo(6.6, 9);
    for (const wall of [1, 2]) expect(g.plates?.some((p) => p.wall === wall && p.mat === "glass" && near(p.z0, 3.6) && near(p.z1, 4.6)), `wall ${wall}`).toBe(true);
  });

  it("club lights: all on, staircase and gym", () => {
    expect(homes.length).toBeGreaterThan(0);
    for (const w of homes) { expect(w.lit, w.group).toBe(true); expect(["club-staircase", "club-gym"]).toContain(w.group); }
    const stair = homes.filter((w) => w.group === "club-staircase"), hall = homes.filter((w) => w.group === "club-gym");
    expect(stair.length).toBeGreaterThan(0); expect(hall.length).toBeGreaterThan(0);
    for (const w of stair) {
      for (const q of w.pts) expect(q.y).toBeCloseTo(y + 17, 9);
      expect(Math.min(...w.pts.map((q) => q.z))).toBeCloseTo(0.6, 9); expect(Math.max(...w.pts.map((q) => q.z))).toBeCloseTo(8.4, 9);
    }
    for (const w of hall) {
      const east = w.pts.every((q) => near(q.x, x + 16)), south = w.pts.every((q) => near(q.y, y + 10) && q.x >= x + 12 - EPS);
      expect(east || south, JSON.stringify(w.pts)).toBe(true);
    }
  });

  it("court painted blue and green", () => {
    const f = floor(), p = paint();
    expect([f.at.x, f.at.y, f.at.z].map((v) => +v.toFixed(6))).toEqual([x + 17, y + 2, 0.3]);
    expect([p.at.x, p.at.y, p.at.z].map((v) => +v.toFixed(6))).toEqual([x + 17.7, y + 3.5, 0.4]);
  });

  it("two hoops with a whitewash backboard on the court side", () => {
    const posts = hoopPosts(), bs = boards();
    expect(posts).toHaveLength(2); expect(bs).toHaveLength(2);
    for (const p of posts) expect(p.at.z).toBeCloseTo(0.4, 9);
    const [south, north] = [...posts].sort((a, c) => a.at.y - c.at.y) as [Prism, Prism];
    for (const bd of bs) expect(bd.at.z).toBeCloseTo(2.2, 9);
    expect(bs.some((bd) => near(bd.at.y, south.at.y + 0.2))).toBe(true);
    expect(bs.some((bd) => near(bd.at.y + 0.15, north.at.y))).toBe(true);
    for (const bd of bs) { expect(bd.at.y).toBeGreaterThanOrEqual(south.at.y - EPS); expect(bd.at.y + bd.d).toBeLessThanOrEqual(north.at.y + north.d + EPS); }
  });

  it("fence: 4 posts and 2 wires at z 2.9", () => {
    expect(fencePosts()).toHaveLength(4);
    const ws = wires();
    expect(ws).toHaveLength(2);
    for (const w of ws) { expect(w.from.z).toBeCloseTo(2.9, 9); expect(w.to.z).toBeCloseTo(2.9, 9); }
  });

  it("two steel light towers h 8 with an amber dot at the tip", () => {
    const ts = towers();
    expect(ts).toHaveLength(2);
    for (const t of ts) {
      const lit = dots.filter((d) => d.color === "amber" && d.at.z >= 8 && d.at.x >= t.at.x - EPS && d.at.x <= t.at.x + t.w + EPS && d.at.y >= t.at.y - EPS && d.at.y <= t.at.y + t.d + EPS);
      expect(lit, `${t.at.x},${t.at.y}`).toHaveLength(1);
    }
  });

  it("sidewalk street lamp and tree", () => {
    expect(prisms("steel", 0.6, 0.6, 5)).toHaveLength(1);
    expect(trees()).toHaveLength(1);
  });

  it("nothing overlaps: front, gym, court, hoops, fence, towers and tree", () => {
    const pairs: [Solid, Solid, string][] = [];
    const f = front(), g = gym(), fl = floor(), pt = paint();
    pairs.push([f, g, "front-gym"], [f, ridge(), "front-ridge"], [g, fl, "gym-court"], [ridge(), fl, "ridge-court"]);
    for (const v of vaults()) pairs.push([f, v, "front-vault"], [v, fl, "vault-court"]);
    for (const s of [...hoopPosts(), ...fencePosts(), ...towers()]) pairs.push([s, fl, "post-floor"], [s, pt, "post-paint"]);
    for (const t of towers()) pairs.push([one(trees(), "tree"), t, "tree-tower"]);
    for (const [a, c, what] of pairs) expect(apart(a, c), what).toBe(true);
  });

  it("within the face cap and the height", () => {
    expect(facesIn(everything, rect)).toBeLessThanOrEqual(FACE_CAPS.club);
    for (const s of own) {
      const slender = (s.kind === "prism" && Math.min(s.w, s.d) <= 3) || (s.kind === "cylinder" && s.r <= 3);
      if (!slender) expect(bounds(s).max.z).toBeLessThanOrEqual(MAX_TECH_H + 1.5);
    }
  });

  it("the geometry does not depend on the seed", () => {
    const a = newCtx(createRng(1)), c = newCtx(createRng(99));
    club(a, b); club(c, b);
    expect(a.solids).toEqual(c.solids); expect(a.accents).toEqual(c.accents); expect(a.homes).toEqual(c.homes);
  });
});
