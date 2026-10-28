import { ESTUARY_FLARE, QUAY_X, SEAM_CY, ZONE_SPLIT_Y, eastBank, estuaryEast } from "../map/geo";
export { ESTUARY_FLARE, estuaryEast };

/**
 * Grilla de Resume, la ciudad de oficinas. Módulo puro y sin rng: es la única
 * fuente de verdad para el terreno (cityTerrainAt) y para la escena (city.ts),
 * así el asfalto y los zócalos no pueden desalinearse. Coordenadas de mundo.
 * Spec: docs/superpowers/specs/2026-09-14-resume-ciudad-design.md §2.
 */
export interface Rect { x: number; y: number; w: number; d: number }

export const BLOCK_W = 24, BLOCK_D = 18, STREET = 6;
export const SIDEWALK = 1.5; // vereda libre dentro del zócalo

export const WEST_COLS = [-48, -18, 12, 42, 72, 102, 132, 162] as const;
export const EAST_COLS = [280, 310] as const;
export const ROWS = [164, 188, 218, 242, 272, 302] as const;
/** Distrito moderno: las dos columnas del oeste y las dos filas del sur (solo ribera oeste: al sur de 272 el estuario ya pasa x 285). */
export const DISTRICT_COLS = [-48, -18] as const;
export const DISTRICT_ROWS = [272, 302] as const;
export const SITE: Rect = { x: -18, y: 272, w: 24, d: 18 }; // la obra en construcción
/** La torre del piso encendido: acá (sin rng) para que district.ts calcule su caja sin importar city.ts. */
export const TOWER_H = 30, TOWER_FLOORS = 8, LIT_FLOOR = 5;

export const AVENUE = { y0: 206, y1: 218 } as const;
export const BOULEVARD = { y0: 210, y1: 214 } as const;
export const WEST_QUAY = { x0: 192, x1: QUAY_X } as const;   // muro de contención de la ribera oeste
export const EAST_RING = { x0: 270, x1: 276 } as const;      // calle que bordea la ribera este; x0 múltiplo de CELL (clasifica terreno)
export const CITY_EDGE = { west: -54, north: 158, south: 324 } as const; // selva más allá; south múltiplo de CELL (clasifica terreno)
export const DISTRICT_BANK_Y = 264; // ribera este del distrito desde acá; múltiplo de CELL (clasifica terreno)
export const MALECON_STREET_X = 336; // calle del malecón; múltiplo de CELL (clasifica terreno)

export const PLAZA: Rect = { x: 102, y: 218, w: 54, d: 18 }; // une dos columnas de la fila sur de la avenida
export const TOWER: Rect = { x: 121, y: 220, w: 16, d: 14 }; // centrada en (129, 227)
export const BRIDGE = { x0: 192, x1: 276, y0: 207, y1: 217, z: 1.2, deckH: 0.6 } as const;
export const MALECON = { x0: 334, x1: 344, y0: 158, y1: 326, z: 0.6 } as const;
export const COLLAPSED: Rect = { x: 280, y: 242, w: 24, d: 18 }; // el estuario ya llega a x ≈ 281 en y 260
/** El cuarto bloque del derrumbe, caído en la calle frente al malecón: lo dibuja `collapsed()` y los autos lo esquivan. */
export const FALLEN_BLOCK: Rect = { x: MALECON.x0 - 8, y: 237.5, w: 6, d: 3 };
export const CRATERS: readonly { x: number; y: number; r: number }[] = [{ x: 60, y: 185, r: 5 }, { x: 150, y: 239, r: 6 }, { x: 307, y: 224, r: 5 }];

/** Inversa de estuaryEast al sur de la costura: a qué y la ribera este llega a x (menor que ZONE_SPLIT_Y si nunca lo alcanza al norte). */
export const estuaryReaches = (x: number): number => ZONE_SPLIT_Y + (x - eastBank(SEAM_CY)) / ESTUARY_FLARE;

export type BlockKind = "block" | "plaza" | "collapsed" | "district" | "site";
export interface Block extends Rect { bank: "west" | "east"; row: number; kind: BlockKind }

export function blocks(): Block[] {
  const out: Block[] = [];
  const isDistrict = (x: number, y: number) => (DISTRICT_COLS as readonly number[]).includes(x) || (DISTRICT_ROWS as readonly number[]).includes(y);
  ROWS.forEach((y, row) => {
    for (const x of WEST_COLS) {
      if (y === PLAZA.y && x >= PLAZA.x && x < PLAZA.x + PLAZA.w) continue; // la plaza une esas dos
      const kind: BlockKind = x === SITE.x && y === SITE.y ? "site" : isDistrict(x, y) ? "district" : "block";
      out.push({ x, y, w: BLOCK_W, d: BLOCK_D, bank: "west", row, kind });
    }
    if (y >= DISTRICT_ROWS[0]) return; // al sur de la avenida vieja la ribera este es selva y malecón
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
