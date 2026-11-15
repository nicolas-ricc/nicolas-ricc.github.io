import { describe, expect, it } from "vitest";
import { COVER_SCALES, fixedScaleFit, nextCoverScale } from "./cover-scale";

describe("cover scale (#360)", () => {
  it("the cover scales of a laptop and a phone", () => {
    expect(COVER_SCALES).toEqual([1.17, 0.83]);
  });
  it("cycles real → 1.17 → 0.83 → real", () => {
    expect(nextCoverScale(null)).toBe(1.17);
    expect(nextCoverScale(1.17)).toBe(0.83);
    expect(nextCoverScale(0.83)).toBeNull();
  });
  it("fixedScaleFit keeps the point at the host center where it was and only changes the scale", () => {
    const fit = { x: 100, y: 50, scale: 2 }, w = 800, h = 600;
    const world = { x: (w / 2 - fit.x) / fit.scale, y: (h / 2 - fit.y) / fit.scale };
    for (const scale of COVER_SCALES) {
      const f = fixedScaleFit(fit, w, h, scale);
      expect(f.scale).toBe(scale);
      expect(f.x + world.x * f.scale).toBeCloseTo(w / 2, 9);
      expect(f.y + world.y * f.scale).toBeCloseTo(h / 2, 9);
    }
    expect(fixedScaleFit(fit, w, h, fit.scale)).toEqual(fit);
  });
  it("fixedScaleFit on an empty host (fit scale 0) stays finite (#360 review)", () => {
    const f = fixedScaleFit({ x: 0, y: 0, scale: 0 }, 0, 0, 1.17);
    expect(f.scale).toBe(1.17);
    expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
  });
});
