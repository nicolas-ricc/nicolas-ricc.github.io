import { describe, expect, it } from "vitest";
import { polygonNormal, type Vec2 } from "../../iso/geometry";
import { bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { RECIPES, recipe } from "../index";
import { L0, L1, SLIVER_LOT, WEDGE_LOTS, groundPlans, obliqueCorners, outsideConvex, signedArea, triangleOverlap, wedgeLot } from "../lot-fixtures";
import { STYLES } from "../styles";
import type { Lot, Piece } from "../types";
import { chamferPoly, clipConvex, clipHalf, clipToPoly, frustum, insidePoly, polyFootprint } from "./porteno";

const STYLE_IDS = ["downtown", "bars", "residential", "civic"] as const;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const area = (p: Vec2[]): number => Math.abs(signedArea(p));
const near = (a: Vec2, b: Vec2): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;

/** The existing recipes that honour `lot.poly`, and the porteno family. */
const POLY_AWARE = ["classic", "chamfer", "decoStepped", "podiumTower", "courtyardO", "courtyardU", "patioResidential", "rowHouses"];
const PORTENO = ["cornerCupola", "mansard", "balconyBlock", "portalBase"];

const runs = (name: string, lots: Lot[], fn: (p: Piece, lot: Lot, label: string) => void): void => {
  for (const lot of lots) for (const id of STYLE_IDS) for (const seed of SEEDS) fn(recipe(name)(lot, createRng(seed), STYLES[id]), lot, `${name} ${JSON.stringify(lot.poly?.[0])} ${id} seed ${seed}`);
};

describe("wedge fixtures", () => {
  it("the lab lot cut at the southeast by x + 0.42·y = c is the expected pentagon", () => {
    const poly = wedgeLot(L1, 9).poly!, c = 24 + 0.42 * 9;
    const want = [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 9 }, { x: 20.22, y: 18 }, { x: 0, y: 18 }];
    want.forEach((q, i) => { expect(poly[i]!.x).toBeCloseTo(q.x, 9); expect(poly[i]!.y).toBeCloseTo(q.y, 9); });
    for (const q of poly) expect(q.x + 0.42 * q.y).toBeLessThanOrEqual(c + 1e-9);
    expect(obliqueCorners(poly).map((o) => o.v)).toEqual([poly[2], poly[3]]);
  });

  it("triangleOverlap measures the intersection of two convex polygons", () => {
    const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(triangleOverlap(sq, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBeCloseTo(0.5, 9);
    expect(triangleOverlap(sq, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }])).toBeCloseTo(1, 9);
    expect(triangleOverlap(sq, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }])).toBe(0);
  });
});

