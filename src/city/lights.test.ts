import { describe, expect, it } from "vitest";
import { hides, screenHull } from "../iso/depth";
import { centroid, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import type { Piece, Slot, Window } from "../kit/types";
import { createRng } from "../map/seed";
import { blocks } from "../scenes/city-grid";
import { city, type CityScene, type PlacedPiece } from "../scenes/city";
import { zoneRng } from "../scenes/world";
import { SEED } from "../map/seed";
import { lightBox, lights, MAX_ANIMABLE, MAX_NEONS, WINDOW_ALPHA } from "./lights";
import { CATALOGUE, type Neighborhood } from "./zoning";

const NEIGHBORHOODS = Object.keys(CATALOGUE) as Neighborhood[];
const prism = (x: number, y: number, z: number, w: number, d: number, h: number): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat: "plaster" });
const quad = (x0: number, x1: number, y: number, z0: number, z1: number): Vec3[] => [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, z1), v3(x0, y, z1)];
const emptyPiece = (): Piece => ({ solids: [], ground: [], accents: [], windows: [], slots: [], walls: [] });
const BLOCK = blocks().find((b) => b.kind !== "plaza")!;

/** A synthetic piece placed in `neighborhood`, with its lot at `z = 0.3` and an open south frontage. */
function placedAt(neighborhood: Neighborhood, piece: Piece, solidOffset: number, open: ("n" | "s" | "e" | "w")[] = ["s"]): PlacedPiece {
  return { placed: { block: BLOCK, neighborhood, recipe: "classic", lot: { x: 0, y: 0, w: 24, d: 18, z: 0.3, open, maxH: 18 }, tone: 0 }, piece, solidOffset };
}

/** Oracle: `true` if some solid other than `except` hides the box. No sweep; `bs` is the test's own cache. */
const hidden = (box: Bounds, bs: Bounds[], hs: Vec2[][], except = -1): boolean => bs.some((b, i) => i !== except && hides(box, b, { back: screenHull(box), front: hs[i]! }));

const SEEDS: readonly [string, () => CityScene, boolean][] = [
  ["world seed", () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)), true],
  ["other seed", () => city(createRng(7), createRng(8), createRng(9)), false],
];

