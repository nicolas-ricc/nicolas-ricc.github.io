import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import { container, industrialLamp, neon, place } from "../kit/props";
import { diagonalWall, fillText, measureText, strokeText } from "../kit/lettering";

const WORD = "Portfolio", SIZE = 8.55, FILL = 1.6, OUTLINE = 2.1, NEON_GAP = 0.06;
/** Width of the amber core: the 1.5 px criterion at cover scale 1.17 needs ≥ 0.92 (0.5 gave 0.83 px). */
export const INNER = 1.0;
const T = 1.2, WALL_H = 11.5, MARGIN = 2.5, BASELINE = 1.5;
/** Floodlight height: at 4 u from the face a higher bulb (r 1.2) projects onto the letters; at 1.2 it stays below the paint on screen. */
const LAMP_H = 1.2;

const H = Math.SQRT1_2, K = SIZE / 7;
const SIG = { word: "rust", size: 2.2, width: 0.5, base: 0.6, gap: 1 } as const;

/** Graffiti wall of Portfolio: concrete at 45° with a stone cap, "Portfolio" throw-up in safety with an amber core, wear, drips, signature, three floodlights, drums and a container. */
export function graffitiWall(out: Solid[], accents: Accent[]): void {
  const L = measureText(WORD, SIZE).width + 2 * MARGIN;
  const d = v3(H, -H, 0), n = v3(H, H, 0);
  const ring = (len: number, t: number) => { // D, C, B, A around the origin
    const at = (s: number, k: number) => ({ x: d.x * len / 2 * s + n.x * t / 2 * k, y: d.y * len / 2 * s + n.y * t / 2 * k });
    return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
  };
  const footprint = ring(L, T), D = footprint[0]!;
  const F = (a: number, z: number): Vec3 => v3(D.x + d.x * a, D.y + d.y * a, z); // on the face, `a` from the left end
  const G = (a: number, m: number): Vec3 => v3(D.x + d.x * a + n.x * m, D.y + d.y * a + n.y * m, 0); // on the ground, `m` in front of the face
  const paint = (q: Vec2[], mat: "hull" | "officeDark" | "safety", dx = 0, dy = 0): Plate => ({ wall: 0, shape: "poly", mat, pts: q.map((p) => ({ x: (MARGIN + p.x + dx) / L, y: BASELINE + p.y + dy })) });
  const joint = (z: number): Plate => ({ wall: 0, shape: "rect", u0: 0, u1: 1, z0: z - 0.04, z1: z + 0.04, mat: "concrete", toneOffset: -1 });
  const drip = (a: number, len: number): Plate => ({ wall: 0, shape: "rect", u0: (a - 0.125) / L, u1: (a + 0.125) / L, z0: BASELINE - len, z1: BASELINE, mat: "safety" });
  const fill = fillText(WORD, SIZE, FILL);
  const sigW = measureText(SIG.word, SIG.size).width;
  const plates: Plate[] = [
    ...[2.9, 5.8, 8.7, 10.9].map(joint),
    ...([
      [6, 1.3, 2.6, 1.8],
      [30, 1.1, 3, 1.6],
      [4, 9.8, 2, 1.5],
      [41.3, 9.6, 1.6, 2.4], // right, above the final o
    ] as const).map(([a, z, w, h]): Plate => ({ wall: 0, shape: "disc", u0: (a - w / 2) / L, u1: (a + w / 2) / L, z0: z - h / 2, z1: z + h / 2, mat: "concrete", toneOffset: -1 })),
    ...fill.map((q) => paint(q, "hull", 0.6, -0.6)),
    ...fillText(WORD, SIZE, OUTLINE).map((q) => paint(q, "officeDark")),
    ...fill.map((q) => paint(q, "safety")),
    ...([
      [0, 1.4],
      [13, 1.0],
      [17, 1.3],
      [24, 1.1],
      [29.5, 1.45],
    ] as const).map(([x, len]) => drip(MARGIN + x * K, len)),
    ...fillText(SIG.word, SIG.size, SIG.width).map((q): Plate => ({ wall: 0, shape: "poly", mat: "signal", pts: q.map((p) => ({ x: (L - SIG.gap - sigW + p.x) / L, y: SIG.base + p.y })) })),
  ];
  out.push({ kind: "poly", footprint, z: 0, h: WALL_H, mat: "concrete", plates });
  out.push({ kind: "poly", footprint: ring(L + 0.3, T + 0.3), z: WALL_H, h: 0.3, mat: "stone" });

  const o = F(MARGIN, BASELINE), core = diagonalWall(v3(o.x + n.x * NEON_GAP, o.y + n.y * NEON_GAP, BASELINE));
  for (const q of strokeText(WORD, core, SIZE, INNER)) accents.push(...neon(q, "amber", 0.75));

  for (const u of [0.2, 0.5, 0.8]) {
    const a = u * L, lit = industrialLamp(G(a, 4), { h: LAMP_H, center: true }), b = lit.bulb;
    place(out, accents, lit);
    accents.push({ kind: "poly", color: "amberBleed", alpha: 0.12, pts: [v3(b.x - d.x * 0.3, b.y - d.y * 0.3, b.z), v3(b.x + d.x * 0.3, b.y + d.y * 0.3, b.z), F(a + 4, 9), F(a - 4, 9)] });
  }

  for (const [a, m] of [[1.6, 2.2], [4.2, 2.2], [2.9, 4.6]] as const) out.push({ kind: "cylinder", at: G(a, m), r: 1.1, h: 1.6, mat: "rust", sides: 6 });
  const diff = Math.SQRT2 * (L / 2 - 1) + 2.9, sum = Math.SQRT2 * 2.6;
  out.push(...container(v3((sum + diff) / 2, (sum - diff) / 2, 0)));
}
