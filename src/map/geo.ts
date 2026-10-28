/**
 * Geografía del mundo: río, bahía, punta, cortes de zona, sangrado y cover.
 */
export const RIVER_HALF = 7;

/** Centro x del río para cada y: curva suave determinística, corre de arriba a abajo. */
export function riverCenter(y: number): number {
  return Math.round(250 + 26 * Math.sin(y / 38) + 14 * Math.sin(y / 17 + 1.3));
}

// ---------------------------------------------------------------- mundo isométrico

/**
 * Contenido del mundo iso: las tres zonas. Origen negativo porque la fábrica
 * (norte y oeste del astillero) y el distrito (oeste y sur de la ciudad)
 * crecieron hacia afuera sin mover lo ya hecho. Lados múltiplos de 18 para que
 * la grilla del sangrado (CELL_BLEED) comparta vértices con la del contenido.
 */
export const WORLD = { x0: -60, y0: -60, x1: 570, y1: 336 } as const;
/**
 * Sangrado: terreno de relleno alrededor del contenido, para que la cámara
 * cover del sitio no muestre cielo. Múltiplos de CELL_BLEED. El contenido +
 * sangrado proyecta como un paralelogramo (rombo solo si Wx = Wy), así que el
 * rectángulo inscripto más grande queda acotado por el lado corto (y):
 * Wy = 396 + 2·378 = 1152, ≥ 1128 que necesita la caja del contenido con la
 * torre, que no está centrada (FRAME_H levanta solo la esquina NO).
 */
export const BLEED = { x: 342, y: 378 } as const;
export const CELL_BLEED = 18;
export const COVER_INSET = 3; // el borde del terreno está a z −1 (agua) o 0.6 ± 0.8 (selva), ±1.4 px respecto del paralelogramo a z 0

/**
 * Rectángulo de pantalla de aspecto `aspect` inscripto en el terreno con
 * sangrado proyectado (`sx = x − y`, `sy = (x + y)/2`), devuelto como sus
 * cuatro esquinas en coordenadas de mundo a z 0: lo que la cámara cover del
 * sitio podrá mostrar sin cielo. Un rectángulo Wx×Wy se proyecta como
 * paralelogramo de lados con pendiente ±1/2 (rombo solo si Wx = Wy); el
 * rectángulo inscripto más grande cumple h + w/2 = min(Wx, Wy), se centra en
 * x y queda apoyado en el borde inferior del rango factible. Se retrae
 * `inset` hacia el centro para no exponer cielo donde es tangente al borde.
 */
export function coverQuad(aspect: number, inset = COVER_INSET): [number, number][] {
  const x0 = WORLD.x0 - BLEED.x, y0 = WORLD.y0 - BLEED.y, x1 = WORLD.x1 + BLEED.x, y1 = WORLD.y1 + BLEED.y;
  const wx = x1 - x0, wy = y1 - y0;
  const h = (2 * Math.min(wx, wy)) / (aspect + 2), w = aspect * h;
  const topX = x0 - y0, topY = (x0 + y0) / 2;
  const u0 = topX + (wx - wy) / 2 - w / 2, v0 = topY + Math.abs(wx - wy) / 4 + w / 4;
  const h2 = h - 2 * inset, w2 = aspect * h2, u = u0 + (w - w2) / 2, v = v0 + inset;
  const world = (sx: number, sy: number): [number, number] => [sx / 2 + sy, sy - sx / 2];
  return [world(u, v), world(u + w2, v), world(u + w2, v + h2), world(u, v + h2)];
}

/** El punto cae dentro del cuadrilátero del cover (ensanchado `margin` unidades hacia afuera en cada eje de pantalla). */
export function inCoverQuad(x: number, y: number, aspect = 16 / 9, margin = 0): boolean {
  return pointInPolygon(x, y, coverQuad(aspect, COVER_INSET - margin).flat());
}
/** Blog es todo lo que está al este de ZONE_SPLIT_X (visualmente); Resume, lo que está al sur de ZONE_SPLIT_Y del lado oeste. */
export const ZONE_SPLIT_X = 344;
export const ZONE_SPLIT_Y = 146;
/** Agua clara a esta distancia de la tierra. */
export const SHORE_W = 12;
const SHORE_WOBBLE = 5;
/** Ancho de la orilla frente a la costa del corte x = 344, ondulado y determinístico. Mínimo 5. */
export const shoreWidth = (y: number): number => SHORE_W + SHORE_WOBBLE * Math.sin(y / 11) + 2 * Math.sin(y / 4.3);
/** x donde empieza la fosa (agua profunda): talud diagonal NE-SO que se abre hacia el este. */
export const abyssX = (y: number): number => 392 + 0.25 * (y + 60) + 6 * Math.sin(y / 17);

