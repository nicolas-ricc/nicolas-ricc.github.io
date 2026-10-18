import { v3 } from "../iso/geometry";
import type { Facade } from "../iso/facade";
import type { Solid, Tri } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import type { Rect } from "./city-grid";

/**
 * Piezas de bajo nivel compartidas por la ciudad vieja (city.ts) y el
 * distrito moderno (src/city/zoning.ts): el prisma con techo/fachada opcional, el
 * suelo facetado de baldosas; las props y las recetas viven en `src/kit/`.
 */
export const TILE = 6; // baldosa de la plaza y del suelo devorado
export const PLINTH_H = 0.3;

export type Prism = Solid & { kind: "prism" };
export type Extra = { roof?: "flat" | "gable" | "step" | "hip"; facade?: Facade; tone?: number };

export const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, extra: Extra = {}): Prism => {
  const p: Prism = { kind: "prism", at: v3(x, y, z), w, d, h, mat };
  if (extra.roof) p.roof = extra.roof;
  if (extra.facade) p.facade = extra.facade;
  if (extra.tone) p.tone = extra.tone;
  return p;
};

/** Baldosa rota del suelo devorado: un tercio con ±1. */
export const brokenTone = (rng: Rng): number => (rng.chance(1 / 3) ? rng.pick([-1, 1]) : 0);
/** Baldosa de la plaza: la mitad más clara y un quinto más oscura, para que la plaza se lea como un claro y no como asfalto. */
export const plazaTone = (rng: Rng): number => { const r = rng.next(); return r < 0.5 ? 1 : r < 0.7 ? -1 : 0; };

/** Suelo facetado de baldosas `TILE`×`TILE`, con el tono de cada una según `tone`. */
export function tiles(rng: Rng, r: Rect, z: number, mat: Material, tone: (rng: Rng) => number = brokenTone): Solid {
  const tris: Tri[] = [];
  const off = (): number => tone(rng);
  for (let x = r.x; x < r.x + r.w; x += TILE) for (let y = r.y; y < r.y + r.d; y += TILE) {
    const w = Math.min(TILE, r.x + r.w - x), d = Math.min(TILE, r.y + r.d - y);
    const a = v3(x, y, z), b = v3(x + w, y, z), c = v3(x + w, y + d, z), dd = v3(x, y + d, z);
    tris.push({ pts: [a, b, c], toneOffset: off() }, { pts: [a, c, dd], toneOffset: off() });
  }
  return { kind: "ground", mat, tris };
}
