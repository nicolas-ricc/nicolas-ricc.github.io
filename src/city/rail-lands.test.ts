import { describe, expect, it } from "vitest";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { STATION_LAND, WORLD } from "../map/geo";
import { RAIL_Y } from "../scenes/shipyard";
import { CROSSINGS, CROSSING_GAP, MAIN_LINE, SIDING_Y, SWITCH, freightYard, railLands } from "./rail-lands";
import type { FixedLight } from "./lights";

describe("rail lands (#319)", () => {
  const ground: Solid[] = [], solids: Solid[] = [];
  railLands(ground, solids);

  it("MAIN_LINE runs from the west edge of the content to the station land", () => {
    expect(MAIN_LINE).toEqual({ x0: WORLD.x0, x1: STATION_LAND.x0 });
  });

  it("two rails at RAIL_Y, width 0.5, z 0.05, and a ballast strip of width 5 at y 132.5", () => {
    const rails = ground.filter((g) => g.kind === "strip" && g.mat === "rail" && g.width === 0.5);
    expect(rails.map((g) => g.kind === "strip" && [g.path[0]!.x, g.path[0]!.y, g.path[1]!.x, g.path[1]!.y, g.z])).toEqual(RAIL_Y.map((y) => [MAIN_LINE.x0, y, MAIN_LINE.x1, y, 0.05]));
    const ballast = ground.filter((g) => g.kind === "strip" && g.width === 5);
    expect(ballast.map((g) => g.kind === "strip" && [g.mat, g.path[0]!.x, g.path[0]!.y, g.path[1]!.x, g.z])).toEqual([["rail", MAIN_LINE.x0, 132.5, MAIN_LINE.x1, 0.03]]);
    expect(ground.length).toBe(3);
  });

  const sleepers = solids.filter((s) => s.mat === "rust");
  const prisms = (mat: string, h: number) => solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === mat && s.h === h);

  it("sleepers: rust 1×5×0.3 at (x, 130) every 4 from −58 to 94 (x ≡ 2 mod 4), none under a crossing (the planks are its floor)", () => {
    expect(sleepers.every((s) => s.kind === "prism" && s.mat === "rust" && s.w === 1 && s.d === 5 && s.h === 0.3 && s.at.y === 130 && s.at.z === 0)).toBe(true);
    const xs = sleepers.map((s) => (s.kind === "prism" ? s.at.x : NaN));
    expect(xs).toEqual(Array.from({ length: 39 }, (_, i) => -58 + 4 * i).filter((x) => !CROSSINGS.some((c) => x + 1 > c.x0 && x < c.x1)));
    expect(xs).toHaveLength(33); // six under the crossings: −22, 6, 10, 38, 66, 70
    for (const x of xs) expect(((x % 4) + 4) % 4).toBe(2);
  });

  it("sleepers and planks are at most 0.4 high (the train passes over them)", () => {
    for (const s of solids.filter((x) => x.mat === "rust" || x.mat === "deck")) { const b = bounds(s); expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.4); }
  });

  describe("railyards (#320)", () => {
    it("the crossings are the four N-S streets of the strip and the street gap is y 128..137", () => {
      expect(CROSSINGS).toEqual([{ x0: -24, x1: -18 }, { x0: 6, x1: 12 }, { x0: 36, x1: 42 }, { x0: 66, x1: 72 }]);
      expect(CROSSING_GAP).toEqual({ y0: 128, y1: 137 });
    });

    it("north and south steel fences, h 1, from x −54 to 96 with a gap at each crossing (and the switch on the south)", () => {
      const spans = { 129.5: [[-54, -24], [-18, 6], [12, 36], [42, 66], [72, 96]], 136: [[-54, -24], [-18, 6], [12, 36], [42, 66], [81, 96]] }; // the south one opens x 72..81 for the switch (#325)
      for (const y of [129.5, 136] as const) {
        const fence = prisms("steel", 1).filter((s) => s.at.y === y).sort((a, b) => a.at.x - b.at.x);
        expect(fence.map((s) => [s.at.x, s.at.x + s.w]), `y ${y}`).toEqual(spans[y]);
        for (const s of fence) expect([s.d, s.at.z]).toEqual([0.3, 0]);
      }
    });

    it("four level crossings: three deck planks h 0.3 over the street width at each", () => {
      const planks = prisms("deck", 0.3);
      expect(planks).toHaveLength(12);
      for (const c of CROSSINGS) {
        const here = planks.filter((s) => s.at.x === c.x0 && s.w === c.x1 - c.x0).map((s) => [s.at.y, s.at.y + s.d]).sort((a, b) => a[0]! - b[0]!);
        expect(here.map(([a, b]) => [a, Number(b!.toFixed(6))])).toEqual([[129.6, 130.7], [131.3, 133.7], [134.3, 135.4]]);
      }
    });

    it("eight steel posts 0.3 × 0.3: north h 3 at (x0 − 0.6, 128.6), south h 2 at (x1 + 0.3, 137.8)", () => {
      const posts = solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "steel" && s.w === 0.3 && s.d === 0.3);
      expect(posts).toHaveLength(8);
      for (const c of CROSSINGS) {
        expect(posts.filter((p) => p.at.x === c.x0 - 0.6 && p.at.y === 128.6 && p.h === 3)).toHaveLength(1);
        expect(posts.filter((p) => p.at.x === c.x1 + 0.3 && p.at.y === 137.8 && p.h === 2)).toHaveLength(1);
      }
    });

    it("train rule: every solid taller than 0.4 is north of y 130.8 or keeps y_min − 1.4·z_max ≥ 134.5", () => {
      for (const s of solids) {
        const b = bounds(s);
        if (b.max.z - b.min.z <= 0.4) continue;
        if (b.min.y > 134.2) expect(b.min.y - 1.4 * b.max.z, JSON.stringify(s)).toBeGreaterThanOrEqual(134.5 - 1e-9);
        else expect(b.max.y, JSON.stringify(s)).toBeLessThanOrEqual(130.8);
      }
    });
  });

  describe("freight yard (#325)", () => {
    type Prism = Solid & { kind: "prism" };
    const yard = (seed: number) => {
      const g: Solid[] = [], base: Solid[] = [], out: Solid[] = [], fixed: FixedLight[] = [];
      railLands(g, base);
      const n0 = g.length;
      freightYard(g, out, fixed, createRng(seed));
      return { ground: g.slice(n0), base, solids: out, accents: fixed.flatMap((l) => l.accents) };
    };
    const y1 = yard(1);
    const ps = (xs: Solid[]): Prism[] => xs.filter((s): s is Prism => s.kind === "prism");
    const sized = (xs: Solid[], w: number, d: number, h: number) => ps(xs).filter((s) => s.w === w && s.d === d && s.h === h);
    const strips = y1.ground.filter((g): g is Solid & { kind: "strip" } => g.kind === "strip");

    it("siding: two rail strips at y 139.5 and 142.5 from x −50 to 70; SIDING_Y 141", () => {
      expect(SIDING_Y).toBe(141);
      const straight = strips.filter((g) => g.path[0]!.y === g.path[1]!.y).map((g) => [g.mat, g.width, g.path[0]!.x, g.path[1]!.x, g.path[0]!.y]);
      expect(straight).toEqual([["rail", 0.5, -50, 70, 139.5], ["rail", 0.5, -50, 70, 142.5]]);
    });

    it("switch: two diagonal rails parallel to (82, 132.5) → (70, 141), offset ±1.5, crossing the south fence line inside the gap x 72..81", () => {
      expect(SWITCH).toEqual([{ x: 82, y: 132.5 }, { x: 70, y: 141 }]);
      const diag = strips.filter((g) => g.path[0]!.y !== g.path[1]!.y);
      expect(diag).toHaveLength(2);
      const [a, b] = SWITCH, len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      const offsets = diag.map((g) => {
        const [p, q] = g.path as [{ x: number; y: number }, { x: number; y: number }];
        expect(g.mat).toBe("rail");
        expect((q.x - p.x) * (b.y - a.y) - (q.y - p.y) * (b.x - a.x)).toBeCloseTo(0, 6); // parallel
        for (const y of [136, 136.3]) { const x = p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y); expect(x).toBeGreaterThan(72); expect(x).toBeLessThan(81); }
        return (p.x - a.x) * nx + (p.y - a.y) * ny;
      }).sort((u, v) => u - v);
      expect(offsets[0]).toBeCloseTo(-1.5, 6);
      expect(offsets[1]).toBeCloseTo(1.5, 6);
    });

    it("siding sleepers: rust 1×5×0.3 at (x, 138.5), x = −50 + 4k, k = 0..29", () => {
      const sl = sized(y1.solids, 1, 5, 0.3).filter((s) => s.mat === "rust" && s.at.y === 138.5);
      expect(sl.map((s) => s.at.x).sort((u, v) => u - v)).toEqual(Array.from({ length: 30 }, (_, k) => -50 + 4 * k));
    });

    it("buffer stop: steel 1.5×3×1.2 at x −51.5..−50, centered on y 141", () => {
      expect(sized(y1.solids, 1.5, 3, 1.2).map((s) => [s.mat, s.at.x, s.at.y, s.at.z])).toEqual([["steel", -51.5, 139.5, 0]]);
    });

    it("parked freight train: locomotive 9×2.4×3.4 west, five 8×2.4×3 wagons rust/steel alternating, 1 apart, y 139.8..142.2, standing on the sleepers", () => {
      for (const seed of [1, 2, 3]) {
        const s = yard(seed).solids, loco = sized(s, 9, 2.4, 3.4), wagons = sized(s, 8, 2.4, 3).sort((u, v) => u.at.x - v.at.x);
        expect(loco).toHaveLength(1);
        const x0 = loco[0]!.at.x;
        expect(Number.isInteger(x0)).toBe(true);
        expect(x0).toBeGreaterThanOrEqual(-46); expect(x0).toBeLessThanOrEqual(-20);
        expect(loco[0]!.mat).toBe("steel");
        expect(wagons.map((w) => [w.at.x, w.mat])).toEqual([0, 1, 2, 3, 4].map((k) => [x0 + 10 + 9 * k, k % 2 === 0 ? "rust" : "steel"]));
        for (const c of [...loco, ...wagons]) expect([c.at.y, c.at.z]).toEqual([139.8, 0.3]); // on the sleepers
      }
    });

    it("loading dock: concrete h 1 at y 136.3..138, cut at the crossings, with deck pallets on top from y 137", () => {
      const dock = ps(y1.solids).filter((s) => s.mat === "concrete").sort((u, v) => u.at.x - v.at.x);
      expect(dock.map((s) => [s.at.x, Number((s.at.x + s.w).toFixed(6)), s.at.y, s.d, s.h, s.at.z])).toEqual([[-50, -24], [-17.4, 6], [12.6, 36], [42.6, 66]].map(([a, b]) => [a, b, 136.3, 1.7, 1, 0]));
      const pallets = sized(y1.solids, 1.2, 1, 0.5).filter((s) => s.mat === "deck");
      expect(pallets.length).toBeGreaterThan(0);
      for (const p of pallets) {
        expect([p.at.y, p.at.z]).toEqual([137, 1]);
        expect(dock.some((d) => p.at.x >= d.at.x - 1e-9 && p.at.x + 1.2 <= d.at.x + d.w + 1e-9)).toBe(true);
      }
    });

    it("trucks: exactly three 6×2.4×2.8 boxes at y 146 with a steel 2×2.4×2.2 cab against their east end, all in x −40..60", () => {
      for (const seed of [1, 2, 3]) {
        const s = yard(seed).solids, boxes = sized(s, 6, 2.4, 2.8), cabs = sized(s, 2, 2.4, 2.2);
        expect(boxes).toHaveLength(3);
        expect(cabs).toHaveLength(3);
        for (const b of boxes) {
          expect(b.at.y).toBe(146);
          expect(cabs.some((c) => c.mat === "steel" && c.at.y === 146 && c.at.x === b.at.x + 6)).toBe(true);
          expect(b.at.x).toBeGreaterThanOrEqual(-40); expect(b.at.x + 8).toBeLessThanOrEqual(60);
        }
      }
    });

    it("loose containers: 6..8 one-high containers 6×2.4×2.6 at y 150 or 153.5 in x −50..90", () => {
      for (const seed of [1, 2, 3]) {
        const cs = sized(yard(seed).solids, 6, 2.4, 2.6);
        expect(cs.length).toBeGreaterThanOrEqual(6); expect(cs.length).toBeLessThanOrEqual(8);
        for (const c of cs) {
          expect([150, 153.5]).toContain(c.at.y);
          expect(c.at.z).toBe(0);
          expect(c.at.x).toBeGreaterThanOrEqual(-50); expect(c.at.x + 6).toBeLessThanOrEqual(90);
        }
      }
    });

    it("lamps: four steel posts 0.6×0.6×5 at (x, 150), x −40, 0, 40, 80, each with an amber dot r 0.6", () => {
      expect(sized(y1.solids, 0.6, 0.6, 5).map((s) => [s.mat, s.at.x, s.at.y]).sort((u, v) => (u[1] as number) - (v[1] as number))).toEqual([-40, 0, 40, 80].map((x) => ["steel", x, 150]));
      expect(y1.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.r === 0.6)).toHaveLength(4);
    });

    it("everything stays in x −54..94, y 136..157.5, and nothing taller than 0.4 between y 134.2 and 136", () => {
      for (const s of [...y1.base, ...y1.solids]) {
        const b = bounds(s);
        if (b.max.z - b.min.z > 0.4) expect(b.max.y <= 134.2 || b.min.y >= 136, JSON.stringify(s)).toBe(true);
      }
      for (const s of y1.solids) {
        const b = bounds(s);
        expect(b.min.x, JSON.stringify(s)).toBeGreaterThanOrEqual(-54); expect(b.max.x).toBeLessThanOrEqual(94);
        expect(b.min.y, JSON.stringify(s)).toBeGreaterThanOrEqual(136); expect(b.max.y).toBeLessThanOrEqual(157.5);
      }
    });

    it("train rule over railLands + freightYard: south of 134.2 keeps y_min − 1.4·z_max ≥ 134.5, nothing tall in 130.8..134.2", () => {
      for (const seed of [1, 2, 3]) {
        const { base, solids: s } = yard(seed);
        for (const x of [...base, ...s]) {
          const b = bounds(x);
          if (b.max.z - b.min.z <= 0.4) continue;
          if (b.min.y > 134.2) expect(b.min.y - 1.4 * b.max.z, JSON.stringify(x)).toBeGreaterThanOrEqual(134.5 - 1e-9);
          else expect(b.max.y, JSON.stringify(x)).toBeLessThanOrEqual(130.8);
        }
      }
    });

    it("no two solids taller than 0.4 of railLands + freightYard overlap (strict 3D AABB)", () => {
      for (const seed of [1, 2, 3]) {
        const { base, solids: s } = yard(seed);
        const tall = [...base, ...s].map((s) => bounds(s)).filter((b) => b.max.z - b.min.z > 0.4);
        const e = 1e-9, cut = (a: Bounds, b: Bounds) => a.min.x < b.max.x - e && b.min.x < a.max.x - e && a.min.y < b.max.y - e && b.min.y < a.max.y - e && a.min.z < b.max.z - e && b.min.z < a.max.z - e;
        for (let i = 0; i < tall.length; i++) for (let j = i + 1; j < tall.length; j++) expect(cut(tall[i]!, tall[j]!), `seed ${seed}: ${JSON.stringify(tall[i])} × ${JSON.stringify(tall[j])}`).toBe(false);
      }
    });

    it("is deterministic per rng", () => {
      expect(JSON.stringify(yard(1))).toBe(JSON.stringify(yard(1)));
      expect(JSON.stringify(yard(1))).not.toBe(JSON.stringify(yard(2)));
    });
  });
});
