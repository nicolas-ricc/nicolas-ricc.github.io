import { describe, expect, it } from "vitest";
import { convexHull, type Vec2 } from "../iso/geometry";
import { prism } from "../scenes/city-pieces";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { LAB_LOTS, RECIPES, recipe } from "./index";
import { LANDMARK_MAX_H, RECIPE_MAX_H, interlock } from "./piece";
import { cornice, hipRoof } from "./roofs";
import { STYLES } from "./styles";
import type { Lot, Piece } from "./types";

/** The usable lot of a city block (21×15, sidewalk inside) and the lab's (24×18). */
const LOTS: Lot[] = [
  { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 },
  { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 },
];
/** The contract's lots: the city's and the lab's, or the own lot from LAB_LOTS in those two positions. */
const lotsFor = (name: string): Lot[] => {
  const own = LAB_LOTS[name];
  return own ? LOTS.map((l) => ({ ...l, w: own.w, d: own.d, z: own.z ?? 0 })) : LOTS;
};
const STYLE_IDS = ["downtown", "bars", "residential", "civic"] as const;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-9;

const GAP_AREA_EPS = 1e-6;

/** Absolute shoelace area. */
function area(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Sutherland-Hodgman clip of a polygon to the box [min, max]; `[]` when everything is clipped. */
function clipToBox(poly: Vec2[], min: Vec2, max: Vec2): Vec2[] {
  const planes: { axis: "x" | "y"; at: number; keep: 1 | -1 }[] = [
    { axis: "x", at: min.x, keep: 1 }, { axis: "x", at: max.x, keep: -1 },
    { axis: "y", at: min.y, keep: 1 }, { axis: "y", at: max.y, keep: -1 },
  ];
  let out = poly;
  for (const { axis, at, keep } of planes) {
    const inp = out, other = axis === "x" ? "y" : "x";
    out = [];
    const inside = (p: Vec2) => (p[axis] - at) * keep >= 0;
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i]!, b = inp[(i + 1) % inp.length]!;
      if (inside(a) !== inside(b)) {
        const t = (at - a[axis]) / (b[axis] - a[axis]), q = { x: at, y: at }; // on the plane exactly, not 1 ulp off
        q[other] = a[other] + (b[other] - a[other]) * t;
        out.push(q);
      }
      if (inside(b)) out.push(b);
    }
  }
  return out;
}

/** For each concave poly, no other solid of the piece has box area in the gap (convex hull minus footprint); faces flush with the footprint contribute 0. */
function concaveIntruders(solids: Solid[]): number {
  let n = 0;
  for (const s of solids) {
    if (s.kind !== "poly") continue;
    const hull = convexHull(s.footprint);
    if (hull.length === s.footprint.length) continue; // convex
    for (const o of solids) {
      if (o === s) continue;
      const { min, max } = bounds(o);
      if (area(clipToBox(hull, min, max)) - area(clipToBox(s.footprint, min, max)) > GAP_AREA_EPS) n++;
    }
  }
  return n;
}

const OVERLAP_EPS = 1e-6;

/**
 * Pairs `[i, j]` (i < j) whose boxes interpenetrate by more than `OVERLAP_EPS` on all three axes: `sortByDepth` sorts by box,
 * so such a pair can be painted in the wrong order. Faces that touch do not count. A pair is excused only if both solids carry
 * `interlocks` (same-material joints, posts through slabs, tree × tree, a ruin's vegetation, neighbouring roofs); a body is
 * never marked, so roof × body and cornice × body still fail.
 */
function interpenetrations(solids: Solid[]): [number, number][] {
  const boxes = solids.map(bounds), out: [number, number][] = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (solids[i]!.interlocks && solids[j]!.interlocks) continue;
    const a = boxes[i]!, b = boxes[j]!;
    if ((["x", "y", "z"] as const).every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > OVERLAP_EPS)) out.push([i, j]);
  }
  return out;
}

/** Copy with `dz` added to every z coordinate (`z`, and `z0`/`z1` of the plates); the normals (`wall`, `normal`) don't move. */
function shiftZ(v: unknown, dz: number, key = ""): unknown {
  if (key === "wall" || key === "normal") return v;
  if (Array.isArray(v)) return v.map((x) => shiftZ(x, dz));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (k === "z" || k === "z0" || k === "z1") && typeof x === "number" ? x + dz : shiftZ(x, dz, k)]));
  return v;
}
const rounded = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x));

