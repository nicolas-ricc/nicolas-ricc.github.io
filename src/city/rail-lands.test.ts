import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../iso/solids";
import { STATION_LAND, WORLD } from "../map/geo";
import { RAIL_Y } from "../scenes/shipyard";
import { MAIN_LINE, railLands } from "./rail-lands";

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

  it("sleepers: rust 1×5×0.3 at (x, 130) every 4 from −58 to 94 (x ≡ 2 mod 4)", () => {
    expect(solids.every((s) => s.kind === "prism" && s.mat === "rust" && s.w === 1 && s.d === 5 && s.h === 0.3 && s.at.y === 130 && s.at.z === 0)).toBe(true);
    const xs = solids.map((s) => (s.kind === "prism" ? s.at.x : NaN));
    expect(xs).toEqual(Array.from({ length: 39 }, (_, i) => -58 + 4 * i));
    for (const x of xs) expect(((x % 4) + 4) % 4).toBe(2);
  });

  it("nothing taller than 0.4 (the train passes over it)", () => {
    for (const s of solids) { const b = bounds(s); expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.4); }
  });
});
