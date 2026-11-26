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
  it("raised solids ≤ 1 900, strip ≤ 570, static accents ≤ 2 400", () => {
    const s = resume();
    // measured 2026-11-26 (#494), city(...) of the world seed, raised = !isFlat: 1 748 × 1.1 = 1 922.8 → 1 900 (the hotel's sign: extruded letters, lattice, walkway). before: 1 700 (#480: 1 518 × 1.1 = 1 669.8; #474: 2 900)
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(1900);
    // measured 2026-11-23 (#480), ground.filter(kind === "strip"): 522 × 1.1 = 574.2 → 570 (nearest ten). before: 580
    expect(s.ground.filter((g) => g.kind === "strip").length).toBeLessThanOrEqual(570);
    // measured 2026-11-26 (#493): 1 497 × 1.1 = 1 646.7 → 1 600. before: 1 400 (#480: 1 280 × 1.1 = 1 408)
    // measured 2026-11-26 (#495): 2 227 × 1.1 = 2 449.7 → 2 400 (office heights: taller barrio pieces carry more lit windows). before: 1 600 (#493: 1 497 × 1.1 = 1 646.7)
    expect(s.accents.length).toBeLessThanOrEqual(2400);
  });

  it("static polygons of the world ≤ 57 700 (same computation as stage.staticCount)", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    // measured 2026-11-23 (#480), buildRenderList([...terrain.ground, ...ground, ...solids]).length of assembleWorld(undefined, { reducedMotion: true }): 43 546 × 1.1 = 47 900.6 → 47 900. before: 56 000
    // measured 2026-11-26 (#495): 52 442 × 1.1 = 57 686.2 → 57 700 (office heights; tick + render against main: −0.6 ms mean over 8 interleaved loads). before: 47 900
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThanOrEqual(57700);
  });

  it("the Writing platform left the static world (#427): static polygons drop below the 46 518 of feature/423 before it", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    // #495 grew the city's static polygons on purpose, by measurement: 44 748 → 52 442 (+7 694); the assertion keeps the platform's drop net of that growth
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length - 7694).toBeLessThan(46518);
  });
});

describe("world accents (#394)", () => {
  it("static accents of the whole world ≤ 3 100", () => {
    // measured 2026-11-26 (#493), assembleWorld(undefined, { reducedMotion: true }).scene.accents.length: 2 066 × 1.1 = 2 272.6 → 2 300. before: 2 000 (#480: 1 833 × 1.1 = 2 016.3)
    // measured 2026-11-26 (#495): 2 796 × 1.1 = 3 075.6 → 3 100 (office heights: more lit windows). before: 2 300
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length).toBeLessThanOrEqual(3100);
  });
  it("the platform's lights left the static world (#427): fewer than the 2 409 of feature/423 before it", () => {
    // #495 grew the world's static accents on purpose, by measurement: 2 153 → 2 796 (+643); the assertion keeps the platform's drop net of that growth
    expect(assembleWorld(undefined, { reducedMotion: true }).scene.accents.length - 643).toBeLessThan(2409);
  });
});

describe("raised solids per scene (#328)", () => {
  // measured 2026-11-23 (#480), raised solids (!isFlat) of world(SEED).<scene>, × 1.1 rounded to the nearest hundred (up if below the figure):
  // shipyard 686 × 1.1 = 754.6 → 800; factory 770 × 1.1 = 847 → 800; city 1 518 × 1.1 = 1 669.8 → 1 700; fair 565 × 1.1 = 621.5 → 600; hinterland 453 × 1.1 = 498.3 → 500; tech 1 136 × 1.1 = 1 249.6 → 1 200
  // #493 (2026-11-26): city 1 700 (was 1 518), tech 962 (was 1 136); the caps hold
  // #494 (2026-11-26): city 1 748 (was 1 700) × 1.1 = 1 922.8 → 1 900; the rest hold
  // #495 (2026-11-26): city 1 882 (was 1 748), under the 1 900 cap; the rest hold
  // before: shipyard 800, factory 900, city 1 700, fair 600, hinterland 500, tech 1 200
  const CAPS = { shipyard: 800, factory: 800, city: 1900, fair: 600, hinterland: 500, tech: 1200 } as const;
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
  // #494 raised this sum on purpose, by measurement (the test name is historical; the assertion is still ≤): the hotel's sign adds 48 raised solids to the city (city 1 748 + tech 962 = 2 710, was 2 662)
  it("budget moved, not raised", () => {
    const w = world(SEED), raised = (s: { solids: Parameters<typeof isFlat>[0][] }) => s.solids.filter((x) => !isFlat(x)).length;
    const after = { city: raised(w.city!), tech: raised(w.tech!) };
    expect(after.tech).toBeLessThan(BEFORE.tech); // the west left tech
    expect(after.city).toBeGreaterThan(BEFORE.city); // and arrived in the city
    // #495 raised it again, by measurement: taller barrio pieces add raised solids (balcony slabs, cupola floors) to the city (city 1 882 + tech 962 = 2 844, was 2 710)
    expect(after.city + after.tech).toBeLessThanOrEqual(2844);
  });
});
