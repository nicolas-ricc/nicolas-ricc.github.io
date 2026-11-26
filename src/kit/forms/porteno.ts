import { v3, type Vec2 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import { addBuilding, banded, emptyPiece, fitToCap, floorsFor, interlock, recipeCap } from "../piece";
import { axisNormal, clipConvex, clipHalf, clipToPoly, frustum, insetPoly, insidePoly, polyArea, polyCentroid, polyCornice, polyFootprint } from "../polygon";
import { CORNICE_H, offsetFootprint } from "../roofs";
import type { Lot, Piece, RecipeDef, Side, Style } from "../types";
import { chamferCorner } from "./composite";
import { ring } from "./courtyard";
import { CAMERA_SIDES, neonRun } from "./lowrise";

/** The parcel helpers the issue places in this module live in `src/kit/polygon.ts` (no import cycles); re-exported here. */
export { FLAT_COS, RIGHT_COS, chamferPoly, clipBody, clipConvex, clipHalf, clipToPoly, frustum, insetPoly, insidePoly, polyArea, polyCentroid, polyCornice, polyFootprint } from "../polygon";

/**
 * Lot footprint at `inset`, chamfered `chamfer`. With `poly` it is also cut to the lot-level chamfer and to the 2 oblique
 * cut of the existing recipes: an inset chamfer falls short of the lot's corner, and a wedge edge of 6..7.2 is too short
 * for a 2.4 cut (edges > 3k) but not for a 2 one.
 */
function insetFootprint(lot: Lot, inset: number, chamfer: number): Vec2[] {
  const fp = polyFootprint(lot, inset, chamfer);
  return lot.poly ? clipConvex(clipConvex(fp, polyFootprint(lot, 0, chamfer)), polyFootprint(lot, 0, 2, "oblique")) : fp;
}

/** `MIN_BODY_H`: the least body under the turret, so a low cap (the casco's was 8.5 before #495) still gets its cupola over one floor. */
const CUPOLA_H = 2.5 + 2 + 1.2, CUPOLA_R = 2, WING_T = 5, MIN_BODY_H = 2.5;

/** Corner block: a ring of wings clipped to the parcel, stacked floors with trim slabs, and a copper-domed turret over the open corner (decision T4). */
export function cornerCupola(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, fp = insetFootprint(lot, 0, 2.4);
  const turretH = recipeCap(lot) - CUPOLA_H, hr = banded(lot, 5.5 + 3 * rng.next(), 5.5, 8.5) - (lot.band ? CUPOLA_H : 0), roofed = turretH >= MIN_BODY_H; // with less body than that the turret is dropped
  const h = Math.min(hr, roofed ? turretH : recipeCap(lot)), floors = floorsFor(h, style), fh = h / floors;
  const { wings, patio } = ring(lot, WING_T, ["n", "s", "w", "e"]), built: Vec2[][] = [];
  for (const { rect } of wings) {
    const wing = clipToPoly(rect, fp), cols = rng.int(3, 4), f: Facade = { floors: 1, cols };
    if (wing.length < 3 || polyArea(wing) < 4) continue;
    built.push(wing);
    for (let k = 0; k < floors; k++) {
      const zk = z + k * fh;
      addBuilding(p, { kind: "poly", footprint: wing, z: zk, h: fh - 0.15, mat: style.mat, facade: f, tone: style.tone }, f);
      p.solids.push(interlock({ kind: "poly", footprint: offsetFootprint(wing, 0.25), z: zk + fh - 0.15, h: 0.15, mat: style.trim }));
    }
  }
  const corner = chamferCorner(lot.open), q = { x: corner[1] === "e" ? lot.x + lot.w : lot.x, y: corner[0] === "s" ? lot.y + lot.d : lot.y };
  const mid = polyCentroid(fp), len = Math.hypot(mid.x - q.x, mid.y - q.y), r2 = CUPOLA_R + 0.2;
  const onWings = (c: Vec2): boolean => built.some((w) => insidePoly(w, c)) && Array.from({ length: 16 }, (_, i) => ({ x: c.x + CUPOLA_R * Math.cos((i * Math.PI) / 8), y: c.y + CUPOLA_R * Math.sin((i * Math.PI) / 8) })).every((pt) => built.some((w) => insidePoly(w, pt)));
  let c: Vec2 | null = null; // the turret stands only where its whole disk is over the wings
  for (let t = 0; roofed && len > 0 && t <= len && !c; t += 0.1) {
    const s = { x: q.x + ((mid.x - q.x) * t) / len, y: q.y + ((mid.y - q.y) * t) / len };
    if (onWings(s)) c = s;
  }
  if (roofed && !c) { // the walk met a wedge or the patio: the point of a 0.25 grid nearest to the corner
    const xs = fp.map((v) => v.x), ys = fp.map((v) => v.y);
    const grid: { g: Vec2; dd: number }[] = []; // nearest to the corner first (stable: ties keep x, y order)
    const x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let x = Math.min(...xs); x <= x1; x += 0.25) for (let y = y0; y <= y1; y += 0.25) grid.push({ g: { x, y }, dd: Math.hypot(x - q.x, y - q.y) });
    c = grid.sort((m, n) => m.dd - n.dd).find((e) => insidePoly(fp, e.g) && onWings(e.g))?.g ?? null;
  }
  const top = z + h;
  if (c) p.solids.push(
    { kind: "cylinder", at: v3(c.x, c.y, top), r: CUPOLA_R, h: 2.5, mat: style.mat },
    { kind: "dome", at: v3(c.x, c.y, top + 2.5), r: r2, h: 2, mat: "copper" },
    { kind: "cone", at: v3(c.x, c.y, top + 4.5), r: 0.3, h: 1.2, mat: style.trim },
  );
  p.courtyard = patio;
  return fitToCap(p, lot);
}