describe("polygon helpers", () => {
  const rect = { x: 0, y: 0, w: 24, d: 18 }, wedge = wedgeLot(L1, 9).poly!;
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it("clipToPoly: a rectangle cut by a diagonal is a pentagon", () => {
    const c = clipToPoly(rect, wedge);
    expect(c).toHaveLength(5);
    expect(area(c)).toBeCloseTo(24 * 18 - (9 * 3.78) / 2, 9);
  });

  it("clipToPoly: a rectangle inside returns its four corners, one outside returns []", () => {
    const inside = clipToPoly({ x: 2, y: 2, w: 4, d: 4 }, wedge);
    expect(inside).toHaveLength(4);
    expect(area(inside)).toBeCloseTo(16, 9);
    expect(clipToPoly({ x: 30, y: 30, w: 4, d: 4 }, wedge)).toEqual([]);
  });

  it("clipToPoly: either winding of the polygon gives the same clip", () => {
    expect(area(clipToPoly(rect, [...wedge].reverse()))).toBeCloseTo(area(clipToPoly(rect, wedge)), 9);
  });

  it("clipToPoly: a non-convex polygon clips like its convex hull", () => {
    const L = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 20 }, { x: 0, y: 20 }];
    const hull = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 }, { x: 4, y: 20 }, { x: 0, y: 20 }];
    expect(area(clipToPoly(rect, L))).toBeCloseTo(area(clipToPoly(rect, hull)), 9);
  });

  it("clipConvex and clipHalf keep the inside half", () => {
    expect(area(clipHalf(square, 1, 0, 4))).toBeCloseTo(40, 9); // x ≤ 4
    expect(area(clipConvex(square, [{ x: 5, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 5, y: 20 }]))).toBeCloseTo(50, 9);
  });

  it("chamferPoly: a square chamfered by k is an octagon with cuts of k along each edge", () => {
    const o = chamferPoly(square, 2);
    expect(o).toHaveLength(8);
    for (const q of o) {
      const d = Math.min(...square.map((c) => Math.hypot(q.x - c.x, q.y - c.y)));
      expect(d).toBeCloseTo(2, 9);
      expect(q.x === 0 || q.x === 10 || q.y === 0 || q.y === 10).toBe(true);
    }
  });

  it("chamferPoly: edges not longer than 3k are left; oblique mode leaves the right corners", () => {
    expect(chamferPoly(square, 4)).toEqual(square);
    expect(chamferPoly(square, 2, "oblique")).toEqual(square);
    const pent = clipToPoly(rect, wedge), cut = chamferPoly(pent, 2, "oblique");
    expect(cut).toHaveLength(7);
    for (const c of [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 0, y: 18 }]) expect(cut.some((q) => near(q, c))).toBe(true);
    for (const o of obliqueCorners(pent)) expect(cut.some((q) => near(q, o.v))).toBe(false);
  });

  it("chamferPoly: nearly flat vertices are left, acute ones with long edges are cut", () => {
    const flat = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
    const c = chamferPoly(flat, 2);
    expect(c).toHaveLength(9); // four cut corners (2 each) + the collinear vertex
    expect(c.some((q) => near(q, { x: 10, y: 0 }))).toBe(true);
    const r = (10 * Math.PI) / 180, obtuse = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10 + 10 * Math.cos(r), y: 10 * Math.sin(r) }, { x: 20, y: 30 }, { x: 0, y: 30 }];
    expect(chamferPoly(obtuse, 2).some((q) => near(q, obtuse[1]!))).toBe(true);
    const tri = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 0, y: 8 }];
    expect(chamferPoly(tri, 2).some((q) => near(q, tri[1]!))).toBe(false);
  });

  it("polyFootprint: without poly, the lot minus the inset; with poly, clipped and chamfered", () => {
    const fp = polyFootprint(L1, 1, 2, "oblique");
    expect(fp).toHaveLength(4);
    expect(area(fp)).toBeCloseTo(22 * 16, 9);
    expect(polyFootprint(L1, 0, 2)).toHaveLength(8);
    const w = polyFootprint(wedgeLot(L1, 9), 0, 2, "oblique");
    expect(w).toHaveLength(7);
    expect(outsideConvex(w, wedge, 1e-9)).toEqual([]);
  });

  it("frustum: a mesh whose faces all point away from its centre, top face up", () => {
    const top = [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 }];
    const m = frustum(square, top, 5, 7, "terracotta");
    if (m.kind !== "mesh") throw new Error("not a mesh");
    const pts = m.faces.flatMap((f) => f.pts), c = { x: 5, y: 5, z: 6 };
    expect(m.faces.length).toBeGreaterThanOrEqual(5);
    for (const f of m.faces) {
      const n = polygonNormal(f.pts), fc = f.pts.reduce((a, q) => ({ x: a.x + q.x / f.pts.length, y: a.y + q.y / f.pts.length, z: a.z + q.z / f.pts.length }), { x: 0, y: 0, z: 0 });
      expect(n.x * (fc.x - c.x) + n.y * (fc.y - c.y) + n.z * (fc.z - c.z)).toBeGreaterThan(0);
    }
    expect(Math.max(...pts.map((q) => q.z))).toBe(7);
    expect(bounds(m)).toMatchObject({ min: { x: 0, y: 0, z: 5 }, max: { x: 10, y: 10, z: 7 } });
  });
});

