import { beforeAll, describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { isFlat, tessellateAll } from "../iso/solids";
import { raftAt, REST_POSE } from "./raft";
import { SEED } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { city } from "./city";
import { world, zoneRng } from "./world";

// Count caps of the 2026-10-15 spec §9, over the real world seed.
const resume = () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));

describe("Resume level 2 budget", () => {
  it("raised solids ≤ 2 900, strip ≤ 380, static accents ≤ 1 000", () => {
    const s = resume();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(2900);
    // measured with the hotel (#474), real seed: 992 raised solids, 95 strip ground, 788 static accents (514 poly + 274 dot).
    // The accents were 1 165 with the crown (#391: 789 before, + its 402 = 238 poly + 164 dot, − 26 hidden city lights); the hotel replaced the
    // tower and the crown.
    expect(s.ground.filter((g) => g.kind === "strip").length).toBeLessThanOrEqual(400); // measured (#473): 347 strips, ×1.1 rounded to the ten; with the west (#479, measured on agent/479): 357 strips, ×1.1 = 393, rounded up to the ten
    expect(s.accents.length).toBeLessThanOrEqual(1400); // measured on agent/479 with the west (#479): 1 265 accents, ×1.1 = 1 392, rounded up to the hundred. Before: (#473): 815 accents; with the barrios of #477, 903 (585 poly): ×1.1 = 993, rounded up to the hundred
  });

  it("static polygons of the world ≤ 56 000 (same computation as stage.staticCount)", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    // 42 749 measured with the hotel (#474), 42 788 with the barrios (#477, over #473 and #478); the cap stays
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThanOrEqual(56000);
  });

  it("the Writing platform left the static world (#427): static polygons drop below the 46 518 of feature/423 before it", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThan(46518);
  });
});

describe("world accents (#394)", () => {
  it("static accents of the whole world ≤ 2 600", () => {
    // 2 478 measured while planning #389: 1 222 of the world + 1 256 of the three signs (crown 238 poly + 164 dot,
    // tinker 114 + 84, platform 654 + 2; the tinker's 19 lights in `tinker.lights` are animated, not static); ×1.05.
    // since #442 the platform is one flat board: its piles, hut and posts are gone, so these figures describe the platform before it
    // Since #427 the platform is animated, not static (`platform.solid` of platformAnimator); since #454 it has no lights at all.
    // 1 376 measured with the hotel (#474), 1 492 with the barrios (#477, over #473 and #478), real seed: the Resume sign's accents are inside the city's 788 and the crown's 402 are gone; the cap stays
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length).toBeLessThanOrEqual(2600);
  });
  it("the platform's lights left the static world (#427): fewer than the 2 409 of feature/423 before it", () => {
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length).toBeLessThan(2409);
  });
});

describe("raised solids per scene (#328)", () => {
  // Measured 2026-11-08 with world(SEED) after #319..#327 and the cuts of #328 (spec 2026-10-15 §12.2): shipyard 543, factory 775,
  // city 1 431, fair 452, hinterland 456, tech 1 514 (1 449 since #478: the south on 24 × 24 parcels, measured raised solids of world(SEED).tech; 1 449 × 1.1 = 1 594 → 1 600). Caps are measured ×1.1 rounded to the nearest hundred; fair re-measured 549 on 2026-11-17 after #398 (helter skelter).
  // shipyard: 543 + the tinker sign's 154 = 697 (#392), ×1.1 rounded to the hundred
  // measured with the hotel (#474), real seed: shipyard 686, city 992, factory 770, fair 565, hinterland 453, tech 1 490 (before #478); none exceeds its cap, so none moves; with the barrios (#477, over #473 and #478): city 1 209, tech 1 449, the rest unchanged
  const CAPS = { shipyard: 800, factory: 900, city: 1600, fair: 600, hinterland: 500, tech: 1600 } as const;
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

describe("Writing raft budget (#454)", () => {
  it("one raft tessellates to ≤ 1200 faces", () => {
    expect(tessellateAll(raftAt("wide", REST_POSE)).length).toBeLessThanOrEqual(1200);
  });
});

describe("the west moves from tech to the city (#479)", () => {
  // Measured on feature/471 at 3cff5a7 (before #479), world(SEED), raised solids (!isFlat): city 1 209, tech 1 449.
  const BEFORE = { city: 1209, tech: 1449 } as const;
  it("budget moved, not raised", () => {
    const w = world(SEED), raised = (s: { solids: Parameters<typeof isFlat>[0][] }) => s.solids.filter((x) => !isFlat(x)).length;
    const after = { city: raised(w.city!), tech: raised(w.tech!) };
    expect(after.tech).toBeLessThan(BEFORE.tech); // the west left tech
    expect(after.city).toBeGreaterThan(BEFORE.city); // and arrived in the city
    expect(after.city + after.tech).toBeLessThanOrEqual(BEFORE.city + BEFORE.tech);
  });
});