describe("kit: the concave-gap oracle", () => {
  it("detects a solid inside the gap of an L and not one resting on the wing", () => {
    const L: Solid = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }], z: 0, h: 6, mat: "plaster" };
    const inHole: Solid = { kind: "cone", at: { x: 7, y: 7, z: 0 }, r: 1, h: 2, mat: "leaf" };
    const onWing: Solid = { kind: "cone", at: { x: 2, y: 2, z: 6 }, r: 1, h: 2, mat: "leaf" };
    expect(concaveIntruders([L, inHole])).toBeGreaterThan(0);
    expect(concaveIntruders([L, onWing])).toBe(0);
  });

  it("a solid flush with the faces of the gap (on the footprint's edge) is not an intruder", () => {
    const L: Solid = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }], z: 0, h: 6, mat: "plaster" };
    const slab: Solid = { kind: "prism", at: { x: -0.5, y: -0.5, z: 6 }, w: 11, d: 4.5, h: 0.4, mat: "stone" };
    const tower: Solid = { kind: "prism", at: { x: 0, y: 0, z: 6.4 }, w: 4, d: 4, h: 8, mat: "plaster" };
    expect(concaveIntruders([L, slab, tower])).toBe(0);
  });

  it("detects a thin slab crossing the gap of an L", () => {
    const L: Solid = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 14 }, { x: 0, y: 14 }], z: 0, h: 6, mat: "plaster" };
    const slab: Solid = { kind: "prism", at: { x: -6, y: 12, z: 0 }, w: 40, d: 0.5, h: 0.4, mat: "stone" };
    expect(concaveIntruders([L, slab])).toBe(1);
  });

  it("measures the gap with either winding of the footprint, and ignores a solid entirely outside the hull", () => {
    const ccw = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
    for (const footprint of [ccw, [...ccw].reverse()]) {
      const L: Solid = { kind: "poly", footprint, z: 0, h: 6, mat: "plaster" };
      const roof: Solid = { kind: "prism", at: { x: -1, y: -1, z: 6 }, w: 12, d: 12, h: 0.4, mat: "stone" };
      const outside: Solid = { kind: "prism", at: { x: 12, y: 12, z: 0 }, w: 2, d: 2, h: 2, mat: "stone" };
      expect(concaveIntruders([L, roof])).toBe(1);
      expect(concaveIntruders([L, outside])).toBe(0);
    }
  });
});

describe("kit: the interpenetration oracle", () => {
  const a: Solid = prism(0, 0, 0, 2, 2, 2, "stone"), b: Solid = prism(1, 1, 1, 2, 2, 2, "stone");

  it("two marked solids that overlap pass", () => {
    expect(interpenetrations([interlock(a), interlock(b)])).toEqual([]);
  });

  it("only one marked fails", () => {
    expect(interpenetrations([interlock(a), b])).toEqual([[0, 1]]);
    expect(interpenetrations([a, interlock(b)])).toEqual([[0, 1]]);
  });

  it("neither marked fails", () => {
    expect(interpenetrations([a, b])).toEqual([[0, 1]]);
  });

  it("faces that touch do not count", () => {
    expect(interpenetrations([a, prism(2, 0, 0, 2, 2, 2, "stone")])).toEqual([]);
  });

  it("a cornice or hip roof over a taller neighbour body still fails", () => {
    const body: Solid = prism(4, 0, 0, 4, 4, 6, "plaster", { facade: { floors: 2, cols: 2 } });
    expect(interpenetrations([...cornice({ x: 0, y: 0, w: 4, d: 4, z: 3 }, "stone"), body])).toEqual([[0, 1]]);
    expect(interpenetrations([...hipRoof({ x: 0, y: 0, w: 4, d: 4, z: 3 }, "stone"), body])).toEqual([[0, 1]]);
  });
});

