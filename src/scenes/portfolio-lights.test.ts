import { beforeAll, describe, expect, it } from "vitest";
import { lightBox, WINDOW_ALPHA } from "../city/lights";
import type { Accent } from "../iso/accent";
import { hides, overlaps, screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { portfolioWindows, windowCandidates } from "./portfolio-lights";
import { shipyard } from "./shipyard";
import { world, zoneRng } from "./world";

const w = world(7);
const sy = w.shipyard!;
const fa = w.factory!;
const cands = windowCandidates(sy.solids);
const candsF = windowCandidates(sy.solids, fa.solids);
const visibleF = candsF.filter((c) => !c.hidden);
const same = (a: { x: number; y: number; z: number }[], b: { x: number; y: number; z: number }[]) => a.length === b.length && a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y && p.z === b[i]!.z);
type Poly = Extract<Accent, { kind: "poly" }>;
// the facade windows only: #323's gatehouse window is also a windowCool poly
const facadeLit = (accents: Accent[], cs: { pts: Poly["pts"] }[]): Poly[] => accents.filter((a): a is Poly => a.kind === "poly" && a.color === "windowCool" && cs.some((c) => same(c.pts, a.pts)));
const lit = facadeLit(sy.accents, cands);
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const seeded = new Map<number, ReturnType<typeof world>>();
const portfolio = (seed: number) => seeded.get(seed)!;
const hiddenBy = (pts: Poly["pts"], s: Solid): boolean => {
  const box = lightBox(pts), b = bounds(s);
  return overlaps(screenBounds(box), screenBounds(b)) && hides(box, b);
};
const subset = (a: Poly[], b: Poly[]) => a.every((x) => b.some((y) => same(x.pts, y.pts)));

