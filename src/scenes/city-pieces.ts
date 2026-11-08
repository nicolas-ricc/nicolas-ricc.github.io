import { v3 } from "../iso/geometry";
import type { Facade } from "../iso/facade";
import type { Solid, Tri } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import type { Rect } from "./city-grid";

/**
 * Low-level pieces shared by the city (city.ts, src/city/fixed.ts)
 * and the recipes of `src/kit/`: the prism with optional roof/facade and the
 * faceted tile ground; the props live in `src/kit/props.ts`.
 */
export const TILE = 6; // tile of the plaza and of the devoured ground
export const PLINTH_H = 0.3;

export type Prism = Solid & { kind: "prism" };
export type Extra = { roof?: "flat" | "gable" | "step" | "hip"; roofMat?: Material; facade?: Facade; tone?: number };

export const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, extra: Extra = {}): Prism => {
  const p: Prism = { kind: "prism", at: v3(x, y, z), w, d, h, mat };
  if (extra.roof) p.roof = extra.roof;
  if (extra.roofMat) p.roofMat = extra.roofMat;
  if (extra.facade) p.facade = extra.facade;
  if (extra.tone) p.tone = extra.tone;
  return p;
};

/** Broken tile of the devoured ground: a third with ±1. */
export const brokenTone = (rng: Rng): number => (rng.chance(1 / 3) ? rng.pick([-1, 1]) : 0);
/** Tile of the plaza: half lighter and a fifth darker, so the plaza reads as a clearing and not as asphalt. */
export const plazaTone = (rng: Rng): number => { const r = rng.next(); return r < 0.5 ? 1 : r < 0.7 ? -1 : 0; };

/** Faceted ground of `size`×`size` tiles (`TILE` by default), clipped to the rect, with the tone of each one given by `tone`. Throws `RangeError` if `size` is not > 0. */
export function tiles(rng: Rng, r: Rect, z: number, mat: Material, tone: (rng: Rng) => number = brokenTone, size: number = TILE): Solid {
  if (!(size > 0)) throw new RangeError(`tiles: size must be > 0, got ${size}`);
  const tris: Tri[] = [];
  const off = (): number => tone(rng);
  for (let x = r.x; x < r.x + r.w; x += size) for (let y = r.y; y < r.y + r.d; y += size) {
    const w = Math.min(size, r.x + r.w - x), d = Math.min(size, r.y + r.d - y);
    const a = v3(x, y, z), b = v3(x + w, y, z), c = v3(x + w, y + d, z), dd = v3(x, y + d, z);
    tris.push({ pts: [a, b, c], toneOffset: off() }, { pts: [a, c, dd], toneOffset: off() });
  }
  return { kind: "ground", mat, tris };
}