const DORMER = { along: 1.4, deep: 0.8, h: 1.6 };

/** Mansard block: 4..5 floors, cornice, a frustum roof inset 0.8 to 2, and 3 dormers on each south or east edge of 6 or more (decision T5). */
export function mansard(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, floors = rng.int(4, 5);
  const fp = insetFootprint(lot, 1, 2.4);
  if (fp.length < 3 || polyArea(fp) < 4) return p;
  const roofed = recipeCap(lot) - CORNICE_H - 2.2 >= 3, h = Math.min(lot.band ? banded(lot, floors, 4, 5) - CORNICE_H - 2.2 : floors * style.floorH, recipeCap(lot) - CORNICE_H - (roofed ? 2.2 : 0)), f: Facade = { floors: floorsFor(h, style), cols: 3 };
  addBuilding(p, { kind: "poly", footprint: fp, z, h, mat: style.mat, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "poly", footprint: offsetFootprint(fp, 0.4), z: z + h, h: CORNICE_H, mat: style.trim });
  const top = z + h + CORNICE_H, base = insetPoly(fp, 0.8), tip = insetPoly(fp, 2);
  if (!roofed || !base || !tip) return fitToCap(p, lot);
  p.solids.push(frustum(base, tip, top, top + 2.2, style.roof));
  const d: Facade = { floors: 1, cols: 1 };
  fp.forEach((a, i) => {
    const b = fp[(i + 1) % fp.length]!, dx = b.x - a.x, dy = b.y - a.y, n = axisNormal(fp, a, b);
    if (!n || Math.hypot(dx, dy) < 6 || (n.y !== 1 && n.x !== 1)) return; // axis-aligned, south or east only
    const ny = n.y;
    for (const t of [0.25, 0.5, 0.75]) {
      const cx = a.x + dx * t, cy = a.y + dy * t;
      const [w, dd] = ny === 1 ? [DORMER.along, DORMER.deep] : [DORMER.deep, DORMER.along];
      addBuilding(p, prism(ny === 1 ? cx - w / 2 : a.x - w, ny === 1 ? a.y - dd : cy - dd / 2, top, w, dd, DORMER.h, style.mat, { facade: d }), d);
    }
  });
  return fitToCap(p, lot);
}

const NORMAL: Record<Side, Vec2> = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } };
const sideOf = (n: Vec2): Side => (n.y === 1 ? "s" : n.y === -1 ? "n" : n.x === 1 ? "e" : "w");
const RAIL = { w: 0.1, h: 0.9 }, SLAB = { deep: 1, h: 0.25 };