describe("Portfolio windowCool windows", () => {
  beforeAll(() => { for (const seed of SEEDS) seeded.set(seed, world(seed, { zones: ["portfolio"] })); }, 20_000); // ~2.3 s alone; the full parallel suite stretched it past 8 s
  it("candidates: south walls of the halls, east and south of the workshops, east of the sheds", () => {
    expect(cands).toHaveLength(2 * 12 + 2 * (5 + 5) + 2 * 10);
    expect(new Set(cands.map((c) => c.owner)).size).toBe(6);
    for (const c of cands) expect(c.pts).toHaveLength(4);
    const sheds = cands.filter((c) => c.owner.kind === "prism" && c.owner.at.x >= 300);
    expect(sheds).toHaveLength(20);
    for (const c of sheds) for (const p of c.pts) expect(p.x).toBeCloseTo(bounds(c.owner).max.x, 9); // only their east wall
    expect(visibleF.length).toBeGreaterThanOrEqual(20);
  });

  it("25..35 % of the visible candidates are lit, all windowCool polys with WINDOW_ALPHA", () => {
    expect(lit).toHaveLength(Math.round(0.3 * visibleF.length));
    expect(lit.length / visibleF.length).toBeGreaterThanOrEqual(0.25);
    expect(lit.length / visibleF.length).toBeLessThanOrEqual(0.35);
    for (const a of lit) {
      expect(a.alpha).toBe(WINDOW_ALPHA);
      expect(visibleF.some((c) => same(c.pts, a.pts))).toBe(true);
    }
  });

  it("no lit window is hidden by another raised shipyard or factory solid", () => {
    for (const seed of SEEDS) {
      const ws = portfolio(seed);
      const own = windowCandidates(ws.shipyard!.solids);
      const occluders = [...ws.shipyard!.solids, ...ws.factory!.solids].filter((s) => !isFlat(s));
      for (const a of facadeLit(ws.shipyard!.accents, own)) {
        const owner = own.find((c) => same(c.pts, a.pts))!.owner;
        expect(occluders.filter((s) => s !== owner && hiddenBy(a.pts, s)).map(bounds), `seed ${seed}`).toEqual([]);
      }
    }
  });

  it("factory solids hide the 2 factory-only candidates of world(7)", () => {
    expect(candsF).toHaveLength(64);
    candsF.forEach((c, i) => expect(same(c.pts, cands[i]!.pts)).toBe(true)); // same candidate order
    expect(candsF.filter((c) => c.hidden)).toHaveLength(cands.filter((c) => c.hidden).length + 2);
    const turned = candsF.filter((c, i) => c.hidden && !cands[i]!.hidden);
    expect(turned).toHaveLength(2);
    for (const c of turned) expect(fa.solids.some((s) => !isFlat(s) && hiddenBy(c.pts, s))).toBe(true);
  });

  it("extra occluders never own windows", () => {
    expect(windowCandidates([], sy.solids)).toEqual([]);
    expect(windowCandidates(sy.solids, sy.solids)).toEqual(cands); // extras add no owners, and an owner never hides its own windows
  });

  it("an extra occluder in front of a window hides it", () => {
    const hall: Solid = { kind: "prism", at: v3(0, 0, 0), w: 90, d: 16, h: 10, mat: "concrete", roof: "gable" };
    const crate: Solid = { kind: "prism", at: v3(40, 18, 0), w: 6, d: 3, h: 8, mat: "steel" };
    const alone = windowCandidates([hall]);
    expect(alone).toHaveLength(12);
    expect(alone.every((c) => !c.hidden)).toBe(true);
    const covered = windowCandidates([hall], [crate]);
    expect(covered).toHaveLength(12);
    expect(covered.some((c) => c.hidden)).toBe(true);
  });

  it("windows visible before keep their rank", () => {
    for (const seed of SEEDS) {
      const ws = portfolio(seed);
      const s = ws.shipyard!.solids, f = ws.factory!.solids;
      const vis = windowCandidates(s, f).filter((c) => !c.hidden);
      const a = portfolioWindows(s, createRng(seed), f) as Poly[];
      const b = (portfolioWindows(s, createRng(seed)) as Poly[]).filter((x) => vis.some((c) => same(c.pts, x.pts)));
      expect(subset(a, b) || subset(b, a), `seed ${seed}`).toBe(true);
    }
  });

  it("world() passes the factory to the shipyard windows", () => {
    let differs = false;
    for (const seed of SEEDS) {
      const ws = portfolio(seed);
      const got = JSON.stringify(ws.shipyard!.accents);
      expect(got, `seed ${seed}`).toBe(JSON.stringify(shipyard(zoneRng(seed, "portfolio"), ws.factory!.solids).accents));
      if (got !== JSON.stringify(shipyard(zoneRng(seed, "portfolio")).accents)) differs = true;
    }
    expect(differs).toBe(true);
  });

  it("occluders only change the lit facade windows", () => {
    const a = shipyard(createRng(7)), b = shipyard(createRng(7), fa.solids);
    expect(JSON.stringify(b.ground)).toBe(JSON.stringify(a.ground));
    expect(JSON.stringify(b.solids)).toBe(JSON.stringify(a.solids));
    const own = windowCandidates(a.solids);
    const rest = (x: Accent[]) => JSON.stringify(x.filter((e) => !(e.kind === "poly" && e.color === "windowCool" && own.some((c) => same(c.pts, e.pts)))));
    expect(rest(b.accents)).toBe(rest(a.accents));
  });

  it("the north hall's 12 windows are hidden by the south hall in front of it", () => {
    const north = cands.filter((c) => c.owner.kind === "prism" && c.owner.w === 90 && c.owner.at.y === -52);
    expect(north).toHaveLength(12);
    expect(north.every((c) => c.hidden)).toBe(true);
  });

  it("deterministic by seed", () => {
    const a = JSON.stringify(portfolioWindows(sy.solids, createRng(5), fa.solids));
    expect(JSON.stringify(portfolioWindows(sy.solids, createRng(5), fa.solids))).toBe(a);
    expect(JSON.stringify(portfolioWindows(sy.solids, createRng(6), fa.solids))).not.toBe(a);
  });
});
