import { describe, expect, it } from "vitest";
import { ESTUARY_Y0, QUAY_X, SHORE_W, STATION_LAND, ZONE_SPLIT_X, ZONE_SPLIT_Y, distToHeadland, eastBank } from "../map/geo";
import { AVENUE, BLOCK_W, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, EAST_RING, FREIGHT_ROW, HARBOR, PROMENADE, RAIL_LANDS, RING_Y0, ROWS, STREET, WEST_QUAY, blocks, estuaryEast, estuaryReaches, inBlock, inCrater } from "./city-grid";

const BLOCK_D = 18; // depth of the strip and east blocks
const overlaps = (a: { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

describe("city-grid", () => {
  it("there are at least 18 blocks and one collapse, and none overlaps another", () => {
    const bs = blocks();
    expect(bs.length).toBeGreaterThanOrEqual(18);
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

  it("the bridge crosses the avenue from quay to ring", () => {
    expect(ROWS[2] + BLOCK_D).toBe(AVENUE.y0);
    expect(ROWS[3]).toBe(AVENUE.y1);
    expect(BRIDGE.x0).toBe(WEST_QUAY.x0);
    expect(BRIDGE.x1).toBe(EAST_RING.x1);
    expect(BRIDGE.y0).toBeGreaterThanOrEqual(AVENUE.y0);
    expect(BRIDGE.y1).toBeLessThanOrEqual(AVENUE.y1);
    expect(estuaryEast(BRIDGE.y1)).toBeLessThan(BRIDGE.x1); // the bridge reaches land
  });

  it("the craters are on streets, not on blocks or parcels", () => {
    expect(CRATERS).toHaveLength(3);
    for (const c of CRATERS) {
      expect(inBlock(c.x, c.y)).toBe(false);
      expect(inCrater(c.x, c.y)).toBe(true);
      expect(inCrater(c.x + c.r + 1, c.y)).toBe(false);
    }
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

  it("the west bank south of the strip is not blocks; the east bank stays; the promenade reaches 326", () => {
    expect(blocks().filter((b) => b.bank === "east" && b.y >= ROWS[1]).map((b) => `${b.x},${b.y}`)).toEqual(["280,164", "310,164", "280,188", "310,188", "280,218", "310,218", "280,242", "310,242"]);
    expect(blocks().filter((b) => b.kind === "block")).toHaveLength(14); // row 92 (5) + the two east of the strip + the east bank minus the collapsed one (7)
    expect(CITY_EDGE).toEqual({ west: -54, north: 90, south: 324 });
    expect(PROMENADE.y1).toBe(326);
  });

  describe("the new strip y 90..158 (#320)", () => {
    const at = (x: number, y: number) => blocks().filter((b) => b.x === x && b.y === y);

    it("ROWS starts at row 92", () => {
      expect(ROWS).toEqual([92, 164, 188, 218, 242, 272, 302]);
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

// ---------------------------------------------------------------- #472: the west bank leaves the old grid
import { CITY_BOUNDS as PLAN_CITY_BOUNDS, PLAZA_CENTER as PLAN_CENTER, onAxis as onPlanAxis, inParcel as inPlanParcel, parcels as planParcels } from "./city-plan";

describe("city-grid after the new layout (#472)", () => {
  it("blocks() has no west block south of the strip", () => {
    for (const b of blocks()) if (b.bank === "west") expect(b.y, `${b.x},${b.y}`).toBeLessThan(164);
    expect(blocks().some((b) => (b.kind as string) === "plaza" || (b.kind as string) === "district" || (b.kind as string) === "site")).toBe(false);
  });

  it("CRATERS are the two west crossings and the east one", () => {
    expect(CRATERS).toEqual([{ x: 40, y: 198, r: 5 }, { x: -20, y: 258, r: 6 }, { x: 307, y: 224, r: 5 }]);
  });

  it("the two west craters sit on crossings of ordinary streets, off the axes and the parcels", () => {
    for (const c of CRATERS.slice(0, 2)) {
      expect(((c.x - 40) % 30 + 30) % 30, `${c.x}`).toBe(0);
      expect(((c.y - 48) % 30 + 30) % 30, `${c.y}`).toBe(0);
      expect(onPlanAxis(c.x, c.y)).toBe(false);
      expect(inPlanParcel(c.x, c.y)).toBe(false);
    }
  });

  it("inBlock is true inside a parcel and false on the plaza and on an axis band", () => {
    expect(inBlock(PLAN_CENTER.x, PLAN_CENTER.y)).toBe(false);
    expect(inBlock(10, 250)).toBe(false); // the boulevard
    const p = planParcels(PLAN_CITY_BOUNDS).find((q) => q.rect.w > 12)!;
    expect(inBlock(p.rect.x + p.rect.w / 2, p.rect.y + p.rect.d / 2)).toBe(true);
  });
});