/** Glass-base block with a cantilevered balcony slab and railing per floor on every axis-aligned edge of each open side, and a set-back top floor. */
export function balconyBlock(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, fp = insetFootprint(lot, 1, 2);
  if (fp.length < 3 || polyArea(fp) < 4) return p;
  const drawn = rng.int(3, 5), h = lot.band ? Math.min(banded(lot, drawn, 3, 5), recipeCap(lot) - CORNICE_H) : Math.min(Math.max(10, 3.2 * drawn), 16, recipeCap(lot) - CORNICE_H);
  const floors = lot.band ? Math.max(3, Math.round(h / 3.2)) : drawn, fh = h / floors, m = floors - 1; // banded: the floors follow the zoned height
  const f: Facade = { floors: m, cols: 3, base: "glass" };
  addBuilding(p, { kind: "poly", footprint: fp, z, h: m * fh, mat: style.mat, facade: f, tone: style.tone }, f);
  p.solids.push(interlock({ kind: "poly", footprint: offsetFootprint(fp, 0.3), z: z + m * fh, h: 0.3, mat: style.trim }));
  const up = insetFootprint(lot, 3, 2);
  if (up.length >= 3 && polyArea(up) >= 4) {
    const g: Facade = { floors: 1, cols: 2 };
    addBuilding(p, { kind: "poly", footprint: up, z: z + m * fh + 0.3, h: fh - 0.3, mat: style.mat, facade: g, tone: style.tone }, g);
  }
  const sides = lot.open.length ? lot.open : ["s" as Side];
  fp.forEach((a, i) => {
    const b = fp[(i + 1) % fp.length]!, n = axisNormal(fp, a, b);
    if (!n || !sides.includes(sideOf(n))) return;
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), len = Math.hypot(b.x - a.x, b.y - a.y);
    const [w, d] = n.y !== 0 ? [len, SLAB.deep] : [SLAB.deep, len];
    for (let j = 1; j < m; j++) {
      const zj = z + j * fh, bx = n.x === 1 ? x0 : n.x === -1 ? x0 - SLAB.deep : x0, by = n.y === 1 ? y0 : n.y === -1 ? y0 - SLAB.deep : y0;
      p.solids.push(prism(bx, by, zj, w, d, SLAB.h, style.trim));
      const edge = a.x + n.x * (SLAB.deep - RAIL.w / 2), edgeY = a.y + n.y * (SLAB.deep - RAIL.w / 2), zr = zj + SLAB.h + RAIL.h / 2;
      p.solids.push({ kind: "beam", from: v3(n.x !== 0 ? edge : a.x, n.y !== 0 ? edgeY : a.y, zr), to: v3(n.x !== 0 ? edge : b.x, n.y !== 0 ? edgeY : b.y, zr), w: RAIL.w, h: RAIL.h, mat: "steel" });
    }
  });
  return fitToCap(p, lot);
}

const PORTAL = { w: 3, h: 4, deep: 2 }, UPPER_BAND = 0.6;

