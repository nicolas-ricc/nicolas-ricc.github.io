import { facadeWindows, type Facade } from "../iso/facade";
import { visibleWalls, type Solid } from "../iso/solids";
import type { Piece } from "./types";

/** Tope de altura sobre `lot.z` de una receta común y de una `landmark`. */
export const RECIPE_MAX_H = 18;
export const LANDMARK_MAX_H = 24;

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
