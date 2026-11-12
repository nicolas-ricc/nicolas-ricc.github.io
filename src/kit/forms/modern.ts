import { v3 } from "../../iso/geometry";
import { bounds, type Solid } from "../../iso/solids";
import type { Facade } from "../../iso/facade";
import { GABLE_RATIO } from "../../iso/solids";
import type { Rng } from "../../map/seed";
import { PLINTH_H, prism, tiles } from "../../scenes/city-pieces";
import { towerCrane } from "../../scenes/pieces";
import { LANDMARK_MAX_H, SIGN_MIN_H, addBuilding, emptyPiece, interlock, southSign } from "../piece";
import { beacon, clock, container, fence, helipad, sign, table } from "../props";
import { gableRoof, greenRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/**
 * `modern` family: the four pieces of Resume's modern district (glass tower
 * in stepped bodies, stone classic with a heavy cornice, startup campus
 * with a green courtyard and construction site), moved from the
 * old district.ts. Spec §5 and §6.
 */
export const MAX_CLASSIC_H = 18;
const CURTAIN_WINDOW = { w: 0.85, h: 0.8 } as const;

const tierHeights = (h: number, tiers: number): number[] => (tiers === 3 ? [0.6, 0.3, 0.1] : [0.7, 0.3]).map((s) => Math.max(3, Math.round(h * s)));
const GLASS_CROWN = 2.3; // green terrace: 0.3 slab + 2 cone (the helipad is lower)

/** Whether the requested body `h` with `tiers` bodies (each with its 0.3 slab) and the terrace fit within `cap`. */
const glassFits = (h: number, tiers: number, cap: number): boolean => tierHeights(h, tiers).reduce((a, b) => a + b, 0) + 0.3 * tiers + GLASS_CROWN <= cap;

/** Highest requested height that fits within `cap` with any of the possible splits. */
function glassMaxH(cap: number, tiers: readonly number[]): number {
  let h = Math.floor(cap);
  while (h > 3 && tiers.some((t) => !glassFits(h, t, cap))) h--;
  return h;
}

export function glassTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d } = lot;
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H), threeFit = glassFits(3, 3, cap);
  const hMax = glassMaxH(cap, threeFit ? [2, 3] : [2]);
  const h = hMax < 16 ? hMax : rng.int(16, hMax);
  const bw = rng.int(12, 14), bd = rng.int(10, 12);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const drawn = rng.int(2, 3);
  const tiers = threeFit ? drawn : 2; // with a low cap three bodies of at least 3 don't fit: forced to two, the rng is consumed all the same
  const insets = [0, 2, 4];
  let z = lot.z;
  tierHeights(h, tiers).forEach((th, t) => {
    const ins = insets[t]!, tw = bw - 2 * ins, td = bd - 2 * ins;
    const facade: Facade = { floors: Math.max(1, Math.round(th / 3)), cols: Math.max(2, Math.round(tw / 2.5)), window: CURTAIN_WINDOW, ...(t === 0 ? { base: "glass" as const } : {}) };
    addBuilding(p, prism(bx + ins, by + ins, z, tw, td, th, "curtain", { facade, tone: style.tone }), facade);
    p.solids.push(prism(bx + ins - 0.3, by + ins - 0.3, z + th, tw + 0.6, td + 0.6, 0.3, style.trim)); // capping slab of each body
    z += th + 0.3;
  });
  const ins = insets[tiers - 1]!, cx = bx + bw / 2, cy = by + bd / 2;
  if (rng.chance(0.5)) { const hp = helipad(v3(cx, cy, z)); p.solids.push(...hp.solids); p.accents.push(...hp.accents); }
  else p.solids.push(...greenRoof({ x: bx + ins, y: by + ins, w: bw - 2 * ins, d: bd - 2 * ins, z }, rng));
  if (h >= 18) p.accents.push(...beacon(v3(bx + bw - ins, by + ins, z + 0.5)).accents);
  if (h >= SIGN_MIN_H) p.slots.push(southSign(bx, by + bd, bw, lot.z + h / 2 - 0.8));
  p.landmarkTop = v3(cx, cy, z);
  return p;
}

