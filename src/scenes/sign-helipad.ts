import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { diagonalWall, measureText, roofDiagonal, strokeText } from "../kit/lettering";
import { neon } from "../kit/props";

const WORD = "Resume";
const slab = (out: Solid[]) => out.push({ kind: "prism", at: v3(-11, -11, 0), w: 22, d: 22, h: 0.5, mat: "concrete" });

/** Helipad placeholder (A): the word in green neon lying on the slab, centered; #361 replaces it. */
export function helipadSign(out: Solid[], accents: Accent[]): void {
  slab(out);
  const size = 6, stroke = 0.8, { width, capHeight } = measureText(WORD, size), { u, v } = roofDiagonal(v3(0, 0, 0));
  const origin = v3(-u.x * width / 2 - v.x * capHeight / 2, -u.y * width / 2 - v.y * capHeight / 2, 0.55);
  for (const q of strokeText(WORD, roofDiagonal(origin), size, stroke)) accents.push(...neon(q, "green"));
}

/** Helipad placeholder (B): the word in green neon standing on the vertical diagonal plane, baseline at z 1.5; #361 replaces it. */
export function helipadTubeSign(out: Solid[], accents: Accent[]): void {
  slab(out);
  const size = 8.55, stroke = 1, { width } = measureText(WORD, size), { u } = diagonalWall(v3(0, 0, 0));
  const origin = v3(-u.x * width / 2, -u.y * width / 2, 1.5);
  for (const q of strokeText(WORD, diagonalWall(origin), size, stroke)) accents.push(...neon(q, "green"));
}
