import { v3, type Vec2, type Vec3 } from "../../iso/geometry";
import { shadeTone } from "../../iso/light";
import { ribs, type Plate } from "../../iso/plate";
import { GABLE_RATIO, type Solid } from "../../iso/solids";
import type { Material } from "../../map/palette-iso";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import { jungle } from "../../scenes/flora";
import type { Rng } from "../../map/seed";
import { awning, chair, fence, garland, rooftopGarden, table } from "../props";
import { gableRoof } from "../roofs";
import { addBuilding, emptyPiece, recipeCap, shiftTone } from "../piece";
import type { Lot, Piece, RecipeDef, Side, Style, Window } from "../types";
import { SIDES, WALL_NORMALS, sawtooth, stackContainers, storeroom, tonePiece } from "./industrial";
import { neonSlot } from "./lowrise";

/**
 * `reconversion` family (#322): industrial buildings given a new use. Windows of the
 * sawtooth teeth and of gable halls come from glass plates, since neither admits `facade`.
 */
const PANE_GAP = 0.2;

/** Windows of `plate` on the edge `plate.wall` of the rectangle (wall 0 north, 1 east, 2 south, 3 west, each running clockwise as in `rect`), split into `panes` equal ones along the plate, `PANE_GAP` apart. */
export function plateWindows(r: { at: Vec3; w: number; d: number }, plate: Plate, floor: number, building: number, panes = 1): Window[] {
  const { x, y } = r.at, x1 = x + r.w, y1 = y + r.d;
  const [a, b] = [[{ x, y }, { x: x1, y }], [{ x: x1, y }, { x: x1, y: y1 }], [{ x: x1, y: y1 }, { x, y: y1 }], [{ x, y: y1 }, { x, y }]][plate.wall]!;
  const len = Math.hypot(b!.x - a!.x, b!.y - a!.y), span = (plate.u1 - plate.u0) * len;
  const pane = (span - PANE_GAP * (panes - 1)) / panes;
  const at = (u: number, z: number): Vec3 => v3(a!.x + (b!.x - a!.x) * u, a!.y + (b!.y - a!.y) * u, z);
  return Array.from({ length: panes }, (_, k) => {
    const u0 = plate.u0 + (k * (pane + PANE_GAP)) / len, u1 = u0 + pane / len;
    return { pts: [at(u0, plate.z0), at(u1, plate.z0), at(u1, plate.z1), at(u0, plate.z1)], floor, wall: WALL_NORMALS[plate.wall]!, building };
  });
}

/** Publishes the glass plates of solid `building` on walls 1 and 2 (the ones facing the camera) as windows of `floor`. */
export function publishGlass(p: Piece, building: number, floor: number, panes = 1): void {
  const s = p.solids[building];
  if (!s || !("plates" in s) || !s.plates || !("w" in s) || !("d" in s)) return;
  for (const plate of s.plates) {
    if (plate.mat === "glass" && (plate.wall === 1 || plate.wall === 2)) p.windows.push(...plateWindows(s, plate, floor, building, panes));
  }
}

/** Panes per tooth plate: about one per 4 of plate length. */
const toothPanes = (d: number): number => Math.max(2, Math.round((0.9 * d) / 4));

/** Two-floor brick loft: sawtooth over the east two thirds (windows from the teeth on floor 2) and a green terrace on the west third. */
export function loftHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, toothH = 2, terrace = 2.3;
  const h = Math.min(rng.int(7, 9), recipeCap(lot) - terrace);
  const facade = { floors: 2, cols: Math.max(1, Math.round(w / 3.5)), base: "glass" as const };
  addBuilding(p, prism(x, y, z, w, d, h, style.mat, { facade }), facade);
  const first = p.solids.length;
  sawtooth(p.solids, { x: x + w / 3, y, w: (2 * w) / 3, d }, z, h, toothH, style.roof, "glass");
  for (let i = first; i < p.solids.length; i++) publishGlass(p, i, 2, toothPanes(d));
  p.solids.push(...rooftopGarden(v3(x + 0.5, y + 0.5, z + h), w / 3 - 0.5, d - 1, rng));
  return tonePiece(p, tone);
}

/**
 * Frame of the front `open[0]` (south without `open`): `u` runs along it (+x for n/s, +y for e/w), `v` goes inward from its edge.
 * `wall` is the plate index of that side.
 */
