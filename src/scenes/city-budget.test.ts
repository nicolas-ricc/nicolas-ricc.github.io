import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { isFlat } from "../iso/solids";
import { SEED } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { city } from "./city";
import { world, zoneRng } from "./world";

// Count caps of the 2026-10-15 spec §9, over the real world seed.
const resume = () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));

describe("Resume level 2 budget", () => {
  it("raised solids ≤ 2 900, strip ≤ 190, static accents ≤ 1 150", () => {
    const s = resume();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(2900);
    expect(s.ground.filter((g) => g.kind === "strip").length).toBeLessThanOrEqual(190);
    expect(s.accents.length).toBeLessThanOrEqual(1150);
  });

  it("static polygons of the world ≤ 56 000 (same computation as stage.staticCount)", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThanOrEqual(56000);
  });
});

describe("raised solids per scene (#328)", () => {
  // Measured 2026-11-08 with world(SEED) after #319..#327 (spec 2026-10-15 §12.2): shipyard 553, factory 775,
  // city 1 431, fair 452, hinterland 456, tech 1 514. Caps are measured ×1.1 rounded to the nearest hundred.
  const CAPS = { shipyard: 600, factory: 900, city: 1600, fair: 500, hinterland: 500, tech: 1700 } as const;
  const w = world(SEED);
  for (const [name, cap] of Object.entries(CAPS)) {
    it(`${name} ≤ ${cap}`, () => {
      const scene = w[name as keyof typeof CAPS];
      expect(scene).not.toBeNull();
      expect(scene!.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(cap);
    });
  }
});
