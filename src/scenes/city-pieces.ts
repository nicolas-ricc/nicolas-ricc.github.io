import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Facade } from "../iso/facade";
import type { Solid, Tri } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import type { Rect } from "./city-grid";

/**
 * Piezas de bajo nivel compartidas por la ciudad vieja (city.ts) y el
 * distrito moderno (district.ts): el prisma con techo/fachada opcional, el
 * suelo facetado de baldosas y el farol de calle.
 */
export const TILE = 6; // baldosa de la plaza y del suelo devorado
export const PLINTH_H = 0.3;

export type Prism = Solid & { kind: "prism" };
export type Extra = { roof?: "flat" | "gable" | "step"; facade?: Facade };

export const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, extra: Extra = {}): Prism => {
  const p: Prism = { kind: "prism", at: v3(x, y, z), w, d, h, mat };
  if (extra.roof) p.roof = extra.roof;
  if (extra.facade) p.facade = extra.facade;
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

/** Farol: poste más bombillo ámbar. Devuelve dónde quedó el bombillo. */
export function lamp(solids: Solid[], accents: Accent[], x: number, y: number, z: number): Vec3 {
  const bulb = v3(x + 0.3, y + 0.3, z + 5);
  solids.push(prism(x, y, z, 0.6, 0.6, 5, "steel"));
  accents.push({ kind: "dot", at: bulb, r: 0.6, color: "amber" });
  return bulb;
}

/** Tres edificios bajos en U alrededor de un patio verde; el suelo de la manzana es selva, con zócalos sueltos bajo cada edificio (esquema de las manzanas devoradas). */
export function campus(out: Solid[], ground: Solid[], accents: Accent[], rng: Rng, r: Rect, x: number, y: number, w: number, d: number): void {
  ground.push(tiles(rng, r, 0.05, "leafDark"));
  const bldg = (bx: number, by: number, bw: number, bd: number, h: number) => {
    out.push(prism(bx, by, 0, bw, bd, PLINTH_H, "paving"));
    out.push(prism(bx + 0.5, by + 0.5, PLINTH_H, bw - 1, bd - 1, h, "office", { facade: { floors: Math.max(2, Math.round(h / 3)), cols: Math.max(2, Math.round(bw / 4)), base: "glass" } }));
    out.push(prism(bx, by, PLINTH_H + h, bw, bd, 0.4, "officeDark"));
    return PLINTH_H + h + 0.4;
  };
  const topN = bldg(x, y, w, 5, rng.int(6, 8));
  bldg(x, y + 6, 6, d - 6, rng.int(6, 8));
  bldg(x + w - 6, y + 6, 6, d - 6, rng.int(6, 8));
  const px0 = x + 6, px1 = x + w - 6, py0 = y + 6, py1 = y + d; // patio 9×9
  for (let k = 0, n = rng.int(4, 6); k < n; k++) out.push({ kind: "cone", at: v3(px0 + 1.5 + rng.next() * (px1 - px0 - 3), py0 + 1.5 + rng.next() * (py1 - py0 - 3), 0.05), r: 1 + rng.next() * 0.5, h: 2 + rng.next(), mat: "leaf" });
  ground.push({ kind: "strip", path: [{ x: (px0 + px1) / 2, y: y + 5 }, { x: (px0 + px1) / 2, y: py1 }], width: 1, z: 0.08, mat: "paving" });
  ground.push({ kind: "strip", path: [{ x: px0, y: (py0 + py1) / 2 }, { x: px1, y: (py0 + py1) / 2 }], width: 1, z: 0.08, mat: "paving" });
  for (const [dx, dy] of [[1, 1], [px1 - px0 - 2, 1], [1, py1 - py0 - 2], [px1 - px0 - 2, py1 - py0 - 2]] as const) out.push(prism(px0 + dx, py0 + dy, 0.05, 1, 1, 0.7, "paving")); // mesas
  const sx = x + w / 2 - 2, sy = y + 4.5; // cartel luminoso sobre el borde sur del techo del edificio norte
  accents.push({ kind: "poly", pts: [v3(sx - 0.3, sy, topN - 0.2), v3(sx + 4.3, sy, topN - 0.2), v3(sx + 4.3, sy, topN + 1.4), v3(sx - 0.3, sy, topN + 1.4)], color: "amberBleed", alpha: 0.6 });
  accents.push({ kind: "poly", pts: [v3(sx, sy, topN), v3(sx + 4, sy, topN), v3(sx + 4, sy, topN + 1.2), v3(sx, sy, topN + 1.2)], color: "amber" });
}