export function frontFrame(lot: Lot): { side: Side; wall: number; len: number; depth: number; rect(u: number, v: number, du: number, dv: number): Rect; point(u: number, v: number): Vec2 } {
  const side = lot.open[0] ?? "s", { x, y, w, d } = lot, along = side === "n" || side === "s";
  return {
    side, wall: SIDES.indexOf(side), len: along ? w : d, depth: along ? d : w,
    rect: (u, v, du, dv) => {
      switch (side) {
        case "s": return { x: x + u, y: y + d - v - dv, w: du, d: dv };
        case "n": return { x: x + u, y: y + v, w: du, d: dv };
        case "e": return { x: x + w - v - dv, y: y + u, w: dv, d: du };
        case "w": return { x: x + v, y: y + u, w: dv, d: du };
      }
    },
    point: (u, v) => {
      switch (side) {
        case "s": return { x: x + u, y: y + d - v };
        case "n": return { x: x + u, y: y + v };
        case "e": return { x: x + w - v, y: y + u };
        case "w": return { x: x + v, y: y + u };
      }
    },
  };
}

/** Barrel-vaulted brick loft: a body with a glazed gable end on the front, a mezzanine deck sticking out of it and a vault roof. */
export function vaultLoft(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { z } = lot, vaultH = 3, f = frontFrame(lot);
  const h = Math.min(4, recipeCap(lot) - vaultH);
  const len = Math.min(18, f.len - 2), depth = Math.min(10, f.depth - 3), u0 = (f.len - len) / 2;
  const r = f.rect(u0, 2, len, depth);
  const facade = { floors: 1, cols: 4 };
  const body = prism(r.x, r.y, z, r.w, r.d, h, style.mat, { facade });
  body.plates = [{ wall: f.wall, shape: "rect", u0: 0.25, u1: 0.75, z0: z + 0.2, z1: z + h - 0.2, mat: "glass", toneOffset: 1 }];
  addBuilding(p, body, facade);
  const axis = f.side === "n" || f.side === "s" ? "x" : "y";
  p.solids.push({ kind: "vault", at: v3(r.x, r.y, z + h), len: axis === "x" ? r.w : r.d, w: axis === "x" ? r.d : r.w, h: vaultH, axis, mat: style.roof, segments: 6 });
  const m = f.rect(u0 + 0.25 * len, 1, 0.5 * len, 1);
  p.solids.push(prism(m.x, m.y, z + 2.5, m.w, m.d, 0.3, "deck"));
  return tonePiece(p, tone);
}

/**
 * Brewery: a terrace with tables under a garland on the front, a glazed strip with two neon signs, copper tanks
 * and a gable hall (flat body with facade, gable roof on top) in the back half.
 */
export function brewery(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { z } = lot, f = frontFrame(lot), glassH = 4, roofH = 1.5;
  const h = Math.min(6, recipeCap(lot) - 2.1);
  const hall = f.rect(0, f.depth / 2, f.len, f.depth / 2);
  const facade = { floors: 1, cols: 3 };
  addBuilding(p, prism(hall.x, hall.y, z, hall.w, hall.d, h, style.mat, { facade }), facade);
  p.solids.push(...gableRoof({ ...hall, z: z + h }, roofH, style.roof));
  const strip = f.rect(0, 2.5, f.len, 0.3);
  p.solids.push(prism(strip.x, strip.y, z, strip.w, strip.d, glassH, "glass"));
  const n = Math.min(rng.int(3, 5), Math.floor((f.len + 1) / 3.4));
  const u0 = (f.len - (n * 2.4 + (n - 1))) / 2 + 1.2;
  for (let k = 0; k < n; k++) {
    const c = f.point(u0 + k * 3.4, 4.2), at = v3(c.x, c.y, z);
    p.solids.push({ kind: "cylinder", at, r: 1.2, h: 4.5, mat: "copper" }, { kind: "cone", at: v3(c.x, c.y, z + 4.5), r: 1.2, h: 1, mat: "copper" });
  }
  const post = (u: number): void => { const r = f.rect(u - 0.1, 0.4, 0.2, 0.2); p.solids.push(prism(r.x, r.y, z, r.w, r.d, 3, "steel")); };
  post(1); post(f.len - 1);
  const top = (u: number, dz: number): Vec3 => { const q = f.point(u, 0.5); return v3(q.x, q.y, z + 3 - dz); };
  p.accents.push(...garland([top(1, 0), top(f.len / 2, 0.4), top(f.len - 1, 0)]));
  const tables = rng.int(2, 3), span = f.len - 5;
  for (let k = 0; k < tables; k++) {
    const u = 2.5 + (span * (k + 0.5)) / tables, t = f.rect(u - 0.5, 0.8, 1, 1), c1 = f.rect(u - 0.25, 0.2, 0.5, 0.5), c2 = f.rect(u - 0.25, 1.9, 0.5, 0.5);
    p.solids.push(...table(v3(t.x, t.y, z)), ...chair(v3(c1.x, c1.y, z)), ...chair(v3(c2.x, c2.y, z)));
  }
  [0, 1].forEach((shop) => p.slots.push(neonSlot(f.rect(shop * f.len / 2, 2.5, f.len / 2, 0.3), f.side, 3, z, shop)));
  return tonePiece(p, tone);
}

