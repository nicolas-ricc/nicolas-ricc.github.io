import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { BLEED, CELL, CELL_BLEED, WORLD, worldZoneAt, type WorldZone } from "../map/geo";

/** Alpha del velo (color cielo) sobre una zona no enfocada. */
export const VEIL_ALPHA = 0.45;
/** Alpha de los acentos (luces) de una zona no enfocada. */
export const ACCENT_DIM = 0.35;
export const WORLD_ZONES: readonly WorldZone[] = ["portfolio", "cv", "blog"];

export interface VeilCell { zone: WorldZone; x: number; y: number; size: number }

const CORNERS = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;

/**
 * Celdas de contenido + sangrado, cada una en una sola zona: 18 u donde las
 * cuatro esquinas y el centro coinciden en zona, 6 u (clasificadas por su
 * centro) donde no. Es la misma verdad que el hit test (worldZoneAt).
 */
export function veilCells(): VeilCell[] {
  const x0 = WORLD.x0 - BLEED.x, y0 = WORLD.y0 - BLEED.y, x1 = WORLD.x1 + BLEED.x, y1 = WORLD.y1 + BLEED.y;
  const out: VeilCell[] = [];
  for (let y = y0; y < y1; y += CELL_BLEED) for (let x = x0; x < x1; x += CELL_BLEED) {
    const zone = worldZoneAt(x + CELL_BLEED / 2, y + CELL_BLEED / 2);
    const uniform = CORNERS.every(([i, j]) => worldZoneAt(x + i * CELL_BLEED, y + j * CELL_BLEED) === zone);
    if (uniform) { out.push({ zone, x, y, size: CELL_BLEED }); continue; }
    for (let sy = y; sy < y + CELL_BLEED; sy += CELL) for (let sx = x; sx < x + CELL_BLEED; sx += CELL)
      out.push({ zone: worldZoneAt(sx + CELL / 2, sy + CELL / 2), x: sx, y: sy, size: CELL });
  }
  return out;
}

export interface VeilRun { zone: WorldZone; x0: number; x1: number; y: number; h: number }

/**
 * Funde en tiras las celdas de una misma fila (mismo y), mismo tamaño y misma
 * zona contiguas en x: una fila uniforme de sangrado (por ejemplo Portfolio)
 * pasa de ~70 celdas a una sola tira. No cambia la cobertura, sólo el número
 * de cuadriláteros que hay que proyectar y dibujar.
 */
export function veilRuns(): VeilRun[] {
  const byRow = new Map<string, VeilCell[]>();
  for (const c of veilCells()) {
    const key = `${c.y}|${c.size}`;
    const row = byRow.get(key);
    if (row) row.push(c); else byRow.set(key, [c]);
  }
  const out: VeilRun[] = [];
  for (const row of byRow.values()) {
    row.sort((a, b) => a.x - b.x);
    let run: VeilRun | null = null;
    for (const c of row) {
      if (run && run.zone === c.zone && run.x1 === c.x) { run.x1 = c.x + c.size; continue; }
      if (run) out.push(run);
      run = { zone: c.zone, x0: c.x, x1: c.x + c.size, y: c.y, h: c.size };
    }
    if (run) out.push(run);
  }
  return out;
}

/** Cada tira como cuadrilátero proyectado a z 0, agrupado por zona. Las tiras no se solapan: una Graphics por zona con alpha global no oscurece dos veces. */
export function veilPolygons(): Record<WorldZone, number[][]> {
  const polys: Record<WorldZone, number[][]> = { portfolio: [], cv: [], blog: [] };
  for (const r of veilRuns()) {
    const pts: number[] = [];
    for (const [x, y] of [[r.x0, r.y], [r.x1, r.y], [r.x1, r.y + r.h], [r.x0, r.y + r.h]] as const) { const p = project(v3(x, y, 0)); pts.push(p.x, p.y); }
    polys[r.zone].push(pts);
  }
  return polys;
}

export interface FocusAlphas { veil: number; accents: number }

/** Objetivos de alpha por zona para un foco (hover o zona activa): las otras dos se velan y apagan sus luces. */
export function focusAlphas(focus: WorldZone | null): Record<WorldZone, FocusAlphas> {
  const out = {} as Record<WorldZone, FocusAlphas>;
  for (const z of WORLD_ZONES) {
    const dim = focus !== null && focus !== z;
    out[z] = { veil: dim ? VEIL_ALPHA : 0, accents: dim ? ACCENT_DIM : 1 };
  }
  return out;
}

/** Zona de un acento por geografía: la posición del punto o el primer vértice del polígono. */
export function accentZone(a: Accent): WorldZone {
  const p = a.kind === "dot" ? a.at : a.pts[0]!;
  return worldZoneAt(p.x, p.y);
}

/**
 * Reparte luces por zona del velo: cada una con la zona donde está parada
 * (`accentZone`), salvo que la capa declare una zona (luces montadas en un
 * barco, que se velan enteras con la zona del barco).
 */
export function accentsByZone(accents: readonly Accent[], zone?: WorldZone): Record<WorldZone, Accent[]> {
  const out: Record<WorldZone, Accent[]> = { portfolio: [], cv: [], blog: [] };
  for (const a of accents) out[zone ?? accentZone(a)].push(a);
  return out;
}