describe("kit: contract of every registered recipe", () => {
  it("the registry has unique names and recipe() finds them", () => {
    expect(new Set(RECIPES.map((r) => r.name)).size).toBe(RECIPES.length);
    for (const def of RECIPES) expect(recipe(def.name)).toBe(def.recipe);
    expect(() => recipe("does-not-exist")).toThrow();
  });

  for (const def of RECIPES) {
    describe(def.name, () => {
      const cap = (lot: Lot) => Math.min(lot.maxH, def.landmark ? LANDMARK_MAX_H : RECIPE_MAX_H);
      const runs = (fn: (p: Piece, lot: Lot, id: (typeof STYLE_IDS)[number], seed: number) => void) => {
        for (const lot of lotsFor(def.name)) for (const id of STYLE_IDS) for (const seed of SEEDS) fn(def.recipe(lot, createRng(seed), STYLES[id]), lot, id, seed);
      };

      it("every solid inside the lot + 0.8, nothing below lot.z, height within the cap", () => {
        runs((p, lot) => {
          for (const s of [...p.solids, ...p.ground]) {
            const b = bounds(s);
            expect(b.min.x).toBeGreaterThanOrEqual(lot.x - 0.8 - EPS);
            expect(b.min.y).toBeGreaterThanOrEqual(lot.y - 0.8 - EPS);
            expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + 0.8 + EPS);
            expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + 0.8 + EPS);
            expect(b.min.z).toBeGreaterThanOrEqual(lot.z - EPS);
            expect(b.max.z).toBeLessThanOrEqual(lot.z + cap(lot) + EPS);
          }
        });
      });

      it("is deterministic", () => {
        for (const lot of lotsFor(def.name)) for (const id of STYLE_IDS) for (const seed of SEEDS) {
          expect(JSON.stringify(def.recipe(lot, createRng(seed), STYLES[id]))).toBe(JSON.stringify(def.recipe(lot, createRng(seed), STYLES[id])));
        }
      });

      it("with maxH 10 (the block facing the lit floor) it also respects the cap", () => {
        for (const base of lotsFor(def.name)) for (const id of STYLE_IDS) for (const seed of SEEDS) {
          const lot = { ...base, maxH: 10 }, p = def.recipe(lot, createRng(seed), STYLES[id]);
          for (const s of [...p.solids, ...p.ground]) expect(bounds(s).max.z).toBeLessThanOrEqual(lot.z + cap(lot) + EPS);
        }
      });

      it("windows and walls only from faces that look at the camera, of a building with a facade in the piece", () => {
        runs((p) => {
          for (const w of p.windows) {
            expect(w.wall.x > EPS || w.wall.y > EPS).toBe(true);
            expect(w.floor).toBeGreaterThanOrEqual(0);
            const s = p.solids[w.building];
            expect(s && (("facade" in s && s.facade) || ("plates" in s && s.plates?.some((q) => q.mat === "glass")))).toBeTruthy();
          }
          for (const w of p.walls) {
            expect(w.normal.x > EPS || w.normal.y > EPS).toBe(true);
            expect(w.floorH).toBeGreaterThan(0);
            expect(p.solids[w.building]).toBeDefined();
          }
        });
      });

      it("accents are not lit windows (that is lights.ts's job)", () => {
        runs((p) => { for (const a of p.accents) expect(["windowWarm", "windowCool"]).not.toContain(a.color); });
      });

      it("no foreign solid inside the gap of a concave poly", () => {
        runs((p) => expect(concaveIntruders(p.solids)).toBe(0));
      });

      it("no pair of solids interpenetrates unless both interlock (sortByDepth sorts by box)", () => {
        runs((p, lot, id, seed) => expect(interpenetrations(p.solids), `${def.name} on ${lot.x},${lot.y} ${id} seed ${seed}`).toEqual([]));
      });

      it("no body with a facade or a published wall carries interlocks", () => {
        runs((p) => {
          for (const s of p.solids) if ("facade" in s && s.facade) expect(s.interlocks).toBeUndefined();
          for (const w of p.walls) expect(p.solids[w.building]!.interlocks).toBeUndefined();
        });
      });

      it("with lot.z = 0.3 the output is that of lot.z = 0 shifted 0.3 in z", () => {
        for (const lot of lotsFor(def.name)) for (const seed of SEEDS.slice(0, 5)) {
          const base = def.recipe(lot, createRng(seed), STYLES.downtown);
          const up = def.recipe({ ...lot, z: lot.z + 0.3 }, createRng(seed), STYLES.downtown);
          expect(rounded(up)).toBe(rounded(shiftZ(base, 0.3)));
        }
      });
    });
  }
});