const CLASSIC_CROWN = 1 + 3 * (1 + GABLE_RATIO); // heavy cornice + gable of 3, the taller of the two toppers

export function classic(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d } = lot;
  const hMax = Math.min(MAX_CLASSIC_H, Math.floor(Math.min(lot.maxH, LANDMARK_MAX_H) - CLASSIC_CROWN));
  const h = hMax < 12 ? hMax : rng.int(12, hMax);
  const bw = rng.int(14, 17), bd = rng.int(11, 13);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const floors = Math.max(2, Math.round(h / 3.5)), cols = rng.int(4, 5), fh = h / floors;
  const facade: Facade = { floors, cols, base: "portico" };
  addBuilding(p, prism(bx, by, lot.z, bw, bd, h, "stone", { facade, tone: style.tone }), facade);
  for (let k = 0; k <= cols; k++) { // ground-floor pilasters on the visible faces (east and south)
    p.solids.push(interlock(prism(bx + bw, by + (bd * k) / cols - 0.2, lot.z, 0.4, 0.4, fh, "stone"))); // the corner pair (k = cols) overlaps
    p.solids.push(interlock(prism(bx + (bw * k) / cols - 0.2, by + bd, lot.z, 0.4, 0.4, fh, "stone")));
  }
  const top = lot.z + h;
  p.solids.push(prism(bx - 0.8, by - 0.8, top, bw + 1.6, bd + 1.6, 1, style.trim)); // heavy cornice
  if (rng.chance(0.5)) p.solids.push(...gableRoof({ x: bx + 2, y: by + 2, w: bw - 4, d: bd - 4, z: top + 1 }, 3, style.roof));
  else p.solids.push(prism(bx + 2, by + 2, top + 1, bw - 4, bd - 4, 2, "stone"), prism(bx + 5, by + 4, top + 3, bw - 10, bd - 8, 1.5, "stone")); // stepped crown
  const cz = top - fh / 2, cx = bx + bw / 2; // clock on the south face, top floor
  p.accents.push(clock(cx, by + bd, cz));
  if (h >= SIGN_MIN_H) p.slots.push(southSign(bx, by + bd, bw, lot.z + h / 2 - 0.8));
  p.landmarkTop = v3(cx, by + bd / 2, top + 1);
  return p;
}

/** Three low buildings in a U around a green courtyard; the lot floor is jungle, with loose plinths under each building. */
export function campus(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  p.ground.push(tiles(rng, lot, z + 0.05, "leafDark"));
  const bldg = (bx: number, by: number, bw: number, bd: number, h: number): number => {
    p.solids.push(prism(bx, by, z, bw, bd, PLINTH_H, "paving"));
    const facade: Facade = { floors: Math.max(2, Math.round(h / 3)), cols: Math.max(2, Math.round(bw / 4)), base: "glass" };
    addBuilding(p, prism(bx + 0.5, by + 0.5, z + PLINTH_H, bw - 1, bd - 1, h, "office", { facade, tone: style.tone }), facade);
    p.solids.push(prism(bx, by, z + PLINTH_H + h, bw, bd, 0.4, style.trim));
    return z + PLINTH_H + h + 0.4;
  };
  const topN = bldg(x, y, w, 5, rng.int(6, 8));
  bldg(x, y + 6, 6, d - 6, rng.int(6, 8));
  bldg(x + w - 6, y + 6, 6, d - 6, rng.int(6, 8));
  const px0 = x + 6, px1 = x + w - 6, py0 = y + 6, py1 = y + d; // courtyard
  const tables = [[1, 1], [px1 - px0 - 2, 1], [1, py1 - py0 - 2], [px1 - px0 - 2, py1 - py0 - 2]].flatMap(([dx, dy]) => table(v3(px0 + dx!, py0 + dy!, z + 0.05)));
  const tableBoxes = tables.map(bounds);
  for (let k = 0, n = rng.int(4, 6); k < n; k++) { // a tree whose plan box overlaps a table is dropped; its rng values are still drawn
    const at = v3(px0 + 1.5 + rng.next() * (px1 - px0 - 3), py0 + 1.5 + rng.next() * (py1 - py0 - 3), z + 0.05), r = 1 + rng.next() * 0.5, h = 2 + rng.next();
    const hits = tableBoxes.some((b) => Math.min(at.x + r, b.max.x) - Math.max(at.x - r, b.min.x) > 1e-6 && Math.min(at.y + r, b.max.y) - Math.max(at.y - r, b.min.y) > 1e-6);
    if (!hits) p.solids.push(interlock({ kind: "cone", at, r, h, mat: "leaf" }));
  }
  p.ground.push({ kind: "strip", path: [{ x: (px0 + px1) / 2, y: y + 5 }, { x: (px0 + px1) / 2, y: py1 }], width: 1, z: z + 0.08, mat: "paving" });
  p.ground.push({ kind: "strip", path: [{ x: px0, y: (py0 + py1) / 2 }, { x: px1, y: (py0 + py1) / 2 }], width: 1, z: z + 0.08, mat: "paving" });
  p.solids.push(...tables);
  const s = sign(v3(x + w / 2 - 2, y + 4.1, topN), 4, 1.2); // on the south edge of the north building's roof
  p.solids.push(...s.solids);
  p.accents.push(...s.accents);
  return p;
}

