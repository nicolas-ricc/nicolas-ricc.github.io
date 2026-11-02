import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { BLEED, CELL, CELL_BLEED, WORLD, worldZoneAt, type WorldZone } from "../map/geo";

/** Alpha of the veil (sky color) over an unfocused zone. */
export const VEIL_ALPHA = 0.45;
/** Alpha of the accents (lights) of an unfocused zone. */
export const ACCENT_DIM = 0.35;
export const WORLD_ZONES: readonly WorldZone[] = ["portfolio", "cv", "blog"];

export interface VeilCell { zone: WorldZone; x: number; y: number; size: number }

const CORNERS = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;

/**
 * Cells of content + bleed, each in a single zone: 18 u where the
 * four corners and the center agree on the zone, 6 u (classified by their
 * center) where they do not. It is the same truth as the hit test (worldZoneAt).
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
 * Merges into strips the cells of one row (same y), same size and same
 * zone that are contiguous in x: a uniform row of bleed (for example Portfolio)
 * goes from ~70 cells to a single strip. It does not change the coverage, only the number
 * of quadrilaterals to project and draw.
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

/** Each strip as a quadrilateral projected at z 0, grouped by zone. The strips do not overlap: one Graphics per zone with a global alpha does not darken twice. */
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

/** Alpha targets per zone for a focus (hover or active zone): the other two are veiled and have their lights dimmed. */
export function focusAlphas(focus: WorldZone | null): Record<WorldZone, FocusAlphas> {
  const out = {} as Record<WorldZone, FocusAlphas>;
  for (const z of WORLD_ZONES) {
    const dim = focus !== null && focus !== z;
    out[z] = { veil: dim ? VEIL_ALPHA : 0, accents: dim ? ACCENT_DIM : 1 };
  }
  return out;
}

/** Zone of an accent by geography: the position of the point or the first vertex of the polygon. */
export function accentZone(a: Accent): WorldZone {
  const p = a.kind === "dot" ? a.at : a.pts[0]!;
  return worldZoneAt(p.x, p.y);
}

/**
 * Splits lights by veil zone: each one with the zone it stands in
 * (`accentZone`), unless the layer declares a zone (lights mounted on a
 * ship, which are veiled entirely with the ship's zone).
 */
export function accentsByZone(accents: readonly Accent[], zone?: WorldZone): Record<WorldZone, Accent[]> {
  const out: Record<WorldZone, Accent[]> = { portfolio: [], cv: [], blog: [] };
  for (const a of accents) out[zone ?? accentZone(a)].push(a);
  return out;
}
