import { v3, type Vec2 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { brokenTone, prism, tiles } from "../../scenes/city-pieces";
import { RECIPE_MAX_H, addBuilding, emptyPiece } from "../piece";
import { bench, patioTree } from "../props";
import { CORNICE_H, HIP_ROOF_H, cornice, hipRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Side, Slot, Style } from "../types";
import { CAMERA_SIDES, neonRun } from "./lowrise";
import { clipBody, clipToPoly, insidePoly, polyArea, polyCornice, polyFootprint } from "./porteno";

/**
 * `courtyard` family: blocks with an interior courtyard (O with a passage, open U,
 * C with two courtyards and a residential courtyard with hip roofs). Each recipe
 * publishes its courtyard in `Piece.courtyard`. `courtyardO` and `patioResidential`
 * also publish neon runs on their open camera-facing faces (`CAMERA_SIDES`);
 * the south run of the O skips the passage. Spec §5 and §6.
 */
const PASSAGE = 3;

/** Wings of width `t` on `r` on the requested sides: north and south across the full width, east and west between them. Disjoint prisms, never a ring. */
function ring(r: Rect, t: number, sides: readonly Side[]) {
  const has = (s: Side) => sides.includes(s);
  const y0 = r.y + (has("n") ? t : 0), y1 = r.y + r.d - (has("s") ? t : 0);
  const x0 = r.x + (has("w") ? t : 0), x1 = r.x + r.w - (has("e") ? t : 0);
  const wings: { side: Side; rect: Rect }[] = [];
  if (has("n")) wings.push({ side: "n", rect: { x: r.x, y: r.y, w: r.w, d: t } });
  if (has("s")) wings.push({ side: "s", rect: { x: r.x, y: y1, w: r.w, d: t } });
  if (has("w")) wings.push({ side: "w", rect: { x: r.x, y: y0, w: t, d: y1 - y0 } });
  if (has("e")) wings.push({ side: "e", rect: { x: x1, y: y0, w: t, d: y1 - y0 } });
  return { wings, patio: { x: x0, y: y0, w: x1 - x0, d: y1 - y0 } };
}

/**
 * Wing with a `style.mat` facade and cornice, or a `style.roof` `hipRoof` with `hip`; `flush` leaves the cornice without overhang on that side (edge of the passage).
 * With `fp` (the chamfered footprint of a parcel polygon) the wing is clipped to it: dropped below area 4 (returns `false`), kept as is if it fits, otherwise a `poly` body with a `poly` cornice in place of the hip roof.
 */
function wing(p: Piece, r: Rect, z: number, h: number, cols: number, style: Style, { hip = false, flush, fp }: { hip?: boolean; flush?: "e" | "w"; fp?: Vec2[] } = {}): boolean {
  const facade: Facade = { floors: Math.max(1, Math.round(h / style.floorH)), cols };
  if (fp) {
    const clipped = clipBody(r, fp);
    if (!clipped) return false;
    if (Math.abs(polyArea(clipped) - r.w * r.d) > 1e-6) {
      addBuilding(p, { kind: "poly", footprint: clipped, z, h, mat: style.mat, facade, tone: style.tone }, facade);
      p.solids.push(polyCornice(clipped, z + h, style.trim));
      return true;
    }
  }
  addBuilding(p, prism(r.x, r.y, z, r.w, r.d, h, style.mat, { facade, tone: style.tone }), facade);
  if (hip) { p.solids.push(...hipRoof({ ...r, z: z + h }, style.roof)); return true; }
  const f = { x: r.x + (flush === "w" ? 0.5 : 0), y: r.y, w: r.w - (flush ? 0.5 : 0), d: r.d, z: z + h };
  p.solids.push(...cornice(f, style.trim));
  return true;
}

/** Whether a tree of radius 1 centered at `c` stands inside `fp` (`fp` is the chamfered footprint of a parcel polygon). */
export function treeFits(fp: Vec2[], c: { x: number; y: number }): boolean {
  if (!insidePoly(fp, c)) return false;
  return fp.every((a, i) => {
    const b = fp[(i + 1) % fp.length]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / l2));
    return Math.hypot(c.x - a.x - dx * t, c.y - a.y - dy * t) >= 1 - 1e-6;
  });
}

/** Keeps the neon slots whose `pts` are all within `fp` + 0.5 (a slot on a clipped or dropped wall would float). */
const slotsIn = (slots: Slot[], fp: Vec2[] | undefined): Slot[] => (fp ? slots.filter((s) => s.pts.every((q) => insidePoly(fp, q, 0.5))) : slots);

/** `n` courtyard trees inside `r`, 1 from the edge (their radius); with `fp` the ones that do not fit in it are dropped (the rng is drawn all the same). */
function patioTrees(p: Piece, rng: Rng, r: Rect, n: number, z: number, fp?: Vec2[]): void {
  for (let k = 0; k < n; k++) {
    const c = { x: r.x + 1 + rng.next() * Math.max(0, r.w - 2), y: r.y + 1 + rng.next() * Math.max(0, r.d - 2) };
    if (!fp || treeFits(fp, c)) p.solids.push(...patioTree(v3(c.x, c.y, z)));
  }
}

