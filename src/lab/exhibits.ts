import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import type { WorldZone } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { campus, lamp } from "../scenes/city-pieces";
import { TOWER, TOWER_H } from "../scenes/city-grid";
import { STACK_BASE_H, STACKS } from "../scenes/factory";
import { PUFF_LIFT, PUFF_RANGE } from "../scenes/factory-anim";
import { WHEEL } from "../scenes/fair";
import { jungle } from "../scenes/flora";
import { towerCrane } from "../scenes/pieces";
import { DRUM_R0, LIGHTHOUSE } from "../scenes/sea";
import { ship, shipAt, type ShipKind } from "../scenes/ships";
import { SEED } from "../world/assemble";
import type { Box } from "../world/frame";

/** Una estructura para mirar sola: una caja sobre el mundo real o una pieza reubicable armada en el origen (con `pad` opcional: el material del suelo bajo ella). */
export type Exhibit = { id: string; title: string; zone: WorldZone } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void; pad?: Material }
);

const M = 3; // margen: veredas, faroles y sombras cortas

const stacksX = STACKS.map((s) => s.x), stacksY = STACKS.map((s) => s.y), stackR = Math.max(...STACKS.map((s) => s.r));
const stackTop = Math.max(...STACKS.map((s) => s.h)) + STACK_BASE_H;

// un barco con el punto medio de la unidad (empujador incluido) en el origen, a flote sobre agua
const vessel = (kind: ShipKind) => (out: Solid[], accents: Accent[]): void => {
  const { solids, lights } = ship(kind, shipAt(kind, { x: 0, y: 0 }, 0), 0);
  out.push(...solids); accents.push(...lights);
};

export const ZONE_TITLE: Record<WorldZone, string> = { portfolio: "Portfolio", cv: "Resume", blog: "Blog" };

export const EXHIBITS: readonly Exhibit[] = [
  // el humo deriva al NNE hasta PUFF_RANGE: la caja se estira al norte para no cortar la columna
  { id: "chimeneas", title: "Chimeneas de la fábrica", zone: "portfolio", kind: "region",
    box: { x0: Math.min(...stacksX) - stackR - M, y0: Math.min(...stacksY) - stackR - PUFF_RANGE, x1: Math.max(...stacksX) + stackR + M + PUFF_RANGE / 2, y1: Math.max(...stacksY) + stackR + M },
    h: stackTop + PUFF_RANGE * PUFF_LIFT },
  { id: "noria", title: "Noria de la feria", zone: "portfolio", kind: "region",
    box: { x0: WHEEL.x - WHEEL.r - M, y0: WHEEL.y - WHEEL.r - M, x1: WHEEL.x + WHEEL.r + M, y1: WHEEL.y + WHEEL.r + M }, h: WHEEL.hub + WHEEL.r },
  // pluma 24 al este y contrapluma 8 al oeste: con el mástil en x −8 queda en −16..16
  { id: "grua-torre", title: "Grúa torre", zone: "portfolio", kind: "piece",
    build: (out, accents) => towerCrane(out, accents, { at: { x: -8, y: 0 }, mastH: 20, jibLen: 24, dir: "e", light: "amber" }) },
  { id: "farol", title: "Farol", zone: "portfolio", kind: "piece", build: (out, accents) => { lamp(out, accents, -0.3, -0.3, 0); } },
  { id: "torre", title: "Torre de la ciudad", zone: "cv", kind: "region",
    box: { x0: TOWER.x - M, y0: TOWER.y - M, x1: TOWER.x + TOWER.w + M, y1: TOWER.y + TOWER.d + M }, h: TOWER_H + 6 },
  // patio 9×9 entre tres edificios de 6: 21×15; el suelo de la manzana va a `out` con los sólidos
  { id: "campus", title: "Campus", zone: "cv", kind: "piece",
    build: (out, accents) => campus(out, out, accents, createRng(SEED), { x: -12.5, y: -9.5, w: 25, d: 19 }, -10.5, -7.5, 21, 15) },
  { id: "selva", title: "Selva", zone: "cv", kind: "piece", build: (out) => jungle(out, createRng(SEED), { x0: -12, x1: 12, y0: -12, y1: 12 }, 14, 0) },
  { id: "faro", title: "Faro", zone: "blog", kind: "region",
    box: { x0: LIGHTHOUSE.x - DRUM_R0 - M, y0: LIGHTHOUSE.y - DRUM_R0 - M, x1: LIGHTHOUSE.x + DRUM_R0 + M, y1: LIGHTHOUSE.y + DRUM_R0 + M },
    h: LIGHTHOUSE.z + 32 }, // tambores + linterna + tapa (≈ 37)
  { id: "carguero", title: "Carguero", zone: "blog", kind: "piece", build: vessel("cargo"), pad: "water" },
  { id: "remolcador", title: "Remolcador", zone: "blog", kind: "piece", build: vessel("tug"), pad: "water" },
  { id: "convoy", title: "Convoy con barcaza", zone: "blog", kind: "piece", build: vessel("barge"), pad: "water" },
  { id: "lancha", title: "Lancha colectiva", zone: "blog", kind: "piece", build: vessel("ferry"), pad: "water" },
];

/** El exhibit del hash (`#id` o `id`); vacío o desconocido, el primero. */
export function pickExhibit(hash: string, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  let id: string;
  try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch { id = ""; } // %-escape roto: como desconocido
  return list.find((e) => e.id === id) ?? list[0]!;
}

/** Vecino en el orden del índice, dando la vuelta en los extremos. */
export function stepExhibit(id: string, delta: 1 | -1, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return list[0]!;
  return list[(i + delta + list.length) % list.length]!;
}