export type WorldZone = "portfolio" | "cv" | "blog";

/**
 * Zona clickeable (hover y click del sitio), por geografía y no por corte:
 * la punta, el arrecife y su orilla son Portfolio (el faro remata el
 * astillero), la orilla del malecón es Resume y Blog es solo el mar abierto.
 * El terreno visual (terrain.ts) no usa esto para clasificar el mar.
 */
export function worldZoneAt(x: number, y: number): WorldZone {
  if (inHeadland(x, y) || distToHeadland(x, y) < SHORE_W) return "portfolio";
  if (x < ZONE_SPLIT_X + shoreWidth(y)) return y >= ZONE_SPLIT_Y ? "cv" : "portfolio";
  return "blog";
}

/**
 * Desembocadura: al norte de la costa de la isla (northCoastY), todo lo que
 * hay al este de la orilla oeste del río es una bahía que abre al mar. Es la
 * única salida de los barcos.
 */
export function inMouth(x: number, y: number): boolean {
  return y < northCoastY(x) && x >= riverCenter(y) - RIVER_HALF;
}

/** Latitud de referencia de la boca (la usan el exhibit darsena y los tests); la costa real es northCoastY. */
export const MOUTH_Y = 24;

/** Punta del faro: nace en el muelle de alistamiento (x 330..344) y se adelgaza hasta x = 400. Sentido horario. */
export const HEADLAND: readonly [number, number][] = [
  [330, 100], [344, 97], [372, 104], [400, 114], [400, 122], [372, 132], [344, 134], [330, 130],
];
const HEADLAND_FLAT = HEADLAND.flat();

