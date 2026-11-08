import { v3 } from "../../iso/geometry";
import type { Plate } from "../../iso/plate";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { addBuilding, emptyPiece } from "../piece";
import { awning, chair, garland, table } from "../props";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/**
 * `harbor` family (#326): the fish market and the food hall of the dock inlet.
 * Fixed dimensions, centered in the lot (the city's lot is exactly their size).
 * No recipe consumes the rng.
 */
export const FISH_MARKET = { w: 21, d: 15, h: 4, vaultH: 3 } as const;
export const FOOD_HALL = { shedW: 8, gap: 5, d: 15, h: 4, vaultH: 2.5 } as const;

/** Fish market: brick hall with a 1x6 facade, glazed plates and an awning on the north wall, sheet vault along x. */
export function fishMarket(lot: Lot, _rng: Rng, style: Style): Piece {
  const { w, d, h, vaultH } = FISH_MARKET, p = emptyPiece();
  const x0 = lot.x + (lot.w - w) / 2, y0 = lot.y + (lot.d - d) / 2, z = lot.z;
  const facade = { floors: 1, cols: 6 };
  const body = prism(x0, y0, z, w, d, h, style.mat, { facade, tone: style.tone });
  body.plates = Array.from({ length: 6 }, (_, k): Plate => ({ wall: 0, shape: "rect", u0: (3.5 * k + 0.75) / w, u1: (3.5 * k + 2.75) / w, z0: z + 1, z1: z + 3.5, mat: "glass", toneOffset: 1 }));
  addBuilding(p, body, facade);
  p.solids.push({ kind: "vault", at: v3(x0, y0, z + h), len: w, w: d, h: vaultH, axis: "x", mat: style.roof, segments: 8 });
  p.solids.push(...awning(v3(x0 + 4.5, y0 - 0.8, z + 3.5), 12, "n"));
  return p;
}

/** Food hall: two brick sheds with vaults along y, a covered patio between them (slab, posts, garland) with three tables. */
export function foodHall(lot: Lot, _rng: Rng, style: Style): Piece {
  const { shedW, gap, d, h, vaultH } = FOOD_HALL, p = emptyPiece();
  const w = 2 * shedW + gap;
  const x0 = lot.x + (lot.w - w) / 2, y0 = lot.y + (lot.d - d) / 2, z = lot.z;
  const facade = { floors: 1, cols: 3 };
  for (const sx of [x0, x0 + shedW + gap]) {
    addBuilding(p, prism(sx, y0, z, shedW, d, h, style.mat, { facade, tone: style.tone }), facade);
    p.solids.push({ kind: "vault", at: v3(sx, y0, z + h), len: d, w: shedW, h: vaultH, axis: "y", mat: style.roof, segments: 8 });
  }
  const px = x0 + shedW;
  p.solids.push(prism(px, y0, z + h, gap, d, 0.3, "steel"));
  for (const cx of [px, px + gap - 0.3]) for (const cy of [y0, y0 + d - 0.3]) p.solids.push(prism(cx, cy, z, 0.3, 0.3, h, "steel"));
  const zig = [];
  for (let k = 0, y = y0; y <= y0 + d + 1e-9; k++, y += 2.5) zig.push(v3(k % 2 === 0 ? px + 0.3 : px + gap - 0.3, y, z + 3.4));
  p.accents.push(...garland(zig));
  for (const f of [1, 2, 3]) {
    const ty = y0 + (d * f) / 4;
    p.solids.push(...table(v3(px + 2, ty - 0.5, z)), ...chair(v3(px + 1.4, ty - 0.25, z)), ...chair(v3(px + 3.1, ty - 0.25, z)));
  }
  return p;
}

export const HARBOR: readonly RecipeDef[] = [
  { name: "fishMarket", recipe: fishMarket, family: "harbor" },
  { name: "foodHall", recipe: foodHall, family: "harbor" },
];
