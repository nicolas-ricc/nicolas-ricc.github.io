import { describe, expect, it } from "vitest";
import { BLEED, CELL, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, coverQuad, inCoverQuad, pointInPolygon, riverCenter } from "../map/geo";
import { CITY_EDGE, estuaryEast } from "./city-grid";
import { GREEN_BELT, REACH, bayShoreX, builtAt, fairAt, reachAt, suburbBlocks, urbanAt } from "./sprawl-grid";
import { bleedTerrainAt, bleedZ, terrainAt } from "./terrain";

describe("green belt", () => {
  it("is y 116..158", () => { expect(GREEN_BELT).toEqual({ y0: 116, y1: 158 }); });
});

describe("sprawl-grid", () => {
  it("the reach undulates between REACH and REACH + 36 and is never straight", () => {
    const xs = Array.from({ length: 40 }, (_, i) => reachAt("s", -300 + i * 20));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(REACH.s); expect(Math.max(...xs)).toBeLessThanOrEqual(REACH.s + 36);
    expect(new Set(xs.map((v) => Math.round(v))).size).toBeGreaterThan(10);
  });

  it("builtAt: industrial north and west of Portfolio, urban west and south of Resume, nothing over water or in the green belt", () => {
    expect(builtAt(-100, 0)).toBe("industrial");
    expect(builtAt(-100, 100)).toBe("urban");
    expect(builtAt(-100, 80)).toBe("industrial");
    expect(builtAt(-100, 134)).toBeNull();          // green belt
    expect(builtAt(100, -100)).toBe("industrial");
    expect(builtAt(-100, 250)).toBe("urban");
    expect(builtAt(100, 500)).toBe("urban");
    expect(builtAt(-100, (GREEN_BELT.y0 + GREEN_BELT.y1) / 2)).toBeNull();
    expect(builtAt(250, 400)).toBeNull();          // estuary
    expect(builtAt(400, -100)).toBeNull();         // bay
    expect(builtAt(400, 400)).toBeNull();          // sea
    expect(builtAt(100, 100)).toBeNull();          // content
    expect(builtAt(-400, 100)).toBeNull();         // beyond the reach: hill
    expect(builtAt(150, -264)).toBe("fair");
    expect(builtAt(100, -220)).toBe("fair");
    expect(builtAt(40, -264)).toBe("industrial");   // west of the fair
    expect(builtAt(150, -330)).toBe("industrial");  // north of the fair
    expect(builtAt(150, -400)).toBeNull();          // beyond the new reach
    expect(builtAt(240, -300)).toBeNull();          // bay
    expect(fairAt(150, -264)).toBe(true); expect(fairAt(150, -100)).toBe(false);
    expect(bayShoreX(-300)).toBe(riverCenter(-300) - RIVER_HALF);
  });

  it("urbanAt covers the city edges that turned to asphalt and the urban bleed", () => {
    expect(urbanAt(-57, 200)).toBe(true);
    expect(urbanAt(100, 330)).toBe(true);
    expect(urbanAt(-100, 200)).toBe(true);
    expect(urbanAt(100, 200)).toBe(false);  // old city
    expect(urbanAt(-57, 150)).toBe(false);  // green belt
    expect(urbanAt(250, 400)).toBe(false);  // estuary
  });

  it("the blocks of the tech district fall entirely on urban ground inside the cover, and there are more than 100", () => {
    const blocks = suburbBlocks();
    expect(blocks.length).toBeGreaterThan(100);
    for (const b of blocks) {
      for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.d], [b.x, b.y + b.d]] as const) expect(urbanAt(x, y)).toBe(true);
      expect(inCoverQuad(b.x + b.w / 2, b.y + b.d / 2, 16 / 9, 30)).toBe(true);
      expect(b.x + b.w).toBeLessThanOrEqual(QUAY_X - 6); // they never step on the bank wall
      expect(b.dist).toBeGreaterThanOrEqual(0);
    }
    expect(blocks.some((b) => b.dist === 0)).toBe(true);
    expect(blocks.some((b) => b.dist > 160)).toBe(true);
  });

  it("inside the 16:9 cover the jungle (with rock) is at most 7 % of the bleed and 6 % of the total", () => {
    const quad = coverQuad(16 / 9).flat();
    let bleed = 0, bleedGreen = 0, all = 0, allGreen = 0;
    for (let y = WORLD.y0 - BLEED.y + 3; y < WORLD.y1 + BLEED.y; y += CELL) for (let x = WORLD.x0 - BLEED.x + 3; x < WORLD.x1 + BLEED.x; x += CELL) {
      if (!pointInPolygon(x, y, quad)) continue;
      const inside = x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1;
      const green = inside ? terrainAt(x, y) === "jungle" : bleedTerrainAt(x, y) === "jungle";
      all++; if (green) allGreen++;
      if (!inside) { bleed++; if (green) bleedGreen++; }
    }
    expect(bleedGreen / bleed).toBeLessThan(0.07);
    expect(allGreen / all).toBeLessThan(0.06);
  });

  it("the estuary continues south to the sea and the bleed terrain is flat where it is built", () => {
    for (let y = WORLD.y1 + 3; y < 460; y += CELL) expect(bleedTerrainAt(QUAY_X + 10, y)).toBe("river");
    expect(estuaryEast(460)).toBeGreaterThan(ZONE_SPLIT_X);
    for (let y = WORLD.y1 + 3; y < WORLD.y1 + REACH.s; y += CELL) for (let x = -200; x < QUAY_X; x += CELL) if (builtAt(x, y)) expect(bleedZ(x, y)).toBe(0.6);
    expect(terrainAt(CITY_EDGE.west - 3, 200)).toBe("asphalt");
  });
});
