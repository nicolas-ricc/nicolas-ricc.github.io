import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { Z_SCALE } from "../iso/project";
import { diagonalWall, measureText, roofDiagonal, strokeText } from "../kit/lettering";
import { interlock } from "../kit/piece";
import { industrialLamp, neon, place } from "../kit/props";
import { prism } from "./city-pieces";

const WORD = "Resume", TOP = 32.9, PAD = 32.95, R2 = Math.SQRT2;
const steel = (x: number, y: number, z: number, w: number, d: number, h: number) => interlock(prism(x, y, z, w, d, h, "steel"));
const beam = (from: Vec3, to: Vec3, w: number): Solid => interlock({ kind: "beam", from, to, w, h: w, mat: "steel" });

/** A's word size: the largest cap height whose rectangle fits the south-east triangle of the slab inset 1 u (baseline corners on x = 10 and y = 10, top edge on x + y = √2). */
export const ROOF_WORD_SIZE = ((20 - R2) / R2) / (measureText(WORD, 1).width / 2 + Z_SCALE * R2);
/** B's cap height: x-height ≥ 10 px CSS at cover scale 1.17 (`sizeForXHeight` gives 8.547…, just under in floats). */
export const TUBE_WORD_SIZE = 8.55;
/** B's frame center: 10.56 u south-east of the slab's center, where the slab chord is 10 u. */
export const TUBE_FRAME_CENTER: Vec3 = v3(11 - 5 / R2, 11 - 5 / R2, 0);

/** Common base: tower, cornice, pillars, raised slab, net, pad marks, edge lights and floodlights. */
function helipadBase(out: Solid[], accents: Accent[]): void {
  out.push(prism(-8, -7, 0, 16, 14, 30, "officeDark"), prism(-8.5, -7.5, 30, 17, 15, 0.4, "office"));
  for (const x of [-6, 6]) for (const y of [-5, 5]) out.push(steel(x - 0.3, y - 0.3, 30.4, 0.6, 0.6, 2));
  for (const y of [-5, 5]) out.push(beam(v3(-6, y, 32.1), v3(6, y, 32.1), 0.3));
  out.push(prism(-11, -11, 32.4, 22, 22, 0.5, "concrete"));
  out.push(prism(-11, 10.88, TOP, 22, 0.12, 0.6, "steel"), prism(-11, -11, TOP, 22, 0.12, 0.6, "steel"),
    prism(10.88, -10.88, TOP, 0.12, 21.76, 0.6, "steel"), prism(-11, -10.88, TOP, 0.12, 21.76, 0.6, "steel"));
  out.push({ kind: "cylinder", at: v3(0, 0, TOP), r: 9, h: 0.05, mat: "whitewash", sides: 16 });
  out.push(prism(-6, -6, PAD, 1, 5, 0.06, "whitewash"), prism(-2, -6, PAD, 1, 5, 0.06, "whitewash"), prism(-5, -4, PAD, 3, 1, 0.06, "whitewash"));
  for (let k = 0; k < 16; k++) {
    const t = (11.25 + k * 22.5) * Math.PI / 180;
    accents.push({ kind: "dot", at: v3(9.6 * Math.cos(t), 9.6 * Math.sin(t), PAD), r: 0.25, color: "greenMid" });
  }
  for (const [x, y, h] of [[10.58, 10.58, 5], [10.58, -10.58, 5], [0, 10.58, 1]] as const) { // the low one stays under B's lower beam
    const lit = industrialLamp(v3(x, y, TOP), { center: true, h });
    place(out, accents, { solids: lit.solids, accents: lit.accents.map((a) => ({ ...a, color: "amber" as const })) });
  }
}

/** Helipad (A): the word in green neon lying anamorphic on the pad's south-east half, largest size that fits with 1 u of margin. */
export function helipadSign(out: Solid[], accents: Accent[]): void {
  helipadBase(out, accents);
  const { width } = measureText(WORD, ROOF_WORD_SIZE), m = 10 - width / (2 * R2), { u } = roofDiagonal(v3(0, 0, 0));
  const origin = v3(m - u.x * width / 2, m - u.y * width / 2, PAD);
  for (const q of strokeText(WORD, roofDiagonal(origin), ROOF_WORD_SIZE, 0.8)) accents.push(...neon(q, "green"));
}

/** Helipad (B): a tube sign on a steel frame standing on the pad's south-east edge, on the vertical diagonal plane. */
export function helipadTubeSign(out: Solid[], accents: Accent[]): void {
  helipadBase(out, accents);
  const C = TUBE_FRAME_CENTER, d = diagonalWall(C).u, { width } = measureText(WORD, TUBE_WORD_SIZE), L = width + 2;
  const at = (s: number, z: number) => v3(C.x + d.x * s, C.y + d.y * s, z);
  const lo = 34.1, hi = lo + TUBE_WORD_SIZE + 1;
  out.push(beam(at(-L / 2, lo), at(0, lo), 0.3), beam(at(0, lo), at(L / 2, lo), 0.3), beam(at(-L / 2, hi), at(L / 2, hi), 0.3));
  // the posts stand at the disc's top level: the middle one is inside the disc's bounds box
  for (const s of [-4, 0, 4]) out.push(steel(C.x + d.x * s - 0.125, C.y + d.y * s - 0.125, PAD, 0.25, 0.25, hi - PAD));
  for (const [e, edge] of [[at(L / 2, lo), "x"], [at(-L / 2, lo), "y"]] as const) { // to the slab's top edge, shifted out by the half section
    const run = Math.abs((edge === "x" ? e.x : e.y) - 11);
    let off = 0; // fixed point (a quartic in closed form): the shift depends on the tilt, which depends on the shift; contracts by ~1e-3 per step
    for (let i = 0; i < 20; i++) off = 0.1 * (lo - TOP) / Math.hypot(run - off, lo - TOP);
    out.push(beam(e, edge === "x" ? v3(11 + off, e.y, TOP) : v3(e.x, 11 + off, TOP), 0.2));
  }
  for (const q of strokeText(WORD, diagonalWall(at(-width / 2, 34.3)), TUBE_WORD_SIZE, 1)) accents.push(...neon(q, "green"));
}
