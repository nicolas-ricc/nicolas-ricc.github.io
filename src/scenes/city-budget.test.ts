import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { isFlat } from "../iso/solids";
import { SEED } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { city } from "./city";
import { zoneRng } from "./world";

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
