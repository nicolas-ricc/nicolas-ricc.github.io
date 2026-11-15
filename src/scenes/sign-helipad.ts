import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { diagonalWall, measureText, roofDiagonal, strokeText } from "../kit/lettering";
import { neon } from "../kit/props";

const WORD = "Resume", SIZE = 8.55, STROKE = 1;
const slab = (out: Solid[]) => out.push({ kind: "prism", at: v3(-11, -11, 0), w: 22, d: 22, h: 0.5, mat: "concrete" });

/** Helipad placeholder (A): the word in green neon lying on the slab, centered; #361 replaces it. */
export function helipadSign(out: Solid[], accents: Accent[]): void {
  slab(out);
  const { width, capHeight } = measureText(WORD, SIZE), plane = roofDiagonal(v3(0, 0, 0.55));
  plane.origin = v3(-plane.u.x * width / 2 - plane.v.x * capHeight / 2, -plane.u.y * width / 2 - plane.v.y * capHeight / 2, 0.55);
  for (const q of strokeText(WORD, plane, SIZE, STROKE)) accents.push(...neon(q, "green"));
}

/** Helipad placeholder (B): the word in green neon standing on the vertical diagonal plane, baseline at z 1.5; #361 replaces it. */
export function helipadTubeSign(out: Solid[], accents: Accent[]): void {
  slab(out);
  const plane = diagonalWall(v3(0, 0, 1.5)), { width } = measureText(WORD, SIZE);
  plane.origin = v3(-plane.u.x * width / 2, -plane.u.y * width / 2, 1.5);
  for (const q of strokeText(WORD, plane, SIZE, STROKE)) accents.push(...neon(q, "green"));
}