describe("every recipe builds inside its parcel polygon", () => {
  for (const name of [...POLY_AWARE, ...PORTENO]) {
    it(`${name}: no ground-level solid leaves poly inflated 0.3`, () => {
      runs(name, WEDGE_LOTS, (p, lot, label) => expect(outsideConvex(groundPlans(p, lot).flat(), lot.poly!, 0.3), label).toEqual([]));
    });

    it(`${name}: oblique corners are chamfered (corner cut ≥ 2)`, () => {
      runs(name, WEDGE_LOTS, (p, lot, label) => {
        for (const { v, e1, e2 } of obliqueCorners(lot.poly!)) {
          const tri: [Vec2, Vec2, Vec2] = [v, { x: v.x + 2 * e1.x, y: v.y + 2 * e1.y }, { x: v.x + 2 * e2.x, y: v.y + 2 * e2.y }];
          for (const plan of groundPlans(p, lot)) expect(triangleOverlap(plan, tri), label).toBeLessThanOrEqual(1e-6);
        }
      });
    });

    it(`${name}: a sliver parcel yields no degenerate poly`, () => {
      runs(name, [SLIVER_LOT], (p, _lot, label) => {
        for (const s of [...p.solids, ...p.ground]) if (s.kind === "poly") {
          expect(s.footprint.length, label).toBeGreaterThanOrEqual(3);
          expect(area(s.footprint), label).toBeGreaterThan(1e-6);
        }
      });
    });
  }
});

/** The corner of the rectangle where the cupola goes: `chamferCorner` of the open sides. */
const cornerOf = (lot: Lot, c: "nw" | "ne" | "se" | "sw"): Vec2 => ({ x: c[1] === "e" ? lot.x + lot.w : lot.x, y: c[0] === "s" ? lot.y + lot.d : lot.y });
const domes = (p: Piece): Solid[] => p.solids.filter((s) => s.kind === "dome");
const center = (s: Solid): Vec2 => { const b = bounds(s); return { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }; };

