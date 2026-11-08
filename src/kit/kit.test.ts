import { describe, expect, it } from "vitest";
import { convexHull, type Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { LAB_LOTS, RECIPES, recipe } from "./index";
import { LANDMARK_MAX_H, RECIPE_MAX_H } from "./piece";
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

/** Point strictly inside a polygon (ray casting). */
function inPoly(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Point on some side of the polygon (within 1e-6): it is on the footprint, not in the gap. */
function onEdge(p: Vec2, poly: Vec2[]): boolean {
  return poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    return t >= -1e-9 && t <= 1 + 1e-9 && Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / Math.sqrt(l2) < 1e-6;
  });
}

/** For each concave poly, no other solid of the piece has part of its box in the gap (convex hull minus footprint). */
function concaveIntruders(solids: Solid[]): number {
  let n = 0;
  for (const s of solids) {
    if (s.kind !== "poly") continue;
    const hull = convexHull(s.footprint);
    if (hull.length === s.footprint.length) continue; // convex
    for (const o of solids) {
      if (o === s) continue;
      const b = bounds(o);
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
        const p = { x: b.min.x + ((b.max.x - b.min.x) * i) / 4, y: b.min.y + ((b.max.y - b.min.y) * j) / 4 };
        if (inPoly(p, hull) && !inPoly(p, s.footprint) && !onEdge(p, s.footprint)) n++;
      }
    }
  }
  return n;
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
      const runs = (fn: (p: Piece, lot: Lot) => void) => {
        for (const lot of lotsFor(def.name)) for (const id of STYLE_IDS) for (const seed of SEEDS) fn(def.recipe(lot, createRng(seed), STYLES[id]), lot);
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
            expect(s && "facade" in s && s.facade).toBeTruthy();
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
});
