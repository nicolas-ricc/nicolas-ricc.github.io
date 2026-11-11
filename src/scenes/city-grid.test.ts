import { describe, expect, it } from "vitest";
import { ESTUARY_Y0, QUAY_X, SHORE_W, STATION_LAND, ZONE_SPLIT_X, ZONE_SPLIT_Y, distToHeadland, eastBank } from "../map/geo";
import { AVENUE, BLOCK_D, BLOCK_W, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, DISTRICT_COLS, DISTRICT_ROWS, EAST_RING, FREIGHT_ROW, HARBOR, PROMENADE, PLAZA, RAIL_LANDS, RING_Y0, ROWS, STREET, TOWER, WEST_QUAY, blocks, estuaryEast, estuaryReaches, inBlock, inCrater } from "./city-grid";

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
      if (b.y === ROWS[0]) expect(b.y).toBe(CITY_EDGE.north + 2); // row 92: 2 u from the seam fence, no street to the north
      else expect(b.y).toBeGreaterThanOrEqual(CITY_EDGE.north + STREET);
      expect(b.y + b.d).toBeLessThanOrEqual(CITY_EDGE.south - 4); // the south street is 4: the edge is aligned to CELL
      if (b.bank === "west") expect(b.x + b.w).toBeLessThanOrEqual(WEST_QUAY.x0 - STREET);
      else {
        expect(b.x + b.w).toBeLessThanOrEqual(PROMENADE.x0);
        if (b.y < ESTUARY_Y0) expect(b.x).toBeGreaterThanOrEqual(Math.max(eastBank(b.y), eastBank(b.y + b.d)) + 1); // north of the estuary the bank is the channel's
        else if (b.kind !== "collapsed") expect(b.x).toBeGreaterThanOrEqual(estuaryEast(b.y + b.d) + STREET);
      }
    }
    // the collapse is the only block the water touches
    expect(COLLAPSED.x).toBeLessThan(estuaryEast(COLLAPSED.y + COLLAPSED.d) + STREET);
  });

  it("the avenue separates rows 2 and 3 and the bridge crosses it from quay to ring", () => {
    expect(ROWS[2] + BLOCK_D).toBe(AVENUE.y0);
    expect(ROWS[3]).toBe(AVENUE.y1);
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
    expect(blocks().filter((b) => b.y === ROWS[0]).every((b) => b.kind === "block")).toBe(true); // row 92 is not district, even in DISTRICT_COLS
    expect(blocks().filter((b) => b.kind === "block")).toHaveLength(36); // the 30 old blocks minus the collapsed one, plus row 92 (5) and the two new east blocks (#320)
    expect(CITY_EDGE).toEqual({ west: -54, north: 90, south: 324 });
    expect(PROMENADE.y1).toBe(326);
  });

  describe("the new strip y 90..158 (#320)", () => {
    const at = (x: number, y: number) => blocks().filter((b) => b.x === x && b.y === y);

    it("ROWS starts at row 92 and the plaza block is row 3", () => {
      expect(ROWS).toEqual([92, 164, 188, 218, 242, 272, 302]);
      expect(ROWS[3]).toBe(PLAZA.y);
      expect(blocks().find((b) => b.kind === "plaza")!.row).toBe(3);
    });

    it("row 92: five west blocks west of the station land", () => {
      const row = blocks().filter((b) => b.y === 92);
      expect(row.map((b) => b.x)).toEqual([-48, -18, 12, 42, 72]);
      for (const b of row) {
        expect(b).toMatchObject({ w: BLOCK_W, d: BLOCK_D, bank: "west", kind: "block", row: 0 });
        expect(b.x + b.w).toBeLessThanOrEqual(STATION_LAND.x0);
      }
    });

    it("five freight lots 24 × 13 at y 116, in the columns of row 92", () => {
      expect(FREIGHT_ROW).toEqual({ y: 116, d: 13 });
      const lots = blocks().filter((b) => b.kind === "freight");
      expect(lots.map((b) => b.x)).toEqual([-48, -18, 12, 42, 72]);
      for (const b of lots) expect(b).toMatchObject({ y: 116, w: 24, d: 13, bank: "west", row: -1 });
    });

    it("constants of the strip", () => {
      expect(RAIL_LANDS).toEqual({ y0: 129, y1: 158 });
      expect(RING_Y0).toBe(120);
      expect(HARBOR).toEqual({ x0: EAST_RING.x0, x1: 306, y0: ZONE_SPLIT_Y, y1: ESTUARY_Y0 });
    });

    it("east: (280, 116) and (280, 140) exist, (280, 92) does not, nothing at x ≥ 310 north of 164", () => {
      for (const y of [116, 140]) expect(at(280, y)).toEqual([expect.objectContaining({ bank: "east", kind: "block", w: BLOCK_W, d: BLOCK_D })]);
      expect(at(280, 92)).toHaveLength(0);
      expect(blocks().filter((b) => b.bank === "east" && b.y < ROWS[1]).map((b) => `${b.x},${b.y}`)).toEqual(["280,116", "280,140"]);
    });

    it("no block touches the station land or the headland shore", () => {
      const station = { x: STATION_LAND.x0, y: STATION_LAND.y0, w: STATION_LAND.x1 - STATION_LAND.x0, d: STATION_LAND.y1 - STATION_LAND.y0 };
      for (const b of blocks()) {
        expect(overlaps(b, station), `${b.x},${b.y}`).toBe(false);
        for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.d], [b.x + b.w, b.y + b.d]] as const) expect(distToHeadland(x, y), `${b.x},${b.y}`).toBeGreaterThanOrEqual(SHORE_W);
      }
    });

    it("the freight lots are a street (6) south of row 92 and end 0.5 north of the fence line", () => {
      for (const b of blocks().filter((x) => x.kind === "freight")) {
        expect(b.y - (ROWS[0] + BLOCK_D)).toBe(STREET);
        expect(RAIL_LANDS.y0 + 0.5 - (b.y + b.d)).toBe(0.5);
      }
    });
  });
});