/** Sheet gable hall turned loft: ribs on the long walls and three 2.5-wide glass plates on each, no door. */
export function sheetLoft(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(6, recipeCap(lot) / (1 + GABLE_RATIO));
  const mat = rng.pick<Material>(["sheetGreen", "sheetTeal"]);
  const hall = prism(x, y, z, w, d, h, mat, { roof: "gable", roofMat: mat });
  const plates: Plate[] = [], len = w >= d ? w : d, z1 = z + Math.min(4.5, h - 0.5);
  const walls = w >= d ? [0, 2] : [3, 1];
  for (const wall of walls) plates.push(...ribs(wall, len, z, z + h, shadeTone(WALL_NORMALS[wall]!) === "lit", mat));
  for (const wall of walls) for (let k = 0; k < 3; k++) {
    const c = (k + 0.5) / 3, half = 1.25 / len;
    plates.push({ wall, shape: "rect", u0: c - half, u1: c + half, z0: z + 1, z1, mat: "glass" });
  }
  hall.plates = plates;
  p.solids.push(hall);
  publishGlass(p, 0, 1);
  return tonePiece(p, tone);
}

/** Abandoned sawtooth hall: 1..2 teeth gone leaving ridge beam and rafters, jungle growing through the gaps; no facade, walls one tone darker. */
export function derelictHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, toothH = 2, cap = recipeCap(lot);
  const h = Math.min(rng.int(6, 9), cap - 2), base = z + h;
  p.solids.push(prism(x, y, z, w, d, h, style.mat));
  const n = Math.min(rng.int(4, 5), Math.floor(w / 4)), x0 = x + (w - 4 * n) / 2;
  const teeth: Solid[] = [];
  sawtooth(teeth, { x: x0, y, w: 4 * n, d }, z, h, toothH, style.roof, "glass");
  const gone = new Set<number>(), missing = Math.min(rng.int(1, 2), n - 1);
  while (gone.size < missing) gone.add(rng.int(0, n - 1));
  const gaps = [...gone].sort((a, b) => a - b);
  teeth.forEach((t, k) => { if (!gone.has(k)) p.solids.push(t); });
  for (const k of gaps) {
    const ridge = x0 + 4 * (k + 1), top = base + 2 - 0.15; // beam is 0.3 thick, centred on its axis: top stays within the cap
    p.solids.push({ kind: "beam", from: v3(ridge, y, top), to: v3(ridge, y + d, top), w: 0.3, h: 0.3, mat: "steel" });
    for (const yj of [y + 0.5, y + d - 0.5]) p.solids.push({ kind: "beam", from: v3(x0 + 4 * k, yj, base), to: v3(ridge, yj, top), w: 0.3, h: 0.3, mat: "steel" });
  }
  const first = p.solids.length;
  for (let i = gaps.length > 0 ? rng.int(4, 6) : 0; i > 0; i--) { // no gap (a lot under 8 wide): no jungle
    const cx = x0 + 4 * rng.pick(gaps) + 2;
    jungle(p.solids, rng, { x0: cx, x1: cx, y0: y + 2, y1: y + d - 2 }, 1, base);
  }
  for (let i = first; i < p.solids.length; i++) {
    const c = p.solids[i]!;
    if (c.kind === "cone") p.solids[i] = { ...c, r: Math.min(c.r, 2), h: Math.min(c.h, cap - h) };
  }
  const t = tonePiece(p, tone);
  t.solids[0] = { ...t.solids[0]!, tone: shiftTone(tone, -1) };
  return t;
}

