import { beforeAll, describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { isFlat } from "../iso/solids";
import { SEED } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { city } from "./city";
import { world, zoneRng } from "./world";

// Count caps of the 2026-10-15 spec §9, over the real world seed.
const resume = () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));

describe("Resume level 2 budget", () => {
  it("raised solids ≤ 2 900, strip ≤ 190, static accents ≤ 1 300", () => {
    const s = resume();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(2900);
    expect(s.ground.filter((g) => g.kind === "strip").length).toBeLessThanOrEqual(190);
    // accents: 1 165 measured (#391): 789 before, + the crown's 402 (238 poly + 164 dot), − 26 city lights the crown now hides from the camera
    // (2 avenue lamps and lit windows behind its panel); ×1.1 rounded to the hundred
    expect(s.accents.length).toBeLessThanOrEqual(1300);
  });

  it("static polygons of the world ≤ 56 000 (same computation as stage.staticCount)", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThanOrEqual(56000);
  });
});

describe("world accents (#394)", () => {
  it("static accents of the whole world ≤ 2 600", () => {
    // 2 478 measured while planning #389: 1 222 of the world + 1 256 of the three signs (crown 238 poly + 164 dot,
    // tinker 114 + 84, platform 654 + 2; the tinker's 19 lights in `tinker.lights` are animated, not static); ×1.05
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length).toBeLessThanOrEqual(2600);
  });
});

describe("raised solids per scene (#328)", () => {
  // Measured 2026-11-08 with world(SEED) after #319..#327 and the cuts of #328 (spec 2026-10-15 §12.2): shipyard 543, factory 775,
  // city 1 431, fair 452, hinterland 456, tech 1 514. Caps are measured ×1.1 rounded to the nearest hundred; fair re-measured 549 on 2026-11-17 after #398 (helter skelter).
  // shipyard: 543 + the tinker sign's 154 = 697 (#392), ×1.1 rounded to the hundred
  const CAPS = { shipyard: 800, factory: 900, city: 1600, fair: 600, hinterland: 500, tech: 1700 } as const;
  let w: ReturnType<typeof world>;
  beforeAll(() => { w = world(SEED); });
  for (const [name, cap] of Object.entries(CAPS)) {
    it(`${name} ≤ ${cap}`, () => {
      const scene = w[name as keyof typeof CAPS];
      expect(scene).not.toBeNull();
      expect(scene!.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(cap);
    });
  }
});
