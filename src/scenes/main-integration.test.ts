import { describe, expect, it } from "vitest";
import { facadeFaces, type Facade } from "../iso/facade";
import { v3 } from "../iso/geometry";
import { tessellateAll, type Face, type Solid } from "../iso/solids";
import { ISO_TONES } from "../map/palette-iso";
import { SEED } from "../map/seed";
import { world } from "./world";

/**
 * What the integration of `main` into story #35 (#291) requires and no one-sided test covers: the two
 * intents coexist in the engine, the palette and the world.
 */
describe("integration of main into story #35", () => {
  it("facade bands are painted before plinth, piers, courses and ties", () => {
    const wall: Face = { pts: [v3(0, 6, 0), v3(10, 6, 0), v3(10, 6, 9), v3(0, 6, 9)], normal: v3(0, 1, 0), mat: "office", tone: "lit", toneOffset: 0 };
    const facade = {
      floors: 3, cols: 4,
      plinth: { h: 0.6, mat: "stone" }, piers: { every: 2, w: 0.4, mat: "stone" },
      courses: { mat: "stone", h: 0.4 }, ties: { r: 0.2, mat: "stone" },
    } satisfies Facade;
    const faces = facadeFaces(wall, facade);
    const fullFloor = (f: Face) => f.mat === "office" && Math.abs(Math.max(...f.pts.map((p) => p.z)) - Math.min(...f.pts.map((p) => p.z)) - 3) < 1e-9;
    const bands = faces.flatMap((f, i) => (fullFloor(f) ? [i] : []));
    const stone = faces.flatMap((f, i) => (f.mat === "stone" ? [i] : []));
    expect(bands).toHaveLength(3);
    expect(stone.length).toBeGreaterThan(0);
    expect(Math.max(...bands)).toBeLessThan(Math.min(...stone));
  });

  it("a plate with wall 0 on a clockwise poly lands on the footprint[0] → footprint[1] edge", () => {
    // clockwise in (x east, y south): negative signed area, the story flips it when extruding
    const footprint = [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 0 }];
    const poly: Solid = { kind: "poly", footprint, z: 0, h: 3, mat: "concrete", plates: [{ wall: 0, shape: "rect", u0: 0.1, u1: 0.4, z0: 1, z1: 2, mat: "signal" }] };
    const plate = tessellateAll(poly).filter((f) => f.mat === "signal");
    expect(plate).toHaveLength(1);
    for (const p of plate[0]!.pts) { expect(p.x).toBeCloseTo(0); expect(p.y).toBeGreaterThanOrEqual(0.4 - 1e-9); expect(p.y).toBeLessThanOrEqual(1.6 + 1e-9); } // u along the direction of the original edge
    expect(plate[0]!.normal.x).toBeCloseTo(-1);
  });

  it("every material has the nine-tone ladder, including the ones main added", () => {
    const ladder = ["deep", "dim", "down", "glow", "lit", "pale", "shade", "top", "up"];
    for (const m of ["signal", "stockbrick", "safety", "canopy", "livery", "tile"]) expect(Object.keys(ISO_TONES)).toContain(m);
    for (const [m, tones] of Object.entries(ISO_TONES)) expect(Object.keys(tones).sort(), m).toEqual(ladder);
  });

  it("the world brings the kit's city and main's neighborhood", () => {
    const w = world(SEED);
    expect(w.city!.placed.length).toBeGreaterThan(0); // story: kit pieces per neighborhood
    expect(w.tech!.homes.length).toBeGreaterThan(0); // main: windows of the coastal neighborhood
  });
});