/**
 * Covered market: no closed body. Thin walls on the sides that are not open, steel pillars and awnings on `open[0]`/`open[1]`,
 * a roof slab with sawtooth teeth (windows on floor 1), a garland under the front and 6..9 stalls in rows parallel to it.
 */
export function coveredMarket(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, wallT = 0.3, post = 0.4;
  const h = Math.min(6, recipeCap(lot) - 2), f = frontFrame(lot);
  const open = new Set<Side>([f.side, ...(lot.open[1] ? [lot.open[1]] : [])]);
  const wx0 = x + (open.has("w") ? post : 0), wx1 = x + w - (open.has("e") ? post : 0);
  const wy0 = y + (open.has("n") ? post : 0), wy1 = y + d - (open.has("s") ? post : 0);
  if (!open.has("n")) p.solids.push(prism(wx0, y, z, wx1 - wx0, wallT, h - 0.3, style.mat));
  if (!open.has("s")) p.solids.push(prism(wx0, y + d - wallT, z, wx1 - wx0, wallT, h - 0.3, style.mat));
  if (!open.has("w")) p.solids.push(prism(x, wy0, z, wallT, wy1 - wy0, h - 0.3, style.mat));
  if (!open.has("e")) p.solids.push(prism(x + w - wallT, wy0, z, wallT, wy1 - wy0, h - 0.3, style.mat));
  const seen = new Set<string>();
  for (const side of open) {
    const g = frontFrame({ ...lot, open: [side] }), n = Math.max(1, Math.round(g.len / 3.5)), step = g.len / n;
    for (let i = 0; i <= n; i++) {
      const r = g.rect(Math.min(Math.max(i * step - post / 2, 0), g.len - post), 0, post, post), key = `${r.x.toFixed(3)},${r.y.toFixed(3)}`;
      if (!seen.has(key)) { seen.add(key); p.solids.push(prism(r.x, r.y, z, r.w, r.d, h - 0.3, "steel")); }
      if (i < n) { const a = g.rect(i * step + post / 2, -0.8, step - post, 0.8); p.solids.push(...awning(v3(a.x, a.y, z + 3), step - post, side)); }
    }
  }
  p.solids.push(prism(x, y, z + h - 0.3, w, d, 0.3, style.trim));
  const first = p.solids.length;
  sawtooth(p.solids, { x, y, w, d }, z, h, 2, style.roof, "glass");
  for (let i = first; i < p.solids.length; i++) publishGlass(p, i, 1, toothPanes(d));
  const line = (u: number): Vec3 => { const q = f.point(u, 0.2); return v3(q.x, q.y, z + h - 0.6); };
  p.accents.push(...garland([line(0.2), line(f.len - 0.2)]));
  const bays = Math.max(1, Math.round(f.len / 3.5)), bay = f.len / bays;
  const rows: number[] = [];
  for (let v = 2; v + 1.5 <= f.depth - wallT; v += 3.5) rows.push(v);
  const spots = rows.flatMap((v) => Array.from({ length: bays }, (_, k) => ({ v, u: (k + 0.5) * bay })));
  const count = Math.min(rng.int(6, 9), spots.length);
  for (const { v, u } of spots.slice(0, count)) {
    const s = f.rect(u - 1, v, 2, 1.5);
    p.solids.push(prism(s.x, s.y, z, s.w, s.d, 1.8, rng.pick<Material>(["whitewash", "copper", "rust"])));
  }
  return tonePiece(p, tone);
}

/**
 * Freight shed: a loading dock along the whole front, a gable hall at the back on the west (north for e/w fronts) side
 * and 2..3 trucks parked head-on to the dock in the side yard. The trucks do not stand in front of the shed: an 8-long
 * truck does not fit in the 3-deep strip of a 21×10 lot.
 */
