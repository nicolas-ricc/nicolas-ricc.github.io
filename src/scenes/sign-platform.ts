import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { diagonalWall, measureText, strokeText } from "../kit/lettering";
import { neon } from "../kit/props";

const SIZE = 8.55;

/** Sea platform placeholder: six steel piles, a deck and "Blog" in cyan neon on the diagonal plane at z 2.8; #363 replaces it. */
export function seaPlatform(out: Solid[], accents: Accent[]): void {
  for (const x of [-6.5, 0, 6.5]) for (const y of [-5.5, 5.5]) out.push({ kind: "cylinder", at: v3(x, y, -1), r: 0.3, h: 2.2, sides: 6, mat: "steel" });
  out.push({ kind: "prism", at: v3(-7, -6, 1.2), w: 14, d: 12, h: 0.4, mat: "deck" });
  const { width } = measureText("Blog", SIZE), half = (width / 2) * Math.SQRT1_2; // centered: origin = (0, 0, 2.8) − u·width/2
  for (const q of strokeText("Blog", diagonalWall(v3(-half, half, 2.8)), SIZE, 1)) accents.push(...neon(q, "cyan", 0.75));
}
