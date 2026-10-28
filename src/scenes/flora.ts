import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";

/** Área de siembra en coordenadas de mundo (no confundir con `city-grid.Rect`, que es x/y/w/d). */
export interface Area { x0: number; x1: number; y0: number; y1: number }

/** Vías E-O que la selva no puede pisar: un cono se descarta si su copa toca la franja `y ± RAIL_CLEAR`. */
export interface Rails {
  y: readonly number[];
  /**
   * Caja en planta del tren (x hasta el frente `x1`, y `y0..y1`, z 0..5.7). Un
   * cono se descarta si ningún eje del SAT lo separa de la caja en pantalla:
   * `p = y − 1.4z` contra `y1 + 0.3`, `sx = x − y` contra `x1 − y0` y
   * `q = x − 1.4z` contra `x1` (con r y h de la copa); basta con que uno
   * separe para que quede. Solo vale al sur de las vías (`y` mayor): las
   * capas animadas se pintan encima de lo estático, así que lo que está al
   * norte queda detrás del tren y no lo tapa. Pide al menos una vía en `y`:
   * sin vías todo cuenta como sur.
   */
  train?: { y0: number; y1: number; x1: number };
}
const RAIL_CLEAR = 1.5;

/**
 * Selva compartida por todas las zonas: `n` conos con r 2..4 y h 5..9, 60 % en
 * `leaf` y el resto en `leafDark`, con la base a `z`. El orden de llamadas al
 * rng (material, x, y, r, h) es el que tenía shipyard.ts: no cambia su salida.
 * Con `rails`, los conos que caerían sobre esas vías se descartan (el rng ya
 * los consumió: la siembra restante no se mueve). Con `rails.train`, también
 * los que taparían el tren desde el sur.
 */
export function jungle(out: Solid[], rng: Rng, area: Area, n: number, z = 0.4, rails?: Rails): void {
  for (let i = 0; i < n; i++) {
    const mat = rng.chance(0.6) ? "leaf" : "leafDark";
    const cone: Solid = { kind: "cone", at: v3(rng.int(area.x0, area.x1), rng.int(area.y0, area.y1), z), r: rng.int(2, 4), h: rng.int(5, 9), mat };
    if (rails && rails.y.some((ry) => Math.abs(cone.at.y - ry) < cone.r + RAIL_CLEAR)) continue;
    const t = rails?.train;
    if (rails && t && cone.at.y > Math.max(...rails.y)) {
      const { at, r, h } = cone;
      if (at.y - r - 1.4 * (at.z + h) < t.y1 + 0.3
        && at.x - r - (at.y + r) < t.x1 - t.y0
        && at.x - r - 1.4 * (at.z + h) < t.x1) continue;
    }
    out.push(cone);
  }
}
