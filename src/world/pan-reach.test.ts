import { describe, expect, it } from "vitest";
import { PAN_REACH_SX, inBuildRegion, inCore, inCoverQuad, inPanReach, COVER_MARGIN } from "../map/geo";
import { PAN_CONFIGS, panExtremes } from "./pan-fixtures";

// #496: the city builds what a pan can show, not only the 16:9 cover.
describe("the pan reach (#496)", () => {
  it("every corner a pan reaches, in the 9 configurations, is in the pan reach", () => {
    for (const cfg of PAN_CONFIGS) for (const corners of panExtremes(cfg)) for (const c of corners) {
      const at = `${cfg.frame} ${cfg.w}x${cfg.h} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
      expect(c.x - c.y, at).toBeGreaterThanOrEqual(PAN_REACH_SX);
      expect(inPanReach(c.x, c.y, 1e-6), at).toBe(true);
    }
  });

  it("PAN_REACH_SX is tight: some configuration reaches within 2 u of it", () => {
    const min = Math.min(...PAN_CONFIGS.flatMap((cfg) => panExtremes(cfg).flat().map((c) => c.x - c.y)));
    expect(min).toBeLessThan(PAN_REACH_SX + 2);
    expect(PAN_REACH_SX).toBe(-712);
  });

  it("the build region holds the cover with its margin and the reach", () => {
    expect(inBuildRegion(-300, 250)).toBe(true);
    expect(inBuildRegion(-100, 600)).toBe(true); // x − y = −700, south of the cover
    expect(inBuildRegion(-399, 711 + 60)).toBe(false);
    expect(inBuildRegion(-380, 400)).toBe(false); // x − y = −780
    for (let x = -500; x <= 600; x += 4) for (let y = -500; y <= 800; y += 4) {
      expect(inCore(x, y)).toBe(inCoverQuad(x, y, 16 / 9, COVER_MARGIN));
      if (inCore(x, y)) expect(inBuildRegion(x, y), `${x},${y}`).toBe(true);
    }
  });
});
