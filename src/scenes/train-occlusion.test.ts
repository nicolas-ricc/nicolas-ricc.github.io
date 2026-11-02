import { describe, expect, it } from "vitest";
import { hullsIntersect, isBehind, overlaps, screenBounds, screenHull } from "../iso/depth";
import { bounds } from "../iso/solids";
import { WORLD } from "../map/geo";
import { WEST_RAIL_X0 } from "./hinterland";
import { STOP_X, TRACKS_Y } from "./station";
import { trainBox, trainLen } from "./train";
import { world } from "./world";

/**
 * The animated layers are painted on top of the whole static scene (`stage.ts`): if a static solid ended up in front
 * of the train on screen, the train would wrongly cover it. §6.2 gives the rule; here it is tested on the assembled world, sweeping the
 * train box along track 3 from the edge of the bleed to the buffer. Solids of height ≤ 0.4 (rails, sleepers,
 * planks) are exempt.
 */
describe("train occlusion on the west track (#280)", () => {
  const statics = world(7).solids.map((s) => {
    const b = bounds(s);
    return { s, b, sb: screenBounds(b), sh: screenHull(b) };
  }).filter((o) => o.b.max.z - o.b.min.z > 0.4);
  const x0s: number[] = [];
  for (let x0 = WEST_RAIL_X0 - trainLen(4); x0 <= STOP_X - trainLen(4) + 1e-9; x0 += 4) x0s.push(x0);
  x0s.push(STOP_X - trainLen(4)); // stopped: the step of 4 does not land on 111.2
  const overlapping = (x0: number) => {
    const tb = trainBox(x0, TRACKS_Y[2], 4), sb = screenBounds(tb), sh = screenHull(tb);
    return { tb, hits: statics.filter((o) => overlaps(sb, o.sb) && hullsIntersect(sh, o.sh)) };
  };

  it("no tall static solid ends up in front of the train along the whole route", () => {
    expect(x0s[0]).toBeCloseTo(-448.8, 9);
    expect(x0s[x0s.length - 1]).toBeCloseTo(111.2, 9);
    let pairs = 0;
    for (const x0 of x0s) {
      const { tb, hits } = overlapping(x0);
      pairs += hits.length;
      for (const o of hits) expect(isBehind(tb, o.b), `x0 ${x0}: ${JSON.stringify(o.s).slice(0, 160)}`).toBe(false);
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it("the sweep covers the bleed: there are solids west of the world that overlap the train", () => {
    expect(x0s.some((x0) => overlapping(x0).hits.some((o) => o.b.max.x < WORLD.x0))).toBe(true);
  });
});
