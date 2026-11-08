import { describe, expect, it } from "vitest";
import { ESTUARY_Y0, QUAY_X, ZONE_SPLIT_X } from "../map/geo";
import { AVENUE, BLOCK_D, BLOCK_W, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, DISTRICT_COLS, DISTRICT_ROWS, EAST_RING, PROMENADE, PLAZA, ROWS, STREET, TOWER, WEST_QUAY, blocks, estuaryEast, estuaryReaches, inBlock, inCrater } from "./city-grid";

const overlaps = (a: { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

describe("city-grid", () => {
  it("there are at least 30 blocks, one plaza and one collapse, and none overlaps another", () => {
    const bs = blocks();
    expect(bs.length).toBeGreaterThanOrEqual(30);
    expect(bs.filter((b) => b.kind === "plaza")).toHaveLength(1);
    expect(bs.filter((b) => b.kind === "collapsed")).toHaveLength(1);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) expect(overlaps(bs[i]!, bs[j]!)).toBe(false);
  });

  it("between neighboring blocks there is at least one street", () => {
    const bs = blocks();
    for (const a of bs) for (const b of bs) {
      if (a === b) continue;
      const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gapY = Math.max(b.y - (a.y + a.d), a.y - (b.y + b.d));
      expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(STREET);
    }
  });

  it("every block falls on city land: away from the estuary, inside the edges", () => {
    for (const b of blocks()) {
      expect(b.x).toBeGreaterThanOrEqual(CITY_EDGE.west);
      expect(b.y).toBeGreaterThanOrEqual(CITY_EDGE.north + STREET);
      expect(b.y + b.d).toBeLessThanOrEqual(CITY_EDGE.south - 4); // the south street is 4: the edge is aligned to CELL
      if (b.bank === "west") expect(b.x + b.w).toBeLessThanOrEqual(WEST_QUAY.x0 - STREET);
      else {
        expect(b.x + b.w).toBeLessThanOrEqual(PROMENADE.x0);
        if (b.kind !== "collapsed") expect(b.x).toBeGreaterThanOrEqual(estuaryEast(b.y + b.d) + STREET);
      }
    }
    // the collapse is the only block the water touches
    expect(COLLAPSED.x).toBeLessThan(estuaryEast(COLLAPSED.y + COLLAPSED.d) + STREET);
  });

  it("the avenue separates rows 2 and 3 and the bridge crosses it from quay to ring", () => {
    expect(ROWS[1] + BLOCK_D).toBe(AVENUE.y0);
    expect(ROWS[2]).toBe(AVENUE.y1);
    expect(BRIDGE.x0).toBe(WEST_QUAY.x0);
    expect(BRIDGE.x1).toBe(EAST_RING.x1);
    expect(BRIDGE.y0).toBeGreaterThanOrEqual(AVENUE.y0);
    expect(BRIDGE.y1).toBeLessThanOrEqual(AVENUE.y1);
    expect(estuaryEast(BRIDGE.y1)).toBeLessThan(BRIDGE.x1); // the bridge reaches land
  });

  it("the plaza and the tower are in place and the tower fits inside the plaza", () => {
    expect(blocks().find((b) => b.kind === "plaza")).toMatchObject(PLAZA);
    expect(PLAZA.y).toBe(AVENUE.y1);
    expect(overlaps(TOWER, PLAZA)).toBe(true);
    expect(TOWER.x).toBeGreaterThan(PLAZA.x); expect(TOWER.x + TOWER.w).toBeLessThan(PLAZA.x + PLAZA.w);
    expect(TOWER.y).toBeGreaterThan(PLAZA.y); expect(TOWER.y + TOWER.d).toBeLessThan(PLAZA.y + PLAZA.d);
  });

  it("the craters are on streets, not on blocks", () => {
    expect(CRATERS).toHaveLength(3);
    for (const c of CRATERS) {
      expect(inBlock(c.x, c.y)).toBe(false);
      expect(inCrater(c.x, c.y)).toBe(true);
      expect(inCrater(c.x + c.r + 1, c.y)).toBe(false);
    }
    expect(inBlock(PLAZA.x + 1, PLAZA.y + 1)).toBe(true);
  });

  it("the estuary inherits the channel at the seam and opens toward the south", () => {
    expect(estuaryEast(ESTUARY_Y0)).toBeGreaterThan(QUAY_X + 30);
    expect(estuaryEast(ESTUARY_Y0)).toBeLessThan(QUAY_X + 60);
    expect(estuaryEast(260) - estuaryEast(ESTUARY_Y0)).toBeCloseTo((260 - ESTUARY_Y0) * 0.35, 6);
    expect(estuaryEast(270)).toBeLessThan(ZONE_SPLIT_X - 40);
    expect(estuaryReaches(estuaryEast(240))).toBeCloseTo(240, 6);            // inverse
    expect(estuaryReaches(EAST_RING.x0 + STREET / 2)).toBeGreaterThan(AVENUE.y1); // the axis of the ring steps on water only south of the avenue
    expect(BLOCK_W).toBe(24);
  });

  it("district: two columns to the west and two rows to the south, west bank only, 24 blocks with one construction site; the promenade reaches 326", () => {
    const d = blocks().filter((b) => b.kind === "district" || b.kind === "site");
    expect(d).toHaveLength(24);
    expect(d.filter((b) => b.kind === "site")).toHaveLength(1);
    expect(d.every((b) => b.bank === "west")).toBe(true);
    expect(d.every((b) => (DISTRICT_COLS as readonly number[]).includes(b.x) || (DISTRICT_ROWS as readonly number[]).includes(b.y))).toBe(true);
    expect(blocks().filter((b) => b.bank === "east").every((b) => b.y < DISTRICT_ROWS[0])).toBe(true);
    expect(blocks().filter((b) => b.kind === "block")).toHaveLength(29); // the 30 old blocks minus the collapsed one: no old block changed kind
    expect(CITY_EDGE).toEqual({ west: -54, north: 90, south: 324 });
    expect(PROMENADE.y1).toBe(326);
  });
});