describe("kit: modern family", () => {
  it("registers the four district pieces; glass, classic and site are landmarks", () => {
    const modern = RECIPES.filter((r) => r.family === "modern");
    expect(modern.map((r) => r.name)).toEqual(["glassTower", "classic", "campus", "constructionSite"]);
    expect(modern.filter((r) => r.landmark).map((r) => r.name)).toEqual(["glassTower", "classic", "constructionSite"]);
  });

  it("campus: green courtyard in ground, three buildings with a facade and an amber sign with a box; site: slabs, crane and fence", () => {
    const lot = LOTS[0]!;
    const c = recipe("campus")(lot, createRng(4), STYLES.district);
    expect(c.ground.some((g) => g.kind === "ground" && g.mat === "leafDark")).toBe(true);
    expect(c.solids.filter((s) => "facade" in s && s.facade)).toHaveLength(3);
    expect(c.accents.some((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
    const o = recipe("constructionSite")(lot, createRng(4), STYLES.district);
    expect(o.solids.filter((s) => s.kind === "prism" && s.mat === "paving" && s.h === 0.3 && s.at.z > 1)).toHaveLength(5);
    expect(o.solids.some((s) => s.kind === "prism" && s.h === 22 && s.w === 1.2)).toBe(true); // mast
    expect(o.landmarkTop).toBeDefined();
  });

  it("glass and classic publish windows, walls, landmarkTop and a south sign only with h ≥ 12", () => {
    const lot = LOTS[0]!;
    for (const name of ["glassTower", "classic"]) for (const seed of SEEDS) {
      const p = recipe(name)(lot, createRng(seed), STYLES.district);
      expect(p.windows.length).toBeGreaterThan(0);
      expect(p.walls.length).toBeGreaterThan(0);
      expect(p.landmarkTop).toBeDefined();
      expect(p.slots.length).toBeLessThanOrEqual(1);
      for (const s of p.slots) {
        expect(s).toMatchObject({ kind: "sign", side: "s", shop: 0, wall: { x: 0, y: 1, z: 0 } });
        expect(s.pts).toHaveLength(4);
        expect(new Set(s.pts.map((q) => q.y)).size).toBe(1);
      }
    }
    // with a low cap there is no sign: the body doesn't reach 12
    expect(recipe("classic")({ ...lot, maxH: 15 }, createRng(1), STYLES.district).slots).toEqual([]);
  });

  it("classic: the clock is an amberBleed octagon with alpha 0.9 and radius 1.2, 0.02 in front of the body's south face", () => {
    for (const seed of SEEDS) {
      const p = recipe("classic")(LOTS[0]!, createRng(seed), STYLES.district);
      const body = p.solids.find((s) => s.kind === "prism" && !!s.facade)!;
      const c = p.accents.find((a) => a.kind === "poly" && a.color === "amberBleed");
      if (!c || c.kind !== "poly" || body.kind !== "prism") throw new Error("no clock");
      expect(c.alpha).toBe(0.9);
      expect(c.pts).toHaveLength(8);
      for (const q of c.pts) expect(q.y).toBeCloseTo(body.at.y + body.d + 0.02, 9);
      const cx = body.at.x + body.w / 2, cz = c.pts[0]!.z;
      for (const q of c.pts) expect(Math.hypot(q.x - cx, q.z - cz)).toBeCloseTo(1.2, 9);
    }
  });

  it("the style sets cornices and roof: the style's trim and roof, tone on bodies with a facade", () => {
    const lot = LOTS[0]!, style = { ...STYLES.bars, tone: 1 };
    for (const seed of SEEDS) {
      const p = recipe("classic")(lot, createRng(seed), style);
      expect(p.solids.some((s) => s.mat === "officeDark" && s.kind === "prism" && s.h === 1)).toBe(true); // heavy cornice = trim
      const gable = p.solids.find((s) => s.kind === "prism" && s.roof === "gable");
      if (gable) expect(gable.mat).toBe("terracotta");
      for (const s of p.solids) if ("facade" in s && s.facade) expect(s.tone).toBe(1);
    }
  });
  it("classic: the ground-floor pilasters interlock (corner pair), the body and cornice do not", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("classic")(lot, createRng(seed), STYLES.district);
      const pilasters = p.solids.filter((s) => s.kind === "prism" && s.w === 0.4 && s.d === 0.4);
      expect(pilasters.length).toBeGreaterThan(8);
      for (const s of pilasters) expect(s.interlocks).toBe(true);
      for (const s of p.solids) if (("facade" in s && s.facade) || (s.kind === "prism" && s.h === 1)) expect(s.interlocks).toBeUndefined();
    }
  });

  it("campus: no tree box touches a table box; trees interlock", () => {
    let treeCount = 0;
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("campus")(lot, createRng(seed), STYLES.district);
      const trees = p.solids.filter((s) => s.kind === "cone"), tables = p.solids.filter((s) => s.kind === "prism" && s.h === 0.7);
      expect(tables.length).toBeGreaterThan(0);
      treeCount += trees.length;
      for (const t of trees) {
        expect(t.interlocks).toBe(true);
        const a = bounds(t);
        for (const q of tables) {
          const b = bounds(q);
          expect(Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 1e-6 && Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 1e-6).toBe(false);
        }
      }
    }
    expect(treeCount).toBeGreaterThan(0);
  });

  it("constructionSite: slabs, columns, core and the crane joints interlock; hook, cable and containers do not and stay clear of every slab and column", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("constructionSite")(lot, createRng(seed), STYLES.district), sy = lot.y + 1.5, sd = 12;
      const prisms = p.solids.filter((s) => s.kind === "prism");
      const part = (label: string, test: (s: (typeof prisms)[number]) => boolean) => { const s = prisms.find(test); expect(s, label).toBeDefined(); return s!; };
      const mast = part("mast", (s) => s.h === 22 && s.w === 1.2), jib = part("jib", (s) => s.w === 13), hook = part("hook", (s) => s.mat === "rust" && s.w === 1.2 && s.d === 1.2 && s.h === 1);
      const cab = part("cab", (s) => s.w === 1.6 && s.h === 1.6), cable = part("cable", (s) => s.w === 0.6 && s.mat === "steel" && s.h < 10);
      expect(bounds(mast).min.y).toBeGreaterThanOrEqual(sy + sd - 1e-9);
      const counterJib = part("counter-jib", (s) => s.w === 8 && s.mat === "steel"), counterweight = part("counterweight", (s) => s.w === 2 && s.d === 2 && s.h === 1.5);
      for (const s of [mast, jib, counterJib, counterweight, cab]) expect(s.interlocks).toBe(true);
      const containers = prisms.filter((s) => s.mat === "rust" && s.w === 6 && s.d === 2.4 && s.h === 2.4);
      expect(containers).toHaveLength(2);
      for (const c of containers) expect(c.interlocks).toBeUndefined();
      expect(hook.interlocks).toBeUndefined();
      expect(cable.interlocks).toBeUndefined();
      const slabs = prisms.filter((s) => s.mat === "paving" && s.h === 0.3), columns = prisms.filter((s) => s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 15);
      const core = part("core", (s) => s.mat === "officeDark" && s.w === 4 && s.d === 4);
      expect(slabs).toHaveLength(5);
      expect(columns).toHaveLength(6);
      for (const s of [...slabs, ...columns, core]) expect(s.interlocks).toBe(true);
      const overlap = (a: Solid, b: Solid) => (["x", "y", "z"] as const).every((ax) => Math.min(bounds(a).max[ax], bounds(b).max[ax]) - Math.max(bounds(a).min[ax], bounds(b).min[ax]) > 1e-6);
      const fence = prisms.filter((s) => s.mat === "officeDark" && s.h === 1.2);
      expect(fence).toHaveLength(4);
      for (const o of [...fence, ...slabs]) expect(overlap(mast, o), "mast").toBe(false);
      for (const c of containers) for (const o of [...columns, ...slabs]) expect(overlap(c, o), "container").toBe(false);
      for (const o of [...columns, ...slabs]) { expect(overlap(hook, o), "hook").toBe(false); expect(overlap(cable, o), "cable").toBe(false); }
    }
  });
});
