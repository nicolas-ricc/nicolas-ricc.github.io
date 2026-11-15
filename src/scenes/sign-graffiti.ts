import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { fillText, measureText } from "../kit/lettering";

const WORD = "Portfolio", SIZE = 8.55, T = 1.2;

/** Graffiti wall placeholder: a concrete wall at 45° with "Portfolio" in safety plates on its front face; #362 replaces it. */
export function graffitiWall(out: Solid[], _accents: Accent[]): void {
  const L = measureText(WORD, SIZE).width + 5, h = Math.SQRT1_2;
  const [dx, dy, nx, ny] = [h, -h, h, h] as const;
  const at = (s: number, k: number) => ({ x: dx * L / 2 * s + nx * T / 2 * k, y: dy * L / 2 * s + ny * T / 2 * k });
  const footprint = [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)]; // D, C, B, A
  const plates = fillText(WORD, SIZE, 1.6).map((q) => ({
    wall: 0, shape: "poly" as const, mat: "safety" as const,
    pts: q.map((p) => ({ x: 2.5 / L + p.x / L, y: 1.5 + p.y })),
  }));
  out.push({ kind: "poly", footprint, z: 0, h: 11.5, mat: "concrete", plates });
}