export function freightShed(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { z } = lot, f = frontFrame(lot), dockH = 1.2, dockD = 1.5, strip = 3;
  const h = Math.min(rng.int(5, 7), recipeCap(lot) / (1 + GABLE_RATIO));
  let n = rng.int(2, 3);
  const yardFor = (k: number): number => k * 2.4 + (k - 1) + 1;
  while (n > 1 && yardFor(n) > f.len - 6) n--;
  const yard = yardFor(n), shedLen = f.len - yard;
  const r = f.rect(0, strip, shedLen, f.depth - strip);
  const hall = prism(r.x, r.y, z, r.w, r.d, h, style.mat, { roof: "gable", roofMat: style.roof });
  const wallsFor = r.w >= r.d ? [0, 2] : [3, 1], len = Math.max(r.w, r.d), half = 0.75 / len;
  const hp: Plate[] = [];
  for (const wall of wallsFor) hp.push(...ribs(wall, len, z, z + h, shadeTone(WALL_NORMALS[wall]!) === "lit", style.mat));
  for (const wall of wallsFor) for (let k = 0; k < 2; k++) {
    const c = (k + 1) / 3;
    hp.push({ wall, shape: "rect", u0: c - half, u1: c + half, z0: z + 1, z1: z + h - 1, mat: "glass" });
  }
  hall.plates = hp;
  p.solids.push(hall);
  publishGlass(p, 0, 1);
  const dock = f.rect(0, 0, f.len, dockD);
  p.solids.push(prism(dock.x, dock.y, z, dock.w, dock.d, dockH, "concrete"));
  for (let k = 0; k < n; k++) {
    const u = shedLen + 0.5 + k * 3.4, box = f.rect(u, dockD, 2.4, 6), cab = f.rect(u, dockD + 6, 2.4, 2);
    p.solids.push(prism(box.x, box.y, z, box.w, box.d, 2.8, rng.pick<Material>(["rust", "steel"])));
    p.solids.push(prism(cab.x, cab.y, z, cab.w, cab.d, 2.2, "steel"));
  }
  const pallets = rng.int(2, 4), gap = (f.len - 2 * 1.5) / pallets;
  for (let k = 0; k < pallets; k++) {
    const q = f.rect(1.5 + k * gap + (gap - 1.2) / 2, 0.25, 1.2, 1);
    p.solids.push(prism(q.x, q.y, z + dockH, q.w, q.d, 0.5, "deck"));
  }
  return tonePiece(p, tone);
}

/** Open dock: storeroom in the back-west corner, 2..3 one-high containers in a row, a forklift and pallets on the front strip, fenced on three sides (not the front). Nothing over 3. */
export function openDock(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, f = frontFrame(lot), along = f.side === "n" || f.side === "s" ? "x" : "y";
  const fenced = fence(v3(x, y, z), w, d);
  fenced.splice({ n: 0, s: 1, w: 2, e: 3 }[f.side], 1);
  p.solids.push(...fenced);
  const n = Math.min(rng.int(2, 3), Math.max(1, Math.floor((f.len + 1) / 7))), u0 = (f.len - (6 * n + (n - 1))) / 2;
  for (let k = 0; k < n; k++) {
    const c = f.rect(u0 + k * 7, f.depth / 2 - 2.4, 6, 2.4);
    p.solids.push(...stackContainers(v3(c.x, c.y, z), 1, along, rng));
  }
  const fk = f.rect(1, 0.3, 3, 2);
  p.solids.push(prism(fk.x, fk.y, z, fk.w, fk.d, 2, "rust"));
  const pallets = Math.min(rng.int(2, 4), Math.floor((f.len - 7.2) / 3.5) + 1);
  for (let k = 0; k < pallets; k++) {
    const q = f.rect(6 + k * 3.5, 0.4, 1.2, 1);
    p.solids.push(prism(q.x, q.y, z, q.w, q.d, 0.5, "deck"));
  }
  const sub = f.rect(0, f.depth - 5, 6, 5);
  const room = storeroom({ ...lot, x: sub.x, y: sub.y, w: sub.w, d: sub.d, open: [] }, rng, style);
  // the storeroom takes the piece's tone, not its own
  p.solids.push(...room.solids.map((q) => { const c = { ...q }; delete c.tone; return c; }));
  return tonePiece(p, tone);
}

export const RECONVERSION: readonly RecipeDef[] = [
  { name: "loftHall", recipe: loftHall, family: "reconversion" },
  { name: "vaultLoft", recipe: vaultLoft, family: "reconversion" },
  { name: "brewery", recipe: brewery, family: "reconversion" },
  { name: "sheetLoft", recipe: sheetLoft, family: "reconversion" },
  { name: "derelictHall", recipe: derelictHall, family: "reconversion" },
  { name: "coveredMarket", recipe: coveredMarket, family: "reconversion" },
  { name: "freightShed", recipe: freightShed, family: "reconversion" },
  { name: "openDock", recipe: openDock, family: "reconversion" },
];
