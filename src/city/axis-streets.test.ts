import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../iso/solids";
import { axis, axisBand, crossingPlazas, pointInPoly, type Bounds2 } from "../scenes/city-plan";
import { axisCrossings, axisCrosswalks, axisLampSpots, axisLanes, boulevardPlanter, crossingPlaza } from "./axis-streets";

// #478: the axis street language of D13 (story #471), parametrized by bounds so the city (#473) and the south share it.
const B: Bounds2 = { x0: -30, y0: 330, x1: 60, y1: 420 };
const never = () => false;
const inB = (s: Solid) => { const q = bounds(s); return q.min.x >= B.x0 - 1e-9 && q.max.x <= B.x1 + 1e-9 && q.min.y >= B.y0 - 1e-9 && q.max.y <= B.y1 + 1e-9; };
const onBand = (id: string, x: number, y: number) => pointInPoly(x, y, axisBand(axis(id)));
const len = (s: Solid & { kind: "strip" }) => Math.hypot(s.path[1]!.x - s.path[0]!.x, s.path[1]!.y - s.path[0]!.y);

describe("axis-streets", () => {
  it("axisLanes: dashes 5 long, width 0.4, paving, inside bounds; two lanes on the Avenida del Barrio at y 375.5 and 380.5", () => {
    const g: Solid[] = [];
    axisLanes(g, B, never);
    expect(g.length).toBeGreaterThan(10);
    for (const s of g) { expect(s.kind).toBe("strip"); if (s.kind !== "strip") continue; expect(s.width).toBe(0.4); expect(s.mat).toBe("paving"); expect(len(s)).toBeCloseTo(5, 6); expect(inB(s)).toBe(true); }
    const ys = new Set(g.flatMap((s) => (s.kind === "strip" && s.path.every((q) => q.y === s.path[0]!.y) ? [s.path[0]!.y] : [])));
    expect(ys).toContain(375.5); expect(ys).toContain(380.5);
  });
  it("axisLanes honours stop", () => {
    const g: Solid[] = [];
    axisLanes(g, B, (x) => x < 20);
    for (const s of g) if (s.kind === "strip") for (const q of s.path) expect(q.x).toBeGreaterThanOrEqual(20);
  });
  it("boulevardPlanter: leafDark 4 wide h 0.3 on the boulevard center, trees every 8 on it", () => {
    const s: Solid[] = [];
    boulevardPlanter(s, B, never);
    const beds = s.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.mat === "leafDark");
    expect(beds.length).toBeGreaterThan(0);
    for (const b of beds) { expect(b.w).toBe(4); expect(b.h).toBe(0.3); expect(b.at.x).toBe(8); }
    const trees = s.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone").map((t) => t.at.y).sort((a, b) => a - b);
    expect(trees.length).toBeGreaterThan(3);
    for (const t of s.filter((x) => x.kind === "cone")) expect(beds.some((b) => { const q = bounds(t); return q.min.x >= b.at.x - 2 && q.max.x <= b.at.x + b.w + 2; })).toBe(true);
    const gaps = trees.slice(1).map((y, i) => y - trees[i]!);
    expect(gaps.some((g) => Math.abs(g - 8) < 1e-6)).toBe(true);
  });
  it("axisCrossings: Avenida del Barrio × Bulevar at (10, 378); none inside a crossing plaza", () => {
    const cs = axisCrossings(B, never);
    expect(cs.some((c) => Math.abs(c.x - 10) < 1e-6 && Math.abs(c.y - 378) < 1e-6)).toBe(true);
    for (const c of cs) for (const p of crossingPlazas()) expect(pointInPoly(c.x, c.y, p)).toBe(false);
  });
  it("axisCrosswalks: 3 strips of 0.8, 1.6 apart, across each axis at the crossing; traffic lights", () => {
    const g: Solid[] = [], s: Solid[] = [];
    axisCrosswalks(g, s, B, never);
    const z = g.filter((x): x is Solid & { kind: "strip" } => x.kind === "strip" && x.width === 0.8);
    expect(z.length).toBeGreaterThanOrEqual(12); // 2 × 3 across the avenue, 2 × 3 across the boulevard
    const acrossAvenue = z.filter((x) => x.path.every((q) => onBand("barrio", q.x, q.y))).map((x) => x.path[0]!.x).sort((a, b) => a - b);
    expect(acrossAvenue.length).toBeGreaterThanOrEqual(6);
    expect(acrossAvenue[1]! - acrossAvenue[0]!).toBeCloseTo(1.6, 6);
    expect(s.length).toBeGreaterThan(0);
  });
  it("axisCrosswalks: no strip touches another axis band, at the right angle and at the oblique crossing", () => {
    for (const [b, at] of [[B, { x: 10, y: 378 }], [{ x0: -100, y0: 330, x1: 60, y1: 420 }, { x: -75.9, y: 378 }]] as const) {
      const g: Solid[] = [], s: Solid[] = [];
      axisCrosswalks(g, s, b, never);
      const z = g.filter((x): x is Solid & { kind: "strip" } => x.kind === "strip" && x.width === 0.8 && x.path.every((q) => Math.hypot(q.x - at.x, q.y - at.y) < 45));
      expect(z.length, `strips at ${at.x}`).toBeGreaterThanOrEqual(6);
      for (const x of z) {
        const [p, q] = x.path as [{ x: number; y: number }, { x: number; y: number }];
        const own = ["barrio", "bulevar", "diagonalSur"].filter((id) => [p, q, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }].every((m) => onBand(id, m.x, m.y)));
        expect(own.length, JSON.stringify(x.path)).toBe(1); // each strip lies on exactly one axis: never in the junction
      }
    }
  });
  it("axisLampSpots: every 12, on the north side of E–W axes and the west side of N–S axes, inside the band", () => {
    const spots = axisLampSpots(B, never);
    const barrio = spots.filter((p) => onBand("barrio", p.x, p.y)).sort((a, b) => a.x - b.x);
    expect(barrio.length).toBeGreaterThan(3);
    for (const p of barrio) expect(p.y).toBeLessThan(378);
    expect(barrio.slice(1).some((p, i) => Math.abs(p.x - barrio[i]!.x - 12) < 1e-6)).toBe(true);
    for (const p of spots.filter((q) => onBand("bulevar", q.x, q.y) && !onBand("barrio", q.x, q.y))) expect(p.x).toBeLessThan(10);
    for (const p of spots) { expect(p.x).toBeGreaterThanOrEqual(B.x0); expect(p.x).toBeLessThanOrEqual(B.x1); expect(p.y).toBeGreaterThanOrEqual(B.y0); expect(p.y).toBeLessThanOrEqual(B.y1); }
  });
  it("crossingPlaza: plaza tiles inside the octagon, a paving curb, returns the center", () => {
    const oct = crossingPlazas().find((p) => pointInPoly(10, 342.1, p))!;
    const g: Solid[] = [], s: Solid[] = [];
    const c = crossingPlaza(g, s, oct);
    expect(Math.hypot(c.x - 10, c.y - 342.05)).toBeLessThan(0.2);
    const tiles = [...g, ...s].filter((x): x is Solid & { kind: "poly" } => x.kind === "poly" && x.mat === "plaza");
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) for (const q of t.footprint) expect(pointInPoly(q.x, q.y, oct)).toBe(true);
    expect([...g, ...s].filter((x) => x.kind === "poly" && x.mat === "paving").length).toBe(8);
  });
  it("the crossing on the Avenida del Sur (10, 318) belongs to the bounds north of it, and its crosswalks reach across the avenue", () => {
    const north: Bounds2 = { x0: -30, y0: 164, x1: 60, y1: 318 }, south: Bounds2 = { x0: -30, y0: 318, x1: 60, y1: 420 };
    const at318 = (cs: { x: number; y: number }[]) => cs.some((c) => Math.abs(c.x - 10) < 1e-6 && Math.abs(c.y - 318) < 1e-6);
    expect(at318(axisCrossings(north, never))).toBe(true);
    expect(at318(axisCrossings(south, never))).toBe(false);
    const g: Solid[] = [], s: Solid[] = [];
    axisCrosswalks(g, s, north, never);
    const acrossSur = g.filter((x): x is Solid & { kind: "strip" } => x.kind === "strip" && x.width === 0.8 && x.path.every((q) => onBand("sur", q.x, q.y) && Math.abs(q.x - 10) < 25));
    expect(acrossSur.length).toBeGreaterThanOrEqual(6);
    expect(s.some((x) => { const q = bounds(x); return Math.hypot(q.min.x - 10, q.min.y - 318) < 15; })).toBe(true);
  });
});