export function courtyardO(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H);
  const h = Math.min(rng.int(7, 12), Math.floor(cap - CORNICE_H));
  const { wings, patio } = ring(lot, 5, ["n", "s", "w", "e"]), fp = lot.poly ? polyFootprint(lot, 0, 2, "oblique") : undefined;
  for (const { side, rect } of wings) {
    const cols = rng.int(3, 4);
    if (side !== "s") { wing(p, rect, lot.z, h, cols, style, { fp }); continue; }
    const half = (rect.w - PASSAGE) / 2; // centered passage: the back is the courtyard
    const west = { ...rect, w: half }, east = { ...rect, x: rect.x + half + PASSAGE, w: half };
    const built = [wing(p, west, lot.z, h, cols, style, { flush: "e", fp }), wing(p, east, lot.z, h, cols, style, { flush: "w", fp })];
    if (lot.open.includes("s")) [west, east].forEach((r, k) => { if (built[k]) p.slots.push(...slotsIn(neonRun(r, "s", lot.z, p.slots.length), fp)); });
  }
  if (lot.open.includes("e")) p.slots.push(...slotsIn(neonRun(lot, "e", lot.z, p.slots.length), fp));
  const paved = rng.chance(0.5);
  if (fp) {
    const slab = clipToPoly(patio, fp); // the floor is the leafDark slab whichever branch is drawn
    if (polyArea(slab) >= 4) p.solids.push({ kind: "poly", footprint: slab, z: lot.z, h: 0.3, mat: "leafDark" });
    if (!paved) patioTrees(p, rng, patio, rng.int(2, 3), lot.z + 0.3, fp);
  } else if (paved) p.ground.push(tiles(rng, patio, lot.z + 0.05, "paving", brokenTone, 2));
  else { p.solids.push(prism(patio.x, patio.y, lot.z, patio.w, patio.d, 0.3, "leafDark")); patioTrees(p, rng, patio, rng.int(2, 3), lot.z + 0.3); }
  p.courtyard = patio;
  return p;
}

export function courtyardU(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), open = lot.open[0] ?? "s";
  const h = Math.min(rng.int(6, 10), Math.floor(cap - CORNICE_H));
  const { wings, patio } = ring(lot, 5, (["n", "s", "w", "e"] as const).filter((s) => s !== open)), fp = lot.poly ? polyFootprint(lot, 0, 2, "oblique") : undefined;
  for (const { rect } of wings) wing(p, rect, lot.z, h, rng.int(3, 4), style, { fp });
  // bench in the center and a tree on each side, splitting the courtyard along its long axis, so no tree falls on the bench
  const cx = patio.x + patio.w / 2, cy = patio.y + patio.d / 2;
  const halves: Rect[] = patio.w >= patio.d
    ? [{ ...patio, w: patio.w / 2 - 1 }, { ...patio, x: cx + 1, w: patio.w / 2 - 1 }]
    : [{ ...patio, d: patio.d / 2 - 0.3 }, { ...patio, y: cy + 0.3, d: patio.d / 2 - 0.3 }];
  for (const half of halves) patioTrees(p, rng, half, 1, lot.z, fp);
  const seat = bench(v3(cx - 1, cy - 0.3, lot.z));
  if (!fp || [[cx - 1, cy - 0.3], [cx + 1, cy - 0.3], [cx + 1, cy + 0.3], [cx - 1, cy + 0.3]].every(([qx, qy]) => insidePoly(fp, { x: qx!, y: qy! }))) p.solids.push(...seat);
  p.courtyard = patio;
  return p;
}

/** Two courtyards in five bands (decision 2): north wing, courtyard, central wing, courtyard, south wing; two short wings to the west. */
export function courtyardC(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(6, 9), Math.floor(cap - CORNICE_H));
  const cd = Math.min(5, d / 3), t = (d - cd) / 4, side = 5;
  const bars: Rect[] = [{ x, y, w, d: t }, { x, y: y + 2 * t, w, d: cd }, { x, y: y + d - t, w, d: t }];
  for (const r of bars) wing(p, r, z, h, rng.int(3, 4), style);
  for (const r of [{ x, y: y + t, w: side, d: t }, { x, y: y + 2 * t + cd, w: side, d: t }]) wing(p, r, z, h, 2, style);
  p.courtyard = { x: x + side, y: y + 2 * t + cd, w: w - side, d: t };
  return p;
}

export function patioResidential(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H);
  const h = Math.min(rng.int(6, 9), Math.floor(cap - HIP_ROOF_H));
  const { wings, patio } = ring(lot, 4.5, ["n", "s", "w", "e"]), fp = lot.poly ? polyFootprint(lot, 0, 2, "oblique") : undefined;
  for (const { rect } of wings) wing(p, rect, lot.z, h, rng.int(2, 3), style, { hip: true, fp });
  patioTrees(p, rng, patio, rng.int(2, 4), lot.z, fp);
  for (const side of CAMERA_SIDES) if (lot.open.includes(side)) p.slots.push(...slotsIn(neonRun(lot, side, lot.z, p.slots.length), fp));
  p.courtyard = patio;
  return p;
}

export const COURTYARD: readonly RecipeDef[] = [
  { name: "courtyardO", recipe: courtyardO, family: "courtyard" },
  { name: "courtyardU", recipe: courtyardU, family: "courtyard" },
  { name: "courtyardC", recipe: courtyardC, family: "courtyard" },
  { name: "patioResidential", recipe: patioResidential, family: "courtyard" },
];
