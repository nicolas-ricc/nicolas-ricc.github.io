import { WORLD } from "../map/geo";
import type { Rng } from "../map/seed";
import { ROWS, type Rect } from "./city-grid";
import type { SprawlBlock } from "./sprawl-grid";

/** Zonificación del distrito tecnológico: decide el tipo de cada manzana en un pre-pase, antes de construir nada. */
export type Kind = "tower" | "campus" | "monoblock" | "casas" | "park" | "plaza" | "escuela" | "club" | "telecom" | "arena" | "auditorium";

/** Radios de distancia: torres hasta `TOWER_D`, monoblocks y campus hasta `MONOBLOCK_D`, casas después. */
export const TOWER_D = 60, MONOBLOCK_D = 130;
/** Hitos fijos del distrito. */
export const TELECOM = { x: -114, y: 242 } as const;
export const ARENA = { x: 102, y: 448 } as const;
export const AUDITORIUM = { x: 12, y: 352 } as const;
/** Manzanas fijas del barrio: escuela, club y dos plazas. */
export const SCHOOL = { x: 102, y: 520 } as const, CLUB = { x: 132, y: 544 } as const;
export const PLAZAS = [{ x: 132, y: 496 }, { x: 72, y: 472 }] as const;

/** ¿La manzana es del barrio costero (al sur del mundo y fuera del radio de torres)? */
export const inBarrio = (b: SprawlBlock): boolean => b.y > WORLD.y1 && b.dist >= TOWER_D;
/** Paridad de tablero de la manzana: vecinas inmediatas alternan 0/1. */
export const blockParity = (b: Rect): 0 | 1 => ((Math.round((b.x + 84) / 30) + rowStep(b.y)) & 1) as 0 | 1;
/** Paso de fila: cada 24 desde 328 al sur; en las filas de la ciudad (`ROWS`, con pasos de 24 y 30) cuenta filas hacia atrás desde 328, así el damero también alterna ahí (con `(y − 328) / 24`, 242 y 272 caían en la misma paridad). */
const rowStep = (y: number): number => { const k = ROWS.indexOf(y as (typeof ROWS)[number]); return y < 328 && k >= 0 ? k - ROWS.length : Math.round((y - 328) / 24); };

const is = (b: SprawlBlock, p: { x: number; y: number }): boolean => b.x === p.x && b.y === p.y;

/** Un tipo por manzana, en el orden recibido; los fijos no consumen rng, el resto una sola tirada `chance(0.12)`. */
export function zoneKinds(rng: Rng, blocks: readonly SprawlBlock[]): Kind[] {
  return blocks.map((b): Kind => {
    if (is(b, TELECOM)) return "telecom";
    if (is(b, ARENA)) return "arena";
    if (is(b, AUDITORIUM)) return "auditorium";
    if (is(b, SCHOOL)) return "escuela";
    if (is(b, CLUB)) return "club";
    if (PLAZAS.some((p) => is(b, p))) return "plaza";
    if (rng.chance(0.12)) return inBarrio(b) ? "plaza" : "park";
    if (b.dist < TOWER_D) return "tower";
    if (b.dist < MONOBLOCK_D) return blockParity(b) === 0 ? "monoblock" : "campus";
    return "casas";
  });
}
