import { describe, expect, it } from "vitest";
import { HEADLAND, MOUTH_Y, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, abyssX, distToHeadland, estuaryEast, estuaryInset, inHeadland, inMouth, islandEastX, islandWestX, northCoastY, pointInPolygon, riverCenter, shoreWidth, worldZoneAt } from "./geo";

describe("world", () => {
  it("the content has a negative origin and sides that are multiples of 18", () => {
    expect(WORLD).toEqual({ x0: -60, y0: -60, x1: 570, y1: 336 });
    expect([ZONE_SPLIT_X, ZONE_SPLIT_Y]).toEqual([344, 146]);
    expect((WORLD.x1 - WORLD.x0) % 18).toBe(0);
    expect((WORLD.y1 - WORLD.y0) % 18).toBe(0);
  });

  it("clickable zone: the headland and its shore are Portfolio, the seawall shore Resume, the open sea Blog", () => {
    expect(worldZoneAt(10, 10)).toBe("portfolio");
    expect(worldZoneAt(-30, -30)).toBe("portfolio");   // factory band
    expect(worldZoneAt(10, 200)).toBe("cv");
    expect(worldZoneAt(-30, 300)).toBe("cv");          // district
    expect(worldZoneAt(380, 118)).toBe("portfolio");   // headland
    expect(worldZoneAt(404, 118)).toBe("portfolio");   // reef
    expect(worldZoneAt(350, 100)).toBe("portfolio");   // shipyard shore
    expect(worldZoneAt(350, 200)).toBe("cv");          // seawall shore
    expect(worldZoneAt(500, 200)).toBe("blog");
    expect(worldZoneAt(400, 10)).toBe("blog");
    expect(worldZoneAt(400, 260)).toBe("blog");
    for (let y = -60; y < 336; y += 6) expect(worldZoneAt(ZONE_SPLIT_X + shoreWidth(y) - 0.5, y)).not.toBe("blog");
  });

  it("the trench starts at x ≈ 392 in the north, more than 30 u from the headland, and opens east toward the south", () => {
    expect(abyssX(-60)).toBeCloseTo(392 + 6 * Math.sin(-60 / 17), 6);
    expect(abyssX(118) - 400).toBeGreaterThan(30);
    expect(abyssX(336)).toBeGreaterThan(abyssX(-60) + 90);
    expect(shoreWidth(0)).toBeGreaterThan(4);
  });

  it("the mouth reaches the north coast of the island", () => {
    expect(MOUTH_Y).toBe(24);
    for (let x = 280; x <= 360; x += 4) {
      const c = northCoastY(x);
      expect(inMouth(x, c - 1)).toBe(true);  // one step north of the coast: mouth water
      expect(inMouth(x, c + 1)).toBe(false); // one step south: already land
    }
    expect(inMouth(riverCenter(0) - RIVER_HALF - 1, 0)).toBe(false); // west of the river there is no mouth
  });

  it("the headland starts at the fitting-out quay and reaches x≈400 with the lighthouse at the tip", () => {
    expect(inHeadland(336, 115)).toBe(true);
    expect(inHeadland(396, 118)).toBe(true);
    expect(inHeadland(410, 118)).toBe(false);
    expect(inHeadland(360, 90)).toBe(false);
    expect(Math.min(...HEADLAND.map(([x]) => x))).toBeLessThanOrEqual(330);
    expect(Math.max(...HEADLAND.map(([x]) => x))).toBe(400);
  });

  it("distToHeadland is 0 inside and grows outside", () => {
    expect(distToHeadland(380, 118)).toBe(0);
    expect(distToHeadland(400, 118)).toBe(0);
    expect(distToHeadland(410, 118)).toBeCloseTo(10, 1);
    expect(distToHeadland(380, 80)).toBeGreaterThan(20);
  });

  it("pointInPolygon lives in geo", () => {
    expect(pointInPolygon(1, 1, [0, 0, 4, 0, 4, 4, 0, 4])).toBe(true);
    expect(pointInPolygon(5, 1, [0, 0, 4, 0, 4, 4, 0, 4])).toBe(false);
  });
});

describe("island coast", () => {
  it("islandEastX stays between the split and the edge of the shore; the seawall is straight; the south tip closes", () => {
    for (let y = 0; y <= 145; y++) {
      expect(islandEastX(y)).toBeGreaterThan(330);
      expect(islandEastX(y)).toBeLessThanOrEqual(ZONE_SPLIT_X + shoreWidth(y) - 1.5 + 1e-9);
    }
    for (let y = 158; y <= 336; y += 2) expect(islandEastX(y)).toBe(ZONE_SPLIT_X);
    expect(islandEastX(400)).toBe(-Infinity);
  });

  it("islandEastX changes scale in the north: it varies by at least two cells", () => {
    const xs = Array.from({ length: 146 }, (_, y) => islandEastX(y));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(12);
  });

  it("in front of the sheds the north coast stays at y ≤ 21", () => {
    for (let x = 303; x <= 327; x += 6) expect(northCoastY(x)).toBeLessThanOrEqual(21);
  });

  it("northCoastY: the cove at the NW drops below y 24 and the point at the NE rises north of y 12", () => {
    expect(northCoastY(286)).toBeGreaterThan(26);
    let min = Infinity;
    for (let x = 330; x <= 350; x++) min = Math.min(min, northCoastY(x));
    expect(min).toBeLessThan(12);
  });

  it("estuaryInset: in [0, 10], zero at the seam and under the collapsed block; islandWestX does not pass the riverside", () => {
    for (let y = 146; y <= 336; y++) {
      expect(estuaryInset(y)).toBeGreaterThanOrEqual(0);
      expect(estuaryInset(y)).toBeLessThanOrEqual(10);
    }
    expect(estuaryInset(150)).toBe(0);
    for (let y = 196; y <= 222; y += 2) expect(estuaryInset(y)).toBe(0); // bridge (y 207..217) and avenue
    for (let y = 238; y <= 262; y += 2) expect(estuaryInset(y)).toBe(0); // collapsed block: ramp and sunken slabs
    expect(estuaryInset(230)).toBeGreaterThan(2);                        // between the bridge and the collapse the riverside also reaches in
    for (let y = 146; y <= 400; y++) expect(islandWestX(y)).toBeLessThanOrEqual(estuaryEast(y));
  });
});
