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
  const plane = diagonalWall(v3(0, 0, 2.8)), { width } = measureText("Blog", SIZE);
  plane.origin = v3(-plane.u.x * width / 2, -plane.u.y * width / 2, 2.8);
  for (const q of strokeText("Blog", plane, SIZE, 1)) accents.push(...neon(q, "cyan", 0.75));
}