/** Shopfront base (front = first open camera side, else the first open side, else south) with a 3 × 4 × 2 portal (stone lintel on two columns) on the front face, a marked cornice, an upper body with vertical windows and neon runs on the base's front faces. */
export function portalBase(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, fp = insetFootprint(lot, 1, 2.4), front = lot.open.find((o) => CAMERA_SIDES.includes(o)) ?? lot.open[0] ?? "s";
  if (fp.length < 3 || polyArea(fp) < 4) return p;
  const baseH = 2 * style.floorH, nf = NORMAL[front];
  const cols = Math.max(2, Math.round(Math.max(...fp.map((a, i) => { const b = fp[(i + 1) % fp.length]!; return Math.hypot(b.x - a.x, b.y - a.y); })) / 2));
  const f: Facade = { floors: 2, cols, base: "glass" };
  const base = (shape: Vec2[]): void => { if (shape.length >= 3 && polyArea(shape) >= 1) addBuilding(p, { kind: "poly", footprint: shape, z, h: baseH, mat: style.mat, facade: f, tone: style.tone }, f); };
  const ux = nf.x !== 0 ? 0 : 1, uy = nf.x !== 0 ? 1 : 0; // tangent axis of the front face
  const len = ([a, b]: readonly [Vec2, Vec2]): number => Math.hypot(b.x - a.x, b.y - a.y);
  const edge = fp.map((a, i): [Vec2, Vec2] => [a, fp[(i + 1) % fp.length]!])
    .filter(([a, b]) => { const n = axisNormal(fp, a, b); return !!n && n.x === nf.x && n.y === nf.y && len([a, b]) >= 5; })
    .reduce<[Vec2, Vec2] | null>((best, e) => (!best || len(e) > len(best) ? e : best), null);
  if (!edge) base(fp);
  else {
    const [a, b] = edge, cu = ((a.x + b.x) * ux + (a.y + b.y) * uy) / 2, face = a.x * nf.x + a.y * nf.y, fc = nf.x !== 0 ? a.x : a.y, u0 = a.x * ux + a.y * uy, u1 = b.x * ux + b.y * uy;
    const lo = cu - PORTAL.w / 2, hi = cu + PORTAL.w / 2;
    const before = clipHalf(fp, ux, uy, lo), after = clipHalf(fp, -ux, -uy, -hi);
    base(before); base(after);
    base(clipHalf(clipHalf(clipHalf(fp, -ux, -uy, -lo), ux, uy, hi), nf.x, nf.y, face - PORTAL.deep));
    // gap box: tangent lo..hi, depth face - deep..face
    const back = (nf.x + nf.y > 0 ? fc - PORTAL.deep : fc), gx = nf.x !== 0 ? back : lo, gy = nf.x !== 0 ? lo : back;
    const [gw, gd] = nf.x !== 0 ? [PORTAL.deep, PORTAL.w] : [PORTAL.w, PORTAL.deep];
    p.solids.push(prism(gx, gy, z + PORTAL.h, gw, gd, baseH - PORTAL.h, "stone"));
    for (const t of [lo + 0.3, hi - 0.3]) {
      const d = fc - 0.3 * (nf.x + nf.y); // column centre, 0.3 inside the face
      p.solids.push({ kind: "cylinder", at: v3(nf.x !== 0 ? d : t, nf.x !== 0 ? t : d, z), r: 0.3, h: PORTAL.h, mat: "stone" });
    }
    if (CAMERA_SIDES.includes(front)) {
      const seg = (s0: number, s1: number): Rect => {
        const tan = s0, len = s1 - s0, dep = 1;
        return nf.x !== 0 ? { x: nf.x > 0 ? fc - dep : fc, y: tan, w: dep, d: len } : { x: tan, y: nf.y > 0 ? fc - dep : fc, w: len, d: dep };
      };
      let shop = 0;
      for (const [s0, s1] of [[Math.min(u0, u1), lo], [hi, Math.max(u0, u1)]] as const) {
        if (s1 - s0 < 2) continue;
        const slots = neonRun(seg(s0, s1), front, z, shop);
        p.slots.push(...slots); shop += slots.length;
      }
    }
  }
  const band = z + baseH, top = band + UPPER_BAND, roomH = recipeCap(lot) - top + z - CORNICE_H;
  p.solids.push({ kind: "poly", footprint: offsetFootprint(fp, 0.6), z: band, h: UPPER_BAND, mat: style.trim });
  const upperH = Math.min(lot.band ? banded(lot, rng.int(2, 4), 2, 4) - (top - z) - CORNICE_H : rng.int(2, 4) * style.floorH, roomH);
  if (upperH >= 1) {
    const uf = floorsFor(upperH, style), g: Facade = { floors: uf, cols, window: { w: 0.3, h: 1.4 / style.floorH } };
    addBuilding(p, { kind: "poly", footprint: fp, z: top, h: upperH, mat: style.mat, facade: g, tone: style.tone }, g);
    p.solids.push(polyCornice(fp, top + upperH, style.trim));
  }
  return fitToCap(p, lot);
}

export const PORTENO: readonly RecipeDef[] = [
  { name: "cornerCupola", recipe: cornerCupola, family: "porteno", poly: true },
  { name: "mansard", recipe: mansard, family: "porteno", poly: true },
  { name: "balconyBlock", recipe: balconyBlock, family: "porteno", poly: true },
  { name: "portalBase", recipe: portalBase, family: "porteno", poly: true },
];
