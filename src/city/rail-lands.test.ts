import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../iso/solids";
import { STATION_LAND, WORLD } from "../map/geo";
import { RAIL_Y } from "../scenes/shipyard";
import { CROSSINGS, CROSSING_GAP, MAIN_LINE, railLands } from "./rail-lands";

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

    it("north and south steel fences, h 1, from x −54 to 96 with a gap at each crossing", () => {
      const spans = [[-54, -24], [-18, 6], [12, 36], [42, 66], [72, 96]];
      for (const y of [129.5, 136]) {
        const fence = prisms("steel", 1).filter((s) => s.at.y === y).sort((a, b) => a.at.x - b.at.x);
        expect(fence.map((s) => [s.at.x, s.at.x + s.w]), `y ${y}`).toEqual(spans);
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
});
