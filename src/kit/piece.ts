import { v3, type Vec3 } from "../iso/geometry";
import { facadeWindows, type Facade } from "../iso/facade";
import { bounds, visibleWalls, type Solid } from "../iso/solids";
import type { Lot, Piece, Slot, Style } from "./types";

/** Tope de altura sobre `lot.z` de una receta común y de una `landmark`. */
export const RECIPE_MAX_H = 18;
export const LANDMARK_MAX_H = 24;
/** Altura desde la que una torre lleva cartel en la cara sur. */
export const SIGN_MIN_H = 12;

/** Tope de altura de una receta común en este lote. */
export const recipeCap = (lot: Lot): number => Math.min(lot.maxH, RECIPE_MAX_H);
/** Pisos de un cuerpo de alto `h` con la altura de piso del estilo; al menos uno. */
export const floorsFor = (h: number, style: Style): number => Math.max(1, Math.round(h / style.floorH));

export const emptyPiece = (): Piece => ({ solids: [], ground: [], accents: [], windows: [], slots: [], walls: [] });

/** Suma un edificio con fachada `f` y publica sus paredes y ventanas que miran a la cámara (normal con x > 0 o y > 0). */
export function addBuilding(p: Piece, s: Solid, f: Facade): void {
  const building = p.solids.push(s) - 1;
  for (const w of visibleWalls(s)) {
    if (w.normal.x <= 1e-9 && w.normal.y <= 1e-9) continue;
    p.walls.push({ pts: w.pts, normal: w.normal, floorH: (w.pts[2]!.z - w.pts[0]!.z) / f.floors, building });
    for (const win of facadeWindows(w, f)) p.windows.push({ ...win, wall: w.normal, building });
  }
}

/** Hueco del cartel de neón en la cara sur, a media altura: 1.6 de alto, 1 de margen a cada lado, 0.4 delante de la pared. */
export function southSign(x: number, southY: number, w: number, z0: number): Slot {
  const y = southY + 0.4, z1 = z0 + 1.6;
  return { pts: [v3(x + 1, y, z0), v3(x + w - 1, y, z0), v3(x + w - 1, y, z1), v3(x + 1, y, z1)], wall: v3(0, 1, 0), side: "s", kind: "sign", local: 0 };
}

/** Tono desplazado `k` y recortado al rango de `Solid.tone` (−2..+2). */
export const shiftTone = (t: number, k: number): number => Math.max(-2, Math.min(2, t + k));

/**
 * Si la pieza pasa el tope `min(lot.maxH, LANDMARK_MAX_H)`, la achata en z
 * (relativa a `lot.z`) para que entre justa: un landmark de medidas fijas
 * respeta así una manzana topada. Las normales no cambian.
 */
export function fitToCap(p: Piece, lot: Lot): Piece {
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H);
  const top = Math.max(...[...p.solids, ...p.ground].map((s) => bounds(s).max.z)) - lot.z;
  if (top <= cap) return p;
  const k = cap / top, z = (n: number): number => lot.z + (n - lot.z) * k, P = (q: Vec3): Vec3 => v3(q.x, q.y, z(q.z));
  const solid = (s: Solid): Solid => {
    switch (s.kind) {
      case "poly": return { ...s, z: z(s.z), h: s.h * k };
      case "strip": return { ...s, z: z(s.z) };
      case "ground": return { ...s, tris: s.tris.map((t) => ({ ...t, pts: [P(t.pts[0]), P(t.pts[1]), P(t.pts[2])] })) };
      case "wheel": return { ...s, at: P(s.at) };
      default: return { ...s, at: P(s.at), h: s.h * k };
    }
  };
  return {
    ...p,
    solids: p.solids.map(solid),
    ground: p.ground.map(solid),
    accents: p.accents.map((a) => (a.kind === "dot" ? { ...a, at: P(a.at) } : { ...a, pts: a.pts.map(P) })),
    windows: p.windows.map((w) => ({ ...w, pts: w.pts.map(P) })),
    walls: p.walls.map((w) => ({ ...w, pts: w.pts.map(P), floorH: w.floorH * k })),
    slots: p.slots.map((s) => ({ ...s, pts: s.pts.map(P) })),
    ...(p.landmarkTop ? { landmarkTop: P(p.landmarkTop) } : {}),
  };
}
