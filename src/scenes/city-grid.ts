import { ESTUARY_FLARE, ESTUARY_Y0, QUAY_X, SEAM_CY, eastBank, estuaryEast } from "../map/geo";
export { ESTUARY_FLARE, estuaryEast };

/**
 * Grid of Resume, the office city. Pure module, no rng: it is the single
 * source of truth for the terrain (cityTerrainAt) and for the scene (city.ts),
 * so the asphalt and the plinths cannot drift out of alignment. World coordinates.
 * Spec: docs/superpowers/specs/2026-09-14-resume-ciudad-design.md §2.
 */
export interface Rect { x: number; y: number; w: number; d: number }

export const BLOCK_W = 24, BLOCK_D = 18, STREET = 6;
export const SIDEWALK = 1.5; // free sidewalk inside the plinth

export const WEST_COLS = [-48, -18, 12, 42, 72, 102, 132, 162] as const;
export const EAST_COLS = [280, 310] as const;
export const ROWS = [164, 188, 218, 242, 272, 302] as const;
/** Modern district: the two westmost columns and the two southmost rows (west bank only: south of 272 the estuary already passes x 285). */
export const DISTRICT_COLS = [-48, -18] as const;
export const DISTRICT_ROWS = [272, 302] as const;
export const SITE: Rect = { x: -18, y: 272, w: 24, d: 18 }; // the construction site
/** The tower with the lit floor: here (no rng) so src/city/zoning.ts computes its box without importing city.ts. */
export const TOWER_H = 30, TOWER_FLOORS = 8, LIT_FLOOR = 5;

export const AVENUE = { y0: 206, y1: 218 } as const;
export const BOULEVARD = { y0: 210, y1: 214 } as const;
export const WEST_QUAY = { x0: 192, x1: QUAY_X } as const;   // retaining wall of the west bank
export const EAST_RING = { x0: 270, x1: 276 } as const;      // street along the east bank; x0 a multiple of CELL (classifies terrain)
export const CITY_EDGE = { west: -54, north: 158, south: 324 } as const; // jungle beyond; south a multiple of CELL (classifies terrain)
export const DISTRICT_BANK_Y = 264; // east bank of the district from here; a multiple of CELL (classifies terrain)
export const PROMENADE_STREET_X = 336; // promenade street; a multiple of CELL (classifies terrain)

export const PLAZA: Rect = { x: 102, y: 218, w: 54, d: 18 }; // joins two columns of the south row of the avenue
export const TOWER: Rect = { x: 121, y: 220, w: 16, d: 14 }; // centered at (129, 227)
export const BRIDGE = { x0: 192, x1: 276, y0: 207, y1: 217, z: 1.2, deckH: 0.6 } as const;
export const PROMENADE = { x0: 334, x1: 344, y0: 158, y1: 326, z: 0.6 } as const;
export const COLLAPSED: Rect = { x: 280, y: 242, w: 24, d: 18 }; // the estuary already reaches x ≈ 281 at y 260
/** The fourth block of the collapse, fallen into the street in front of the promenade: `collapsed()` draws it and the cars dodge it. */
export const FALLEN_BLOCK: Rect = { x: PROMENADE.x0 - 8, y: 237.5, w: 6, d: 3 };
export const CRATERS: readonly { x: number; y: number; r: number }[] = [{ x: 60, y: 185, r: 5 }, { x: 150, y: 239, r: 6 }, { x: 307, y: 224, r: 5 }];

/** Inverse of estuaryEast south of ESTUARY_Y0: at which y the east bank reaches x (less than ESTUARY_Y0 if it never reaches it to the north). */
export const estuaryReaches = (x: number): number => ESTUARY_Y0 + (x - eastBank(SEAM_CY)) / ESTUARY_FLARE;

export type BlockKind = "block" | "plaza" | "collapsed" | "district" | "site";
export interface Block extends Rect { bank: "west" | "east"; row: number; kind: BlockKind }

export function blocks(): Block[] {
  const out: Block[] = [];
  const isDistrict = (x: number, y: number) => (DISTRICT_COLS as readonly number[]).includes(x) || (DISTRICT_ROWS as readonly number[]).includes(y);
  ROWS.forEach((y, row) => {
    for (const x of WEST_COLS) {
      if (y === PLAZA.y && x >= PLAZA.x && x < PLAZA.x + PLAZA.w) continue; // the plaza joins those two
      const kind: BlockKind = x === SITE.x && y === SITE.y ? "site" : isDistrict(x, y) ? "district" : "block";
      out.push({ x, y, w: BLOCK_W, d: BLOCK_D, bank: "west", row, kind });
    }
    if (y >= DISTRICT_ROWS[0]) return; // south of the old avenue the east bank is jungle and promenade
    for (const x of EAST_COLS) {
      const kind: BlockKind = x === COLLAPSED.x && y === COLLAPSED.y ? "collapsed" : "block";
      out.push({ x, y, w: BLOCK_W, d: BLOCK_D, bank: "east", row, kind });
    }
  });
  out.push({ ...PLAZA, bank: "west", row: 2, kind: "plaza" });
  return out;
}

export function inCrater(x: number, y: number): boolean {
  return CRATERS.some((c) => Math.hypot(x - c.x, y - c.y) <= c.r);
}

export function inBlock(x: number, y: number): boolean {
  return blocks().some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.d);
}
