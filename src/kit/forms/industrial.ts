import { v3 } from "../../iso/geometry";
import { shadeTone } from "../../iso/light";
import { ribs, type Plate } from "../../iso/plate";
import { GABLE_RATIO, type Solid } from "../../iso/solids";
import type { Material } from "../../map/palette-iso";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import { addBuilding, emptyPiece, recipeCap, shiftTone } from "../piece";
import type { Lot, Piece, RecipeDef, Side, Style } from "../types";

/**
 * `industrial` family (#321): sawtooth and sheet halls, container yards, stockpile,
 * tanks, quay crane, RTG gantry and storeroom. Exported builders are pure and carry
 * no tone: the recipe (or the scene that reuses them) applies it.
 */
const TOOTH_W = 4;
const WALL_NORMALS = [v3(0, -1, 0), v3(1, 0, 0), v3(0, 1, 0), v3(-1, 0, 0)]; // plate wall index: 0 N, 1 E, 2 S, 3 W
const SIDES: readonly Side[] = ["n", "e", "s", "w"];

/** The piece with `tone` on every solid (the field is omitted when 0, as `prism` does). */
const tonePiece = (p: Piece, tone: number): Piece => (tone === 0 ? p : { ...p, solids: p.solids.map((s) => ({ ...s, tone })) });

/** Door plate centered on a wall of length `len`: `width` wide and `h` tall from `z0`, `mat` that of the wall, two tones darker. */
export function door(wall: number, len: number, width: number, z0: number, h: number, mat: Material): Plate {
  const u0 = (1 - width / len) / 2;
  return { wall, shape: "rect", u0, u1: u0 + width / len, z0, z1: z0 + h, mat, toneOffset: -2 };
}

/** Sawtooth roof: floor(w/4) ramps 4 wide descending west (vertical face east) from `z + h`, centered in x, each with a glazed plate on that face. */
export function sawtooth(out: Solid[], rect: Rect, z: number, h: number, toothH: number, mat: Material, glass: Material): void {
  const n = Math.floor(rect.w / TOOTH_W), x0 = rect.x + (rect.w - n * TOOTH_W) / 2, base = z + h;
  for (let k = 0; k < n; k++) {
    const plate: Plate = { wall: 1, shape: "rect", u0: 0.05, u1: 0.95, z0: base + 0.3 * toothH, z1: base + 0.9 * toothH, mat: glass };
    out.push({ kind: "ramp", at: v3(x0 + k * TOOTH_W, rect.y, base), w: TOOTH_W, d: rect.d, h: toothH, mat, dir: "w", plates: [plate] });
  }
}

/** Factory hall with a concrete body that has a facade and a sawtooth roof. */
export function sawtoothHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, toothH = 2;
  const h = Math.min(rng.int(6, 9), recipeCap(lot) - toothH);
  const facade = { floors: 1, cols: Math.max(1, Math.round(w / 4)) };
  addBuilding(p, prism(x, y, z, w, d, h, style.mat, { facade }), facade);
  sawtooth(p.solids, { x, y, w, d }, z, h, toothH, style.roof, "glass");
  return tonePiece(p, tone);
}

/** Gable hall of corrugated sheet: ribs on the two long walls and a 4-wide door on the first open side. */
export function sheetHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(5, 8), recipeCap(lot) / (1 + GABLE_RATIO));
  const mat = rng.pick<Material>(["sheetGreen", "sheetTeal"]);
  const hall = prism(x, y, z, w, d, h, mat, { roof: "gable", roofMat: mat });
  const plates: Plate[] = [];
  for (const wall of w >= d ? [0, 2] : [3, 1]) plates.push(...ribs(wall, wall % 2 === 0 ? w : d, z, z + h, shadeTone(WALL_NORMALS[wall]!) === "lit", mat));
  const side = Math.max(0, SIDES.indexOf(lot.open[0] ?? "s"));
  plates.push(door(side, side % 2 === 0 ? w : d, 4, z, Math.min(4, h - 1), mat));
  hall.plates = plates;
  p.solids.push(hall);
  return tonePiece(p, tone);
}

/** Small shed 4×3×2.6 centered in the lot, with a door on the south face. */
export function storeroom(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const mat = rng.pick<Material>(["sheetGreen", "steel"]);
  const shed = prism(x + (w - 4) / 2, y + (d - 3) / 2, z, 4, 3, 2.6, mat);
  shed.plates = [door(2, 4, 1.2, z, 2, mat)];
  p.solids.push(shed);
  return tonePiece(p, tone);
}

export const INDUSTRIAL: readonly RecipeDef[] = [
  { name: "sawtoothHall", recipe: sawtoothHall, family: "industrial" },
  { name: "sheetHall", recipe: sheetHall, family: "industrial" },
  { name: "storeroom", recipe: storeroom, family: "industrial" },
];
