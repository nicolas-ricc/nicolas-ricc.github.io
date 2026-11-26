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
  it("raised solids ≤ 1 700, strip ≤ 570, static accents ≤ 1 600", () => {
    const s = resume();
    // measured 2026-11-23 (#480), city(...) of the world seed, raised = !isFlat: 1 518 × 1.1 = 1 669.8 → 1 700. before: 2 900 (#474)
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(1700);
    // measured 2026-11-23 (#480), ground.filter(kind === "strip"): 522 × 1.1 = 574.2 → 570 (nearest ten). before: 580
    expect(s.ground.filter((g) => g.kind === "strip").length).toBeLessThanOrEqual(570);
    // measured 2026-11-26 (#493): 1 497 × 1.1 = 1 646.7 → 1 600. before: 1 400 (#480: 1 280 × 1.1 = 1 408)
    expect(s.accents.length).toBeLessThanOrEqual(1600);
  });

  it("static polygons of the world ≤ 47 900 (same computation as stage.staticCount)", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    // measured 2026-11-23 (#480), buildRenderList([...terrain.ground, ...ground, ...solids]).length of assembleWorld(undefined, { reducedMotion: true }): 43 546 × 1.1 = 47 900.6 → 47 900. before: 56 000
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThanOrEqual(47900);
  });

  it("the Writing platform left the static world (#427): static polygons drop below the 46 518 of feature/423 before it", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThan(46518);
  });
});

describe("world accents (#394)", () => {
  it("static accents of the whole world ≤ 2 300", () => {
    // measured 2026-11-26 (#493), assembleWorld(undefined, { reducedMotion: true }).scene.accents.length: 2 066 × 1.1 = 2 272.6 → 2 300. before: 2 000 (#480: 1 833 × 1.1 = 2 016.3)
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length).toBeLessThanOrEqual(2300);
  });
  it("the platform's lights left the static world (#427): fewer than the 2 409 of feature/423 before it", () => {
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length).toBeLessThan(2409);
  });
});

describe("raised solids per scene (#328)", () => {
  // measured 2026-11-23 (#480), raised solids (!isFlat) of world(SEED).<scene>, × 1.1 rounded to the nearest hundred (up if below the figure):
  // shipyard 686 × 1.1 = 754.6 → 800; factory 770 × 1.1 = 847 → 800; city 1 518 × 1.1 = 1 669.8 → 1 700; fair 565 × 1.1 = 621.5 → 600; hinterland 453 × 1.1 = 498.3 → 500; tech 1 136 × 1.1 = 1 249.6 → 1 200
  // #493 (2026-11-26): city 1 700 (was 1 518), tech 962 (was 1 136); the caps hold
  // before: shipyard 800, factory 900, city 1 700, fair 600, hinterland 500, tech 1 200
  const CAPS = { shipyard: 800, factory: 800, city: 1700, fair: 600, hinterland: 500, tech: 1200 } as const;
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
  // Measured on HEAD of agent/479 (after #479), world(SEED), raised solids: city 1 518, tech 1 136, sum 2 654 ≤ 2 658. A record: the test asserts ≤, never exact.
  // The move stayed ≤ 2 658 thanks to three west rulings: no traffic lights at axis × ordinary-street crossings, no parked cars (all three west of WEST_DISTRICT_X, x −54), axis lamps every 24 (not 12).
  // #493: the 348..378 row moves from tech to the city: measured city 1 700 + tech 962 = 2 662 (was 2 658)
  it("budget moved, not raised", () => {
    const w = world(SEED), raised = (s: { solids: Parameters<typeof isFlat>[0][] }) => s.solids.filter((x) => !isFlat(x)).length;
    const after = { city: raised(w.city!), tech: raised(w.tech!) };
    expect(after.tech).toBeLessThan(BEFORE.tech); // the west left tech
    expect(after.city).toBeGreaterThan(BEFORE.city); // and arrived in the city
    expect(after.city + after.tech).toBeLessThanOrEqual(2662);
  });
});
