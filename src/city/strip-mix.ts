import type { Vec2 } from "../iso/geometry";

/**
 * The strip's mixing field (#496): a smooth deterministic "how urban" value picks the neighborhood of each strip parcel, so the strip
 * reads mixed (patches of ~110 u with ~45 u detail), higher to the north and lower to the south. Pure: no scene.
 * The thresholds are the plan's (moderno > transicion > clasico > bajo); the noise amplitudes 0.85 (period 110) and 0.4 (period 45) are the plan's too,
 * unchanged (the "not in bands" test passes with them). North to south base (R6, spec §8: houses with patches of mid-rises to the south): 0.7 north of y 330, then falling `SLOPE` = 1.2 over 380 u, floored at -0.2 (the plan's 0.55 and the suggested 0.9 left the south strip at 37% bajo). With the world seed the south strip is 70 bajo, 29 clasico, 14 transicion, 4 moderno (60% bajo); the city strip 21 transicion, 8 moderno, 1 clasico. Smoothness bound used by the test: 10 * 1.5 * (0.85 / 110 + 0.4 / 45) + 0.05 ≈ 0.30.
 */
export const STRIP_IN = -400, STRIP_OUT = -470;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
/** 0 east of `x - y = -400`, 1 west of `-470`, linear between: the strip enters little by little. Only strip parcels ask it, and the first lie near −449 (outside the cover's margin), at a weight of about 0.7: the ramp shows in its outer half. */
export const stripWeight = (x: number, y: number): number => clamp01((STRIP_IN - (x - y)) / (STRIP_IN - STRIP_OUT));

/** Deterministic hash of a point to [0, 1) (32-bit integer mix of the point at 1/64 u). */
export function hash01(x: number, y: number): number {
  let h = Math.imul(Math.floor(x * 64) | 0, 374761393) ^ Math.imul(Math.floor(y * 64) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Value noise in [0, 1]: `hash01` on a lattice of `period` u, smoothstep-bilinear between nodes. */
export function valueNoise(x: number, y: number, period: number): number {
  const gx = x / period, gy = y / period, ix = Math.floor(gx), iy = Math.floor(gy), tx = smooth(gx - ix), ty = smooth(gy - iy);
  const a = hash01(ix, iy), b = hash01(ix + 1, iy), c = hash01(ix, iy + 1), d = hash01(ix + 1, iy + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const SLOPE = 1.2;
/** Urbanity: a gradient (0.7 north of y 330, then falling `SLOPE` over the next 380 u, floored at -0.2) plus value noise in two scales. */
export const urbanity = (x: number, y: number): number =>
  (y < 330 ? 0.7 : Math.max(-0.2, 0.7 - (y - 330) / 380 * SLOPE)) + (valueNoise(x, y, 110) - 0.5) * 0.85 + (valueNoise(x + 31, y - 17, 45) - 0.5) * 0.4;
/** Neighborhood the field gives at a point. */
export type FieldKind = "bajo" | "clasico" | "transicion" | "moderno";
export const fieldKind = (x: number, y: number): FieldKind => { const u = urbanity(x, y); return u > 0.72 ? "moderno" : u > 0.52 ? "transicion" : u > 0.34 ? "clasico" : "bajo"; };
/** Whether a strip parcel takes the field's neighborhood (else the one it already has): the weight is the chance. */
export const mixes = (c: Vec2): boolean => hash01(c.x + 91, c.y - 37) < stripWeight(c.x, c.y);
