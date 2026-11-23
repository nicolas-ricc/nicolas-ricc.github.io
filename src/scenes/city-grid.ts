import { inParcel } from "./city-plan";
import { ESTUARY_FLARE, ESTUARY_Y0, QUAY_X, SEAM_CY, STATION_LAND, ZONE_SPLIT_Y, eastBank, estuaryEast } from "../map/geo";
export { ESTUARY_FLARE, estuaryEast };

/**
 * Grid of Resume, the office city. Pure module, no rng: it is the single
 * source of truth for the terrain (cityTerrainAt) and for the scene (city.ts),
 * so the asphalt and the plinths cannot drift out of alignment. World coordinates.
 * Spec: docs/superpowers/specs/2026-09-14-resume-ciudad-design.md §2.
 */
export interface Rect { x: number; y: number; w: number; d: number }

export const BLOCK_W = 24, STREET = 6;
const BLOCK_D = 18; // depth of the strip and east-bank blocks (the suburb blocks have their own, in sprawl-grid)
export const SIDEWALK = 1.5; // free sidewalk inside the plinth

export const WEST_COLS = [-48, -18, 12, 42, 72, 102, 132, 162] as const;
export const EAST_COLS = [280, 310] as const;
/** Row 92 is the new strip (2 from the seam); the district starts at ROWS[1]. */
export const ROWS = [92, 164, 188, 218, 242, 272, 302] as const;
/** Freight lots on the rail line: five west lots of depth 13 south of row 92 (6 apart). */
export const FREIGHT_ROW = { y: 116, d: 13 } as const;
/** Rail lands: the strip between the freight lots and the track. */
export const RAIL_LANDS = { y0: 129, y1: 158 } as const;
/** North edge of the east ring street. */
export const RING_Y0 = 120;
export const AVENUE = { y0: 206, y1: 218 } as const;
export const BOULEVARD = { y0: 210, y1: 214 } as const;
export const WEST_QUAY = { x0: 192, x1: QUAY_X } as const;   // retaining wall of the west bank
export const EAST_RING = { x0: 270, x1: 276 } as const;      // street along the east bank; x0 a multiple of CELL (classifies terrain)
export const CITY_EDGE = { west: -54, north: 90, south: 324 } as const; // the city starts at the seam (ZONE_SPLIT_Y); beyond west and south, asphalt; south a multiple of CELL (classifies terrain)
export const DISTRICT_BANK_Y = 264; // east bank of the district from here; a multiple of CELL (classifies terrain)
export const DISTRICT_ROW_Y = 272; // first row of the old district: the east bank south of it is jungle and promenade (blocks, greenery, east lines)
export const PROMENADE_STREET_X = 336; // promenade street; a multiple of CELL (classifies terrain)

/** Harbor strip (#326): from the east ring to x 306, between the seam and the estuary. Asphalt, except the inlet. */
export const HARBOR = { x0: EAST_RING.x0, x1: 306, y0: ZONE_SPLIT_Y, y1: ESTUARY_Y0 } as const;
/** Water inlet (#326) cut into the harbor strip, open to the river on its west side. Half-open: x0 <= x < x1, y0 <= y < y1. */
export const DARSENA = { x0: 282, x1: 300, y0: 96, y1: 114 } as const;

export const BRIDGE = { x0: 192, x1: 276, y0: 207, y1: 217, z: 1.2, deckH: 0.6 } as const;
export const PROMENADE = { x0: 334, x1: 344, y0: 158, y1: 326, z: 0.6 } as const;
export const COLLAPSED: Rect = { x: 280, y: 242, w: 24, d: 18 }; // the estuary already reaches x ≈ 281 at y 260
/** The fourth block of the collapse, fallen into the street in front of the promenade: `collapsed()` draws it and the cars dodge it. */
export const FALLEN_BLOCK: Rect = { x: PROMENADE.x0 - 8, y: 237.5, w: 6, d: 3 };
/** Two craters on ordinary street crossings of the new west grid (off the axes and the parcels) and the east one. */
export const CRATERS: readonly { x: number; y: number; r: number }[] = [{ x: 40, y: 198, r: 5 }, { x: -20, y: 258, r: 6 }, { x: 307, y: 224, r: 5 }];

/** Inverse of estuaryEast south of ESTUARY_Y0: at which y the east bank reaches x (less than ESTUARY_Y0 if it never reaches it to the north). */
export const estuaryReaches = (x: number): number => ESTUARY_Y0 + (x - eastBank(SEAM_CY)) / ESTUARY_FLARE;

export type BlockKind = "block" | "parcel" | "collapsed" | "freight";
export interface Block extends Rect { bank: "west" | "east"; row: number; kind: BlockKind }

export function blocks(): Block[] {
  const out: Block[] = [];
  ROWS.forEach((y, row) => {
    if (y === ROWS[0]) {
      for (const x of WEST_COLS) if (x + BLOCK_W <= STATION_LAND.x0) out.push({ x, y, w: BLOCK_W, d: BLOCK_D, bank: "west", row, kind: "block" }); // the station land stays Portfolio
      return; // the east of the strip is the two blocks below
    }
    if (y >= DISTRICT_ROW_Y) return; // south of the old avenue the east bank is jungle and promenade; the west bank is the city plan's (city-plan.ts)
    for (const x of EAST_COLS) {
      const kind: BlockKind = x === COLLAPSED.x && y === COLLAPSED.y ? "collapsed" : "block";
      out.push({ x, y, w: BLOCK_W, d: BLOCK_D, bank: "east", row, kind });
    }
  });
  // Outside ROWS (row -1): the two east blocks of the strip and the freight lots.
  // 116 is the freight row; 140 is the second east row of the strip, a street (6) south of 134.
  for (const y of [FREIGHT_ROW.y, 140]) out.push({ x: EAST_COLS[0], y, w: BLOCK_W, d: BLOCK_D, bank: "east", row: -1, kind: "block" });
  for (const x of WEST_COLS) if (x + BLOCK_W <= STATION_LAND.x0) out.push({ x, y: FREIGHT_ROW.y, w: BLOCK_W, d: FREIGHT_ROW.d, bank: "west", row: -1, kind: "freight" });
  return out;
}

export function inCrater(x: number, y: number): boolean {
  return CRATERS.some((c) => Math.hypot(x - c.x, y - c.y) <= c.r);
}

export function inBlock(x: number, y: number): boolean {
  return blocks().some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.d) || inParcel(x, y);
}
