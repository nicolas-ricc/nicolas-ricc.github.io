import { describe, expect, it } from "vitest";
import { WATER_STEP_MS } from "./water-anim";
import { waterAnimator } from "./water-animator";
import { world } from "./world";

describe("waterAnimator", () => {
  it("exposes six bands and the foam, claims all the water and with reduced-motion returns no ids", () => {
    const w = world(7);
    const a = waterAnimator(w.terrain, { reducedMotion: false });
    expect([...a.ids].sort()).toEqual(["water.band0", "water.band1", "water.band2", "water.band3", "water.band4", "water.band5", "water.foam"]);
    expect(a.claims).toEqual([...w.terrain.water, w.terrain.foam]);
    expect(a.layer("water.band0").kind).toBe("water");
    expect([...a.tick(WATER_STEP_MS)]).toEqual(["water.band1"]);
    expect(waterAnimator(w.terrain, { reducedMotion: true }).tick(1000).size).toBe(0);
  });
});
