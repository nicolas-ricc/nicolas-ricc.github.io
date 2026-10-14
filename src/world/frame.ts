import type { Graphics } from "pixi.js";
import { accentItem, type Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import type { Layer, RenderItem } from "../iso/render-list";
import { WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, coverQuad, type WorldZone } from "../map/geo";

const FRAME_H = 30; // alto de referencia para que entren los landmarks

export type Frame = WorldZone | "all" | "cover";

/** Caja de una zona (o del mundo) proyectada, como un RenderItem para fitTransform. `cover` es el rectángulo 16:9 inscripto en el rombo del sangrado. */
export function zoneFrame(frame: Frame): RenderItem[] {
  if (frame === "cover") return coverFrame(16 / 9);
  const box = {
    all: [WORLD.x0, WORLD.y0, WORLD.x1, WORLD.y1],
    portfolio: [WORLD.x0, WORLD.y0, ZONE_SPLIT_X, ZONE_SPLIT_Y],
    cv: [WORLD.x0, ZONE_SPLIT_Y, ZONE_SPLIT_X, WORLD.y1],
    blog: [ZONE_SPLIT_X, WORLD.y0, WORLD.x1, WORLD.y1],
  }[frame];
  const [x0, y0, x1, y1] = box as [number, number, number, number];
  const pts: number[] = [];
  for (const [x, y, z] of [[x0, y0, FRAME_H], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]] as const) { const p = project(v3(x, y, z)); pts.push(p.x, p.y); }
  return [{ layer: "ground", pts, color: 0 }];
}

/** Rectángulo cover 16:9 (`coverQuad` de geo.ts) proyectado, como RenderItem para fitTransform. */
export function coverFrame(aspect: number): RenderItem[] {
  const pts = coverQuad(aspect).flatMap(([x, y]) => { const p = project(v3(x, y, 0)); return [p.x, p.y]; });
  return [{ layer: "ground", pts, color: 0 }];
}

export interface Fit { x: number; y: number; scale: number }

/** Escala y desplazamiento para que todos los puntos entren en width×height con un margen relativo. */
export function fitTransform(items: RenderItem[], width: number, height: number, margin = 0.04): Fit {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) for (let i = 0; i < it.pts.length; i += 2) {
    minX = Math.min(minX, it.pts[i]!); maxX = Math.max(maxX, it.pts[i]!);
    minY = Math.min(minY, it.pts[i + 1]!); maxY = Math.max(maxY, it.pts[i + 1]!);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, scale: 1 };
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const scale = Math.min((width * (1 - 2 * margin)) / w, (height * (1 - 2 * margin)) / h);
  return { x: (width - w * scale) / 2 - minX * scale, y: (height - h * scale) / 2 - minY * scale, scale };
}

export function drawLayer(g: Graphics, items: RenderItem[], layer: Layer): void {
  g.clear();
  for (const it of items) if (it.layer === layer) g.poly(it.pts, true).fill(it.color);
}

/** Discos translúcidos alrededor de cada luz `dot`: radio `r × k`, alpha propia. */
export type HaloStyle = readonly { k: number; alpha: number }[];

export const HALO_BASE: HaloStyle = [{ k: 2.2, alpha: 0.18 }];
/** Sin filtro de bloom: un segundo disco más grande y más tenue hace de resplandor barato. */
export const HALO_FALLBACK: HaloStyle = [...HALO_BASE, { k: 4.5, alpha: 0.1 }];

export function drawAccents(g: Graphics, accents: Accent[], halo: HaloStyle = HALO_BASE): void {
  g.clear();
  for (const a of accents) {
    const it = accentItem(a);
    if (it.kind === "dot") {
      for (const h of halo) g.circle(it.x, it.y, it.r * h.k).fill({ color: it.color, alpha: h.alpha });
      g.circle(it.x, it.y, it.r).fill(it.color);
    } else {
      g.poly(it.pts, true).fill({ color: it.color, alpha: it.alpha });
    }
  }
}