describe("porteno family", () => {
  it("registers the four recipes, in order, as family porteno and not landmarks", () => {
    const defs = RECIPES.filter((r) => r.family === "porteno");
    expect(defs.map((r) => r.name)).toEqual(PORTENO);
    expect(defs.some((r) => r.landmark)).toBe(false);
  });

  it("cornerCupola has exactly one copper dome, over the open corner", () => {
    const cases: [Lot, "nw" | "se"][] = [[L0, "se"], [L1, "se"], ...WEDGE_LOTS.map((l): [Lot, "se"] => [l, "se"]), [{ ...L1, open: ["n", "w"] }, "nw"], [{ ...L1, open: [] }, "se"]];
    for (const [lot, corner] of cases) for (const seed of SEEDS) {
      const p = recipe("cornerCupola")(lot, createRng(seed), STYLES.downtown), d = domes(p);
      expect(d).toHaveLength(1);
      expect(d[0]!.mat).toBe("copper");
      const c = center(d[0]!), q = cornerOf(lot, corner);
      for (const other of (["nw", "ne", "se", "sw"] as const).filter((k) => k !== corner)) {
        const o = cornerOf(lot, other);
        expect(Math.hypot(c.x - q.x, c.y - q.y)).toBeLessThan(Math.hypot(c.x - o.x, c.y - o.y));
      }
      expect(p.solids.some((s) => s.kind === "cylinder")).toBe(true);
      expect(p.courtyard).toBeDefined();
    }
  });

  it("cornerCupola on a sliver parcel places no turret outside its wings", () => {
    for (const seed of SEEDS) {
      const p = recipe("cornerCupola")(SLIVER_LOT, createRng(seed), STYLES.downtown);
      expect(p.solids.filter((s) => s.kind === "dome" || s.kind === "cylinder")).toEqual([]);
    }
    for (const lot of [L0, L1, ...WEDGE_LOTS]) for (const seed of SEEDS) {
      const p = recipe("cornerCupola")(lot, createRng(seed), STYLES.downtown);
      const wings = p.solids.filter((s) => s.kind === "poly" && !!s.facade && s.z === lot.z).map((s) => (s.kind === "poly" ? s.footprint : []));
      for (const s of p.solids) if (s.kind === "cylinder") for (let i = 0; i < 16; i++) {
        const pt = { x: s.at.x + s.r * Math.cos((i * Math.PI) / 8), y: s.at.y + s.r * Math.sin((i * Math.PI) / 8) };
        expect(wings.some((w) => insidePoly(w, pt)), `seed ${seed} sample ${i}`).toBe(true);
      }
    }
  });

  it("mansard has at least 3 dormers and a sloped roof in the style's roof material", () => {
    for (const lot of [L0, L1, ...WEDGE_LOTS, { ...L1, open: [] }]) for (const id of STYLE_IDS) for (const seed of SEEDS) {
      const p = recipe("mansard")(lot, createRng(seed), STYLES[id]);
      const dormers = p.solids.filter((s) => s.kind === "prism" && !!s.facade && Math.abs(s.h - 1.6) < 1e-9 && [s.w, s.d].sort().join() === "0.8,1.4");
      expect(dormers.length).toBeGreaterThanOrEqual(3);
      expect(p.solids.some((s) => s.kind === "mesh" && s.mat === STYLES[id].roof)).toBe(true);
    }
  });

  it("balconyBlock has one slab per floor on each open face", () => {
    for (const lot of [L0, L1, ...WEDGE_LOTS, { ...L1, open: [] }]) for (const seed of SEEDS) {
      const style = STYLES.residential, p = recipe("balconyBlock")(lot, createRng(seed), style);
      const body = p.solids.find((s) => s.kind === "poly" && s.facade?.base === "glass");
      if (!body || body.kind !== "poly" || !body.facade) throw new Error("no glass-base body");
      const m = body.facade.floors, fh = body.h / m;
      expect(m).toBeGreaterThanOrEqual(2);
      const slabs = p.solids.filter((s) => s.kind === "prism" && Math.abs(s.h - 0.25) < 1e-9);
      const fp = body.footprint, n = fp.length;
      for (const side of lot.open.length ? lot.open : ["s" as const]) {
        const edges = fp.map((a, i) => [a, fp[(i + 1) % n]!] as const).filter(([a, b]) => {
          if (Math.hypot(b.x - a.x, b.y - a.y) < 2) return false;
          if (side === "s") return a.y === b.y && Math.abs(a.y - Math.max(...fp.map((q) => q.y))) < 1e-9;
          if (side === "n") return a.y === b.y && Math.abs(a.y - Math.min(...fp.map((q) => q.y))) < 1e-9;
          if (side === "e") return a.x === b.x && Math.abs(a.x - Math.max(...fp.map((q) => q.x))) < 1e-9;
          return a.x === b.x && Math.abs(a.x - Math.min(...fp.map((q) => q.x))) < 1e-9;
        });
        expect(edges.length, `${side} seed ${seed}`).toBeGreaterThan(0);
        for (const [a] of edges) for (let j = 1; j < m; j++) {
          const z = lot.z + j * fh;
          const hit = slabs.filter((s) => s.kind === "prism" && Math.abs(s.at.z - z) < 1e-6 && (side === "s" || side === "n" ? Math.abs((side === "s" ? s.at.y : s.at.y + s.d) - a.y) < 1e-6 : Math.abs((side === "e" ? s.at.x : s.at.x + s.w) - a.x) < 1e-6));
          expect(hit, `${side} floor ${j} seed ${seed}`).toHaveLength(1);
        }
      }
      expect(p.solids.some((s) => s.kind === "beam")).toBe(true);
    }
  });

  it("portalBase has a portal gap under a stone lintel between two columns, and at least one neon slot", () => {
    for (const lot of [L0, L1, ...WEDGE_LOTS, { ...L1, open: [] }]) for (const id of STYLE_IDS) for (const seed of SEEDS) {
      const p = recipe("portalBase")(lot, createRng(seed), STYLES[id]);
      const lintel = p.solids.find((s) => s.kind === "prism" && s.mat === "stone" && Math.abs(bounds(s).min.z - (lot.z + 4)) < 1e-6);
      expect(lintel, `${id} seed ${seed}`).toBeDefined();
      const c = center(lintel!), z = lot.z + 1;
      for (const s of p.solids) {
        const b = bounds(s);
        expect(c.x > b.min.x + 1e-6 && c.x < b.max.x - 1e-6 && c.y > b.min.y + 1e-6 && c.y < b.max.y - 1e-6 && z > b.min.z && z < b.max.z).toBe(false);
      }
      const cols = p.solids.filter((s) => s.kind === "cylinder" && s.mat === "stone" && Math.abs(bounds(s).max.z - (lot.z + 4)) < 1e-6);
      expect(cols).toHaveLength(2);
      expect(p.slots.filter((s) => s.kind === "neon").length).toBeGreaterThanOrEqual(1);
    }
  });
});