export function inHeadland(x: number, y: number): boolean {
  return pointInPolygon(x, y, HEADLAND_FLAT);
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Distancia al borde de la punta; 0 adentro. Para clasificar arrecife y orilla. */
export function distToHeadland(x: number, y: number): number {
  if (inHeadland(x, y)) return 0;
  let best = Infinity;
  for (let i = 0; i < HEADLAND.length; i++) {
    const [ax, ay] = HEADLAND[i]!, [bx, by] = HEADLAND[(i + 1) % HEADLAND.length]!;
    best = Math.min(best, distToSegment(x, y, ax, ay, bx, by));
  }
  return best;
}

export function pointInPolygon(x: number, y: number, polygon: number[]): boolean {
  let inside = false;
  const n = polygon.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i * 2]!, yi = polygon[i * 2 + 1]!;
    const xj = polygon[j * 2]!, yj = polygon[j * 2 + 1]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- astillero (lo comparte el terreno)

/** Lado de la grilla de terreno. Vive acá para que city-grid.ts y terrain.ts lo compartan sin importarse. */
export const CELL = 6;
// Ruling del controller: 198 (no 200) porque es múltiplo de CELL = 6; con 200
// la celda 198..204 tiene centro 201 (agua) pero vértices en x=198, rompiendo
// la propiedad "todo el agua tiene x >= QUAY_X".
export const QUAY_X = 198, QUAY_W = 4;
export const BOTTOM = 142;
export const DOCK = { x: 120, y: 6, w: 72, d: 24, depth: 6 } as const; // alineado a CELL
export const eastBank = (y: number): number => riverCenter(y) + RIVER_HALF;

// ---------------------------------------------------------------- costa de la isla (única fuente de verdad)
// Va al final: usa CELL y eastBank, declarados arriba.

const bump = (v: number, c: number, s: number): number => Math.exp(-(((v - c) / s) ** 2));
const ramp = (v: number, a: number, b: number): number => Math.min(1, Math.max(0, (v - a) / (b - a)));

/**
 * Costa norte: la isla es tierra donde y ≥ northCoastY(x). Vale para todo x;
 * punta al NE (x 344), caleta al NO (x 286) y, al este de x 350, la costa dobla al sur.
 */
export function northCoastY(x: number): number {
  return 17 - 10 * bump(x, 344, 11) + 13 * bump(x, 286, 8)
    + 2.2 * Math.sin(x / 2.3 + 0.7) + 1.4 * Math.sin(x / 5.1 + 2)
    + Math.max(0, x - 350) ** 2 / 6;
}

/**
 * Ruling de la parte 1: el estuario hereda el ancho del canal del astillero en
 * la última fila de celdas antes de la costura (centro y = 141) y se abre
 * hacia el sur, en vez de seguir el meandro de riverCenter.
 */
export const SEAM_CY = Math.floor(ZONE_SPLIT_Y / CELL) * CELL - CELL / 2;
export const ESTUARY_FLARE = 0.35; // cuánto se abre la ribera este por unidad hacia el sur
export const estuaryEast = (y: number): number => eastBank(SEAM_CY) + Math.max(0, y - ZONE_SPLIT_Y) * ESTUARY_FLARE;

/** Cuánto entra la tierra de la isla sobre el agua del estuario, en [0, 10]; 0 al norte de y 152 (costura), en y 196..222 (puente) y en y 238..262 (manzana derrumbada). */
export function estuaryInset(y: number): number {
  const env = ramp(y, 152, 160) * (1 - ramp(y, 188, 196)) + ramp(y, 222, 226) * (1 - ramp(y, 234, 238)) + ramp(y, 262, 266);
  return env * (6 + 2.5 * Math.sin(y / 7.6 + 0.4) + 1.5 * Math.sin(y / 2.5 + 1.1));
}

/** Costa oeste de la isla en su mitad sur (y ≥ 146): hasta acá llega el agua del estuario. */
export const islandWestX = (y: number): number => estuaryEast(y) - estuaryInset(y);

/**
 * Costa este: la isla es tierra donde x < islandEastX(y). Ondulada al norte de
 * y 158, recta (malecón) entre 158 y WORLD.y1 y punta sur redondeada más allá
 * (-Infinity desde y 380: todo agua).
 * - Al norte de 146 oscila entre `lo` y `hi`: `lo` = 331 deja 3 u de pie a
 *   galpones (x ≤ 324) y chatarra (x ≤ 329); entre y 134 (base de la punta del
 *   faro) y 146 (costura de zonas) sube a 344, y `hi` = 344 + shoreWidth − 1.5
 *   no deja tierra que clickee Blog (`worldZoneAt`).
 * - Entre 146 y 158 (arranque del malecón) se interpola a 344.
 * - Punta sur: elipse de 44 u de largo desde WORLD.y1 sobre el ancho de la
 *   lengua en la costura, achicada a 0.86 ± 0.12 por dos senos (29 u y 13 u) y
 *   con una punta menor en y 356.
 */
export function islandEastX(y: number): number {
  if (y >= 158 && y <= WORLD.y1) return ZONE_SPLIT_X;
  if (y > WORLD.y1) {
    const s = (y - WORLD.y1) / 44;
    if (s >= 1) return -Infinity;
    const ancho = (ZONE_SPLIT_X - estuaryEast(WORLD.y1)) * Math.sqrt(1 - s * s)
      * (0.86 + 0.07 * Math.sin(y / 4.7) + 0.05 * Math.sin(y / 2.1 + 1)) + 4 * bump(y, 356, 4);
    return islandWestX(y) + ancho;
  }
  const lo = y < 134 ? 331 : Math.min(ZONE_SPLIT_X, 331 + ((y - 134) * (ZONE_SPLIT_X - 331)) / 12);
  const hi = ZONE_SPLIT_X + shoreWidth(y) - 1.5;
  const t = 0.5 + 0.3 * Math.sin(y / 8.3 + 0.9) + 0.17 * Math.sin(y / 2.4 + 0.3);
  const v = lo + (hi - lo) * t;
  return y < 146 ? v : v + ((ZONE_SPLIT_X - v) * (y - 146)) / 12;
}

/** Caja de la punta sur que el sangrado dibuja en celdas de 6 u (múltiplos de la grilla del sangrado, anclada en (−402, −438)). */
export const TIP_BOX = { x0: 264, y0: 336, x1: 372, y1: 408 } as const;
