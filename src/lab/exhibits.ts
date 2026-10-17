import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import type { WorldZone } from "../map/geo";
import { TOWER, TOWER_H } from "../scenes/city-grid";
import { STACK_BASE_H, STACKS } from "../scenes/factory";
import { PUFF_LIFT, PUFF_RANGE } from "../scenes/factory-anim";
import { WHEEL } from "../scenes/fair";
import { LIGHTHOUSE } from "../scenes/sea";
import type { Box } from "../world/frame";

/** Una estructura para mirar sola: una caja sobre el mundo real o una pieza reubicable armada en el origen. */
export type Exhibit = { id: string; title: string; zone: WorldZone } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void }
);

const M = 3; // margen: veredas, faroles y sombras cortas

const stacksX = STACKS.map((s) => s.x), stacksY = STACKS.map((s) => s.y), stackR = Math.max(...STACKS.map((s) => s.r));
const stackTop = Math.max(...STACKS.map((s) => s.h)) + STACK_BASE_H;

export const ZONE_TITLE: Record<WorldZone, string> = { portfolio: "Portfolio", cv: "Resume", blog: "Blog" };

export const EXHIBITS: readonly Exhibit[] = [
  // el humo deriva al NNE hasta PUFF_RANGE: la caja se estira al norte para no cortar la columna
  { id: "chimeneas", title: "Chimeneas de la fábrica", zone: "portfolio", kind: "region",
    box: { x0: Math.min(...stacksX) - stackR - M, y0: Math.min(...stacksY) - stackR - PUFF_RANGE, x1: Math.max(...stacksX) + stackR + M + PUFF_RANGE / 2, y1: Math.max(...stacksY) + stackR + M },
    h: stackTop + PUFF_RANGE * PUFF_LIFT },
  { id: "noria", title: "Noria de la feria", zone: "portfolio", kind: "region",
    box: { x0: WHEEL.x - WHEEL.r - M, y0: WHEEL.y - WHEEL.r - M, x1: WHEEL.x + WHEEL.r + M, y1: WHEEL.y + WHEEL.r + M }, h: WHEEL.hub + WHEEL.r },
  { id: "torre", title: "Torre de la ciudad", zone: "cv", kind: "region",
    box: { x0: TOWER.x - M, y0: TOWER.y - M, x1: TOWER.x + TOWER.w + M, y1: TOWER.y + TOWER.d + M }, h: TOWER_H + 6 },
  { id: "faro", title: "Faro", zone: "blog", kind: "region",
    box: { x0: LIGHTHOUSE.x - 8, y0: LIGHTHOUSE.y - 8, x1: LIGHTHOUSE.x + 8, y1: LIGHTHOUSE.y + 8 }, h: LIGHTHOUSE.z + 32 },
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
  return list[(i + delta + list.length) % list.length]!;
}