for (const [name, make, isWorld] of SEEDS) {
  describe(`Resume lights (${name})`, () => {
    const s = make(), l = s.lights;
    const bs = s.solids.map(bounds), hs = bs.map(screenHull);
    const ownSolid = (w: { window: Window; owner: number }) => s.placed[w.owner]!.solidOffset + w.window.building;

    it("no lit window is hidden by a solid (brute-force oracle)", () => {
      const on = l.windows.filter((w) => w.on);
      expect(on.length).toBeGreaterThan(100);
      for (const w of on) expect(hidden(lightBox(w.window.pts), bs, hs, ownSolid(w))).toBe(false);
    });

    it("no lit window sits on the face of another solid (centroid in its x/y range, strictly inside its z)", () => {
      const E = 1e-6;
      const onFace = (c: Vec3, b: Bounds): boolean =>
        c.x >= b.min.x - E && c.x <= b.max.x + E && c.y >= b.min.y - E && c.y <= b.max.y + E && c.z > b.min.z + E && c.z < b.max.z - E;
      const bad = l.windows.filter((w) => w.on).filter((w) => { const c = centroid(w.window.pts); return bs.some((b, i) => i !== ownSolid(w) && onFace(c, b)); });
      expect(bad.map((w) => centroid(w.window.pts))).toEqual([]);
    });

    it("no neon is hidden by a solid (brute-force oracle)", () => {
      for (const n of l.neons) expect(hidden(lightBox(n.slot.pts), bs, hs)).toBe(false);
    });

    it("lit percentage ±8 and warm proportion ±10 per neighborhood with ≥ 30 candidates", () => {
      for (const b of NEIGHBORHOODS) {
        const ws = l.windows.filter((w) => s.placed[w.owner]!.placed.neighborhood === b);
        if (ws.length < 30) continue;
        const on = ws.filter((w) => w.on), warm = on.filter((w) => w.color === "windowWarm");
        expect(Math.abs(on.length / ws.length - CATALOGUE[b].lights.on)).toBeLessThanOrEqual(0.08);
        if (on.length > 0) expect(Math.abs(warm.length / on.length - CATALOGUE[b].lights.warm)).toBeLessThanOrEqual(0.1);
      }
    });

    it("counts match the windows per neighborhood", () => {
      for (const b of NEIGHBORHOODS) {
        const ws = l.windows.filter((w) => s.placed[w.owner]!.placed.neighborhood === b);
        expect(l.counts[b]).toEqual({ candidates: ws.length, on: ws.filter((w) => w.on).length, warm: ws.filter((w) => w.on && w.color === "windowWarm").length });
      }
    });

    it("the windows belong to their piece, warm or cool, and the plaza tower doesn't count", () => {
      for (const w of l.windows) {
        expect(s.placed[w.owner]!.piece.windows).toContain(w.window);
        expect(["windowWarm", "windowCool"]).toContain(w.color);
      }
      const towerWindows = new Set(s.tower.litWindows.map((a) => (a.kind === "poly" ? JSON.stringify(a.pts) : "")));
      expect(l.windows.some((w) => towerWindows.has(JSON.stringify(w.window.pts)))).toBe(false);
    });

    it(`there are at most ${MAX_ANIMABLE} animatable ones and all from downtown or residential`, () => {
      const anim = l.windows.filter((w) => w.animable);
      expect(anim.length).toBeLessThanOrEqual(MAX_ANIMABLE);
      expect(anim.length).toBeGreaterThan(0);
      for (const w of anim) expect(["downtown", "residential"]).toContain(s.placed[w.owner]!.placed.neighborhood);
    });

    it("neons: only in bars, ≤ 24, open frontage, one per shop, z 2.4..3.6 above the lot, colors with their halos and puddle", () => {
      expect(l.neons.length).toBeLessThanOrEqual(MAX_NEONS);
      if (isWorld) expect(l.neons.length).toBeGreaterThanOrEqual(3);
      const seen = new Set<string>();
      for (const n of l.neons) {
        const p = s.placed[n.owner]!;
        expect(p.placed.neighborhood).toBe("bars");
        expect(n.slot.kind).toBe("neon");
        expect(p.piece.slots).toContain(n.slot);
        expect(p.placed.lot.open).toContain(n.slot.side);
        const key = `${n.owner}:${n.slot.shop}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        for (const q of n.slot.pts) {
          expect(q.z - p.placed.lot.z).toBeGreaterThanOrEqual(2.4 - 1e-6);
          expect(q.z - p.placed.lot.z).toBeLessThanOrEqual(3.6 + 1e-6);
        }
        expect(["amber", "magenta", "cyan"]).toContain(n.color);
        expect(n.accents.some((a) => a.kind === "poly" && a.color === n.color && a.alpha === 1 && a.pts === n.slot.pts)).toBe(true);
        expect(n.accents.every((a) => a.color === n.color || a.color === `${n.color}Bleed`)).toBe(true);
        expect(n.accents.filter((a) => a.kind === "poly" && a.alpha === 0.25 && a.color === `${n.color}Bleed`)).toHaveLength(3); // the puddle
      }
    });

    it("bathed: only ground-floor bands of walls of civic pieces, amberBleed alpha 0.5", () => {
      const civicWalls = s.placed.filter((p) => p.placed.neighborhood === "civic").flatMap((p) => p.piece.walls);
      expect(l.bathed.length).toBe(civicWalls.length);
      expect(l.bathed.length).toBeGreaterThan(0);
      l.bathed.forEach((a, i) => {
        const w = civicWalls[i]!;
        expect(a).toMatchObject({ kind: "poly", color: "amberBleed", alpha: 0.5 });
        if (a.kind !== "poly") return;
        expect(a.pts).toHaveLength(4);
        const base = [w.pts[0]!, w.pts[1]!, { ...w.pts[1]!, z: w.pts[1]!.z + w.floorH }, { ...w.pts[0]!, z: w.pts[0]!.z + w.floorH }];
        a.pts.forEach((q, k) => {
          expect(q.x).toBeCloseTo(base[k]!.x + w.normal.x * 0.05, 6);
          expect(q.y).toBeCloseTo(base[k]!.y + w.normal.y * 0.05, 6);
          expect(q.z).toBeCloseTo(base[k]!.z, 6);
        });
      });
    });

    it("flicker is a valid index into neons (or null without neons) and the chosen neon is in bars", () => {
      if (l.neons.length === 0) { expect(l.flicker).toBeNull(); return; }
      expect(Number.isInteger(l.flicker)).toBe(true);
      expect(l.flicker!).toBeGreaterThanOrEqual(0);
      expect(l.flicker!).toBeLessThan(l.neons.length);
      expect(s.placed[l.neons[l.flicker!]!.owner]!.placed.neighborhood).toBe("bars");
    });

    it("the static lit windows, the neons except the flickering one and the bathed ones go to scene.accents", () => {
      for (const w of l.windows.filter((x) => x.on && !x.animable)) expect(s.accents).toContainEqual({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA });
      l.neons.forEach((n, i) => { if (i !== l.flicker) for (const a of n.accents) expect(s.accents).toContain(a); });
      for (const a of l.bathed) expect(s.accents).toContain(a);
      const off = new Set(l.windows.filter((x) => !x.on).map((x) => x.window.pts));
      expect(s.accents.some((a) => a.kind === "poly" && off.has(a.pts))).toBe(false);
    });
  });
}

describe("lights (synthetic scenes)", () => {
  const scene = city(createRng(7), createRng(8), createRng(9));

  it("is deterministic: same rng, same JSON", () => {
    const view = { solids: scene.solids, placed: scene.placed };
    expect(JSON.stringify(lights(view, createRng(5)))).toBe(JSON.stringify(lights(view, createRng(5))));
    expect(JSON.stringify(lights(view, createRng(5)))).not.toBe(JSON.stringify(lights(view, createRng(6))));
  });

  it("lightBox: the points' box padded by 0.05", () => {
    const b = lightBox(quad(1, 3, 5, 2, 4));
    expect(b.min.x).toBeCloseTo(0.95); expect(b.max.x).toBeCloseTo(3.05);
    expect(b.min.y).toBeCloseTo(4.95); expect(b.max.y).toBeCloseTo(5.05);
    expect(b.min.z).toBeCloseTo(1.95); expect(b.max.z).toBeCloseTo(4.05);
  });

  it("a solid from another piece in front hides the window, even if it starts far to the left on screen", () => {
    // piece A: building with a window on its south face (y = 10); piece B: long wall to the south that starts far to the west
    const a = emptyPiece(), b = emptyPiece();
    a.solids.push(prism(0, 0, 0, 10, 10, 10));
    a.windows.push({ pts: quad(4, 6, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    b.solids.push(prism(-60, 12, 0, 80, 2, 12));
    const solids = [...a.solids, ...b.solids];
    const l = lights({ solids, placed: [placedAt("downtown", a, 0), placedAt("downtown", b, 1)] }, createRng(1));
    expect(l.windows).toHaveLength(0);
    expect(l.counts.downtown).toEqual({ candidates: 0, on: 0, warm: 0 });
  });

  it("a cornice of the same piece also hides: only the own building is exempt", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0, 10, 10, 10), prism(-1, 9, 4.5, 12, 4, 0.5)); // continuous balcony in front of the window
    a.windows.push({ pts: quad(4, 6, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    const l = lights({ solids: a.solids, placed: [placedAt("downtown", a, 0)] }, createRng(1));
    expect(l.windows).toHaveLength(0);
  });

  it("with nothing in front, the window is a candidate; a neighborhood without pieces stays at zero", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0, 10, 10, 10));
    a.windows.push({ pts: quad(4, 6, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    const l = lights({ solids: a.solids, placed: [placedAt("residential", a, 0)] }, createRng(1));
    expect(l.windows).toHaveLength(1);
    expect(l.counts.residential.candidates).toBe(1);
    expect(l.flicker).toBeNull(); // without bars there is no neon to flicker
    for (const b of NEIGHBORHOODS) if (b !== "residential") expect(l.counts[b]).toEqual({ candidates: 0, on: 0, warm: 0 });
  });

  it("two touching prisms of the same piece: covered windows of the back one are not candidates, the protruding ones are", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0, 12, 10, 10), prism(0, 10, 0, 6, 4, 10)); // the front one touches the +y face of the back one on x 0..6
    const win = (x0: number, x1: number): Window => ({ pts: quad(x0, x1, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    const free = win(8, 10);
    a.windows.push(win(1, 3), win(3.5, 5.5), free);
    const l = lights({ solids: a.solids, placed: [placedAt("downtown", a, 0)] }, createRng(1));
    expect(l.windows.map((w) => w.window)).toEqual([free]);
    expect(l.counts.downtown.candidates).toBe(1);
  });

  it("a touching solid of another piece covers the window; one whose top only reaches the window's centroid does not", () => {
    const a = emptyPiece(), b = emptyPiece();
    a.solids.push(prism(0, 0, 0, 12, 10, 10));
    const win = (x0: number, x1: number): Window => ({ pts: quad(x0, x1, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    const low = win(8, 10);
    a.windows.push(win(1, 3), low);
    b.solids.push(prism(0, 10, 0, 4, 4, 10), prism(6, 10, 0, 6, 4, 3)); // tall neighbour on x 0..4; low wall on x 6..12 with top at z 3 = centroid z
    const l = lights({ solids: [...a.solids, ...b.solids], placed: [placedAt("downtown", a, 0), placedAt("downtown", b, 1)] }, createRng(1));
    expect(l.windows.map((w) => w.window)).toEqual([low]);
  });

  const neonSlot = (x: number, shop: number, z0 = 2.7): Slot => ({ pts: quad(x, x + 2, 18, z0, z0 + 1.2), wall: v3(0, 1, 0), side: "s", kind: "neon", shop });

  it("neons: at most 24 even with 30 open slots, and one per shop", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 120, 18, 6));
    for (let k = 0; k < 30; k++) a.slots.push(neonSlot(k * 4, k));
    a.slots.push(neonSlot(1, 0)); // second slot of shop 0: doesn't count
    const l = lights({ solids: a.solids, placed: [placedAt("bars", a, 0)] }, createRng(3));
    expect(l.neons).toHaveLength(MAX_NEONS);
    expect(new Set(l.neons.map((n) => n.slot.shop)).size).toBe(MAX_NEONS);
  });

  it("neons: slots outside 2.4..3.6 above the lot, those on closed sides, those of another neighborhood and signs are discarded", () => {
    const bars = emptyPiece(), downtown = emptyPiece();
    bars.solids.push(prism(0, 0, 0.3, 40, 18, 6));
    bars.slots.push(neonSlot(0, 0, 4.5), { ...neonSlot(4, 1), side: "n" }, { ...neonSlot(8, 2), kind: "sign" }, neonSlot(12, 3));
    downtown.solids.push(prism(100, 0, 0.3, 20, 18, 6));
    downtown.slots.push(neonSlot(104, 0));
    const l = lights({ solids: [...bars.solids, ...downtown.solids], placed: [placedAt("bars", bars, 0), placedAt("downtown", downtown, 1)] }, createRng(3));
    expect(l.neons.map((n) => n.slot.shop)).toEqual([3]);
  });

  it("neons: if the front of a corner shop is hidden, the neon goes to its other open side", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 24, 18, 6), prism(0, 20, 0, 24, 2, 12)); // wall to the south that hides the south front
    a.slots.push(neonSlot(10, 0), { pts: [v3(24, 8, 2.7), v3(24, 10, 2.7), v3(24, 10, 3.9), v3(24, 8, 3.9)], wall: v3(1, 0, 0), side: "e", kind: "neon", shop: 0 });
    const l = lights({ solids: a.solids, placed: [placedAt("bars", a, 0, ["s", "e"])] }, createRng(3));
    expect(l.neons.map((n) => n.slot.side)).toEqual(["e"]);
  });

  it("neons: a slot whose wall faces away from the camera produces no neon, even on an open side", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 24, 18, 6));
    a.slots.push(
      { pts: quad(10, 12, 0, 2.7, 3.9), wall: v3(0, -1, 0), side: "n", kind: "neon", shop: 0 },
      { pts: [v3(0, 8, 2.7), v3(0, 10, 2.7), v3(0, 10, 3.9), v3(0, 8, 3.9)], wall: v3(-1, 0, 0), side: "w", kind: "neon", shop: 1 },
    );
    const l = lights({ solids: a.solids, placed: [placedAt("bars", a, 0, ["n", "w"])] }, createRng(3));
    expect(l.neons).toEqual([]);
  });

  it("neons: the puddle falls 1 outward from the wall, at the lot's z", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 24, 18, 6));
    a.slots.push(neonSlot(10, 0));
    const [n] = lights({ solids: a.solids, placed: [placedAt("bars", a, 0)] }, createRng(3)).neons;
    const puddle = n!.accents.filter((x) => x.kind === "poly" && x.alpha === 0.25);
    expect(puddle).toHaveLength(3);
    for (const p of puddle) {
      if (p.kind !== "poly") continue;
      const cx = p.pts.reduce((t, q) => t + q.x, 0) / p.pts.length, cy = p.pts.reduce((t, q) => t + q.y, 0) / p.pts.length;
      expect(cx).toBeCloseTo(11, 6); expect(cy).toBeCloseTo(19, 6);
      for (const q of p.pts) expect(q.z).toBeCloseTo(0.3, 6);
    }
  });

  it("neons: colors with weights amber 50, magenta 30, cyan 20", () => {
    const tally = { amber: 0, magenta: 0, cyan: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const a = emptyPiece();
      a.solids.push(prism(0, 0, 0.3, 120, 18, 6));
      for (let k = 0; k < 24; k++) a.slots.push(neonSlot(k * 4, k));
      for (const n of lights({ solids: a.solids, placed: [placedAt("bars", a, 0)] }, createRng(seed)).neons) tally[n.color]++;
    }
    const total = tally.amber + tally.magenta + tally.cyan;
    expect(Math.abs(tally.amber / total - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(tally.magenta / total - 0.3)).toBeLessThan(0.05);
    expect(Math.abs(tally.cyan / total - 0.2)).toBeLessThan(0.05);
  });
});