/** Construction site: half-built slabs on columns, core, tower crane, site lights, fence and containers. Ignores `style` and `rng` on purpose (fixed site materials). */
export function constructionSite(lot: Lot, _rng: Rng, _style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H);
  const sx = x + 2, sy = y + 1.5, sw = 16, sd = 12;
  for (let k = 1; k <= 5 && 3 * k <= cap; k++) p.solids.push(interlock(prism(sx, sy, z + 3 * k - 0.3, k === 5 ? 8 : sw, sd, 0.3, "paving"))); // slabs; the last one half-built
  for (const [cx, cy] of [[0, 0], [8, 0], [16, 0], [0, 12], [8, 12], [16, 12]] as const) p.solids.push(interlock(prism(sx + cx - 0.3, sy + cy - 0.3, z, 0.6, 0.6, Math.min(15, cap), "steel")));
  p.solids.push(interlock(prism(sx + 6, sy + 4, z, 4, 4, Math.min(16, cap), "officeDark"))); // core
  // mast 8 from the east edge (the counter-jib ends at the lot edge, the jib at the west edge), south of the slabs and the column line (the hook, 0.6 either side of the jib, hangs clear of the columns)
  const mast = { x: x + w - 8, y: sy + sd + 1 };
  const crane: Solid[] = [];
  towerCrane(crane, p.accents, { at: mast, z, mastH: Math.min(22, cap), jibLen: 13, dir: "w", light: "amber" });
  // towerCrane pushes mast, jib, counter-jib, counterweight, cab (steel joints: marked), then cable and hook (hang free: not marked)
  crane.forEach((s, i) => p.solids.push(i < 5 ? interlock(s) : s));
  for (const dx of [2, 6, 10]) p.accents.push({ kind: "dot", at: v3(sx + dx, sy + 6, z + Math.min(15, cap) + 0.3), r: 0.5, color: "amber" }); // site lights
  p.solids.push(...fence(v3(x, y, z), w, d), ...container(v3(x + 0.5, sy + sd - 2.8, z)), ...container(v3(x + 7, sy + sd - 2.8, z)));
  p.landmarkTop = v3(mast.x, mast.y, z + Math.min(22, cap));
  return p;
}

export const MODERN: readonly RecipeDef[] = [
  { name: "glassTower", recipe: glassTower, family: "modern", landmark: true },
  { name: "classic", recipe: classic, family: "modern", landmark: true },
  { name: "campus", recipe: campus, family: "modern" },
  { name: "constructionSite", recipe: constructionSite, family: "modern", landmark: true },
];
