import { v3, type Vec3 } from "../iso/geometry";
import { facadeWindows, type Facade } from "../iso/facade";
import { bounds, visibleWalls, type Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { PLINTH_H } from "../scenes/city-pieces";
import type { Lot, Piece, Recipe, Slot, Style } from "./types";

/** Height cap above `lot.z` for a common recipe and for a `landmark`. */
export const RECIPE_MAX_H = 18;
export const LANDMARK_MAX_H = 24;
/** Height from which a tower carries a sign on its south face. */
export const SIGN_MIN_H = 12;

/** Height cap of a common recipe on this lot. */
export const recipeCap = (lot: Lot): number => Math.min(lot.maxH, RECIPE_MAX_H);
/** Floors of a body of height `h` with the style's floor height; at least one. */
export const floorsFor = (h: number, style: Style): number => Math.max(1, Math.round(h / style.floorH));

export const emptyPiece = (): Piece => ({ solids: [], ground: [], accents: [], windows: [], slots: [], walls: [] });

/** Adds a building with facade `f` and publishes its walls and windows that face the camera (normal with x > 0 or y > 0). */
export function addBuilding(p: Piece, s: Solid, f: Facade): void {
  const building = p.solids.push(s) - 1;
  for (const w of visibleWalls(s)) {
    if (w.normal.x <= 1e-9 && w.normal.y <= 1e-9) continue;
    p.walls.push({ pts: w.pts, normal: w.normal, floorH: (w.pts[2]!.z - w.pts[0]!.z) / f.floors, building });
    for (const win of facadeWindows(w, f)) p.windows.push({ ...win, wall: w.normal, building });
  }
}

/** Slot of the neon sign on the south face, at mid height: 1.6 tall, 1 margin on each side, 0.4 in front of the wall. */
export function southSign(x: number, southY: number, w: number, z0: number): Slot {
  const y = southY + 0.4, z1 = z0 + 1.6;
  return { pts: [v3(x + 1, y, z0), v3(x + w - 1, y, z0), v3(x + w - 1, y, z1), v3(x + 1, y, z1)], wall: v3(0, 1, 0), side: "s", kind: "sign", shop: 0 };
}

/** Tone shifted by `k` and clamped to the range of `Solid.tone` (−2..+2). */
export const shiftTone = (t: number, k: number): number => Math.max(-2, Math.min(2, t + k));

/**
 * If the piece exceeds the cap `min(lot.maxH, LANDMARK_MAX_H)`, it flattens it in z
 * (relative to `lot.z`) so it fits exactly: a landmark of fixed dimensions
 * thus respects a capped block. Normals don't change, nor do the measures
 * that aren't heights (the radius of `wheel`, the sheer of `hull`).
 */
export function fitToCap(p: Piece, lot: Lot): Piece {
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H);
  const top = Math.max(...[...p.solids, ...p.ground].map((s) => bounds(s).max.z)) - lot.z;
  if (top <= cap) return p;
  const k = cap / top;
  return mapZ(p, (n) => lot.z + (n - lot.z) * k, k);
}

/** Piece with every z raised by `dz`; heights, normals (`wall`, `Wall.normal`) and `courtyard` unchanged. */
export const liftPiece = (p: Piece, dz: number): Piece => mapZ(p, (n) => n + dz, 1);

/** Piece with every z coordinate through `z` and every height scaled by `k`; normals and `courtyard` unchanged. */
function mapZ(p: Piece, z: (n: number) => number, k: number): Piece {
  const P = (q: Vec3): Vec3 => v3(q.x, q.y, z(q.z));
  const solid = (s: Solid): Solid => {
    switch (s.kind) {
      case "poly": return { ...s, z: z(s.z), h: s.h * k };
      case "strip": return { ...s, z: z(s.z) };
      case "ground": return { ...s, tris: s.tris.map((t) => ({ ...t, pts: [P(t.pts[0]), P(t.pts[1]), P(t.pts[2])] })) };
      case "wheel": return { ...s, at: P(s.at) };
      case "beam": return { ...s, from: P(s.from), to: P(s.to) };
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

/** A recipe's piece on its lot: with `ground` it stays at street level; without, it sits on a `PLINTH_H` plinth (piece and lot lifted). */
export interface Seated { piece: Piece; lot: Lot; plinth: boolean }
export function seat(recipe: Recipe, lot: Lot, rng: Rng, style: Style): Seated {
  const piece = recipe(lot, rng, style);
  if (piece.ground.length > 0) return { piece, lot, plinth: false };
  return { piece: liftPiece(piece, PLINTH_H), lot: { ...lot, z: lot.z + PLINTH_H }, plinth: true };
}
