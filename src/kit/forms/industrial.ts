import type { Accent } from "../../iso/accent";
import { v3, type Vec2, type Vec3 } from "../../iso/geometry";
import { shadeTone } from "../../iso/light";
import { ribs, type Plate } from "../../iso/plate";
import { GABLE_RATIO, bounds, type Solid } from "../../iso/solids";
import type { Material } from "../../map/palette-iso";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import { addBuilding, emptyPiece, fitToCap, recipeCap, shiftTone } from "../piece";
import type { Lot, Piece, RecipeDef, Side, Style } from "../types";

/**
 * `industrial` family (#321): sawtooth and sheet halls, container yards, stockpile,
 * tanks, quay crane, RTG gantry and storeroom. Exported builders are pure and carry
 * no tone: the recipe (or the scene that reuses them) applies it.
 */
const TOOTH_W = 4;
const WALL_NORMALS = [v3(0, -1, 0), v3(1, 0, 0), v3(0, 1, 0), v3(-1, 0, 0)]; // plate wall index: 0 N, 1 E, 2 S, 3 W
const SIDES: readonly Side[] = ["n", "e", "s", "w"];

/** The piece with `tone` on every solid (the field is omitted when 0, as `prism` does). */
const tonePiece = (p: Piece, tone: number): Piece => (tone === 0 ? p : { ...p, solids: p.solids.map((s) => ({ ...s, tone })) });

/** Door plate centered on a wall of length `len`: `width` wide and `h` tall from `z0`, `mat` that of the wall, two tones darker. */
export function door(wall: number, len: number, width: number, z0: number, h: number, mat: Material): Plate {
  const u0 = (1 - width / len) / 2;
  return { wall, shape: "rect", u0, u1: u0 + width / len, z0, z1: z0 + h, mat, toneOffset: -2 };
}

/** Sawtooth roof: floor(w/4) ramps 4 wide descending west (vertical face east) from `z + h`, centered in x, each with a glazed plate on that face. */
export function sawtooth(out: Solid[], rect: Rect, z: number, h: number, toothH: number, mat: Material, glass: Material): void {
  const n = Math.floor(rect.w / TOOTH_W), x0 = rect.x + (rect.w - n * TOOTH_W) / 2, base = z + h;
  for (let k = 0; k < n; k++) {
    const plate: Plate = { wall: 1, shape: "rect", u0: 0.05, u1: 0.95, z0: base + 0.3 * toothH, z1: base + 0.9 * toothH, mat: glass };
    out.push({ kind: "ramp", at: v3(x0 + k * TOOTH_W, rect.y, base), w: TOOTH_W, d: rect.d, h: toothH, mat, dir: "w", plates: [plate] });
  }
}

/** Factory hall with a concrete body that has a facade and a sawtooth roof. */
export function sawtoothHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, toothH = 2;
  const h = Math.min(rng.int(6, 9), recipeCap(lot) - toothH);
  const facade = { floors: 1, cols: Math.max(1, Math.round(w / 4)) };
  addBuilding(p, prism(x, y, z, w, d, h, style.mat, { facade }), facade);
  sawtooth(p.solids, { x, y, w, d }, z, h, toothH, style.roof, "glass");
  return tonePiece(p, tone);
}

/** Gable hall of corrugated sheet: ribs on the two long walls and a 4-wide door on the first open side. */
export function sheetHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(5, 8), recipeCap(lot) / (1 + GABLE_RATIO));
  const mat = rng.pick<Material>(["sheetGreen", "sheetTeal"]);
  const hall = prism(x, y, z, w, d, h, mat, { roof: "gable", roofMat: mat });
  const plates: Plate[] = [];
  for (const wall of w >= d ? [0, 2] : [3, 1]) plates.push(...ribs(wall, wall % 2 === 0 ? w : d, z, z + h, shadeTone(WALL_NORMALS[wall]!) === "lit", mat));
  const side = Math.max(0, SIDES.indexOf(lot.open[0] ?? "s"));
  plates.push(door(side, side % 2 === 0 ? w : d, 4, z, Math.min(4, h - 1), mat));
  hall.plates = plates;
  p.solids.push(hall);
  return tonePiece(p, tone);
}

/** Shipping container, 20 ft: length, width and height. */
export const CONTAINER = { len: 6, w: 2.4, h: 2.6 } as const;
export const CONTAINER_COLORS: readonly { mat: Material; weight: number }[] = [
  { mat: "boxRust", weight: 30 }, { mat: "boxBlue", weight: 25 }, { mat: "boxGrey", weight: 20 }, { mat: "boxGreen", weight: 15 }, { mat: "boxOrange", weight: 10 },
];
export const STACK_HEIGHTS: readonly { n: number; weight: number }[] = [{ n: 1, weight: 30 }, { n: 2, weight: 35 }, { n: 3, weight: 25 }, { n: 4, weight: 10 }];

/** One item drawn by cumulative weight (weights sum to 100). */
function pickWeighted<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  let r = rng.next() * items.reduce((a, i) => a + i.weight, 0);
  for (const i of items) if ((r -= i.weight) < 0) return i;
  return items[items.length - 1]!;
}

export const containerColor = (rng: Rng): Material => pickWeighted(rng, CONTAINER_COLORS).mat;
export const stackHeight = (rng: Rng): number => pickWeighted(rng, STACK_HEIGHTS).n;

/** `n` stacked containers from `at` (NW corner of the base), lengthwise along `along`, each with a door on its end face (east along x, south along y). */
export function stackContainers(at: Vec3, n: number, along: "x" | "y", rng: Rng): Solid[] {
  const { len, w, h } = CONTAINER, x = along === "x";
  const out: Solid[] = [];
  for (let k = 0; k < n; k++) {
    const mat = containerColor(rng), z = at.z + k * h;
    const c = prism(at.x, at.y, z, x ? len : w, x ? w : len, h, mat);
    c.plates = [{ ...door(x ? 1 : 2, w, 0.8 * w, z + 0.05 * h, 0.9 * h, mat) }];
    out.push(c);
  }
  return out;
}

/** Container yard: blocks of 6 along x with 4-wide aisles, centered; each block a row of stacks every 2.6 in y. */
export function containerStack(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, { len, w: cw, h } = CONTAINER, pitch = cw + 0.2, aisle = 4;
  const blocks = Math.max(0, Math.floor((w + aisle) / (len + aisle))), rows = Math.max(0, Math.floor((d + 0.2) / pitch));
  const x0 = x + (w - (blocks * len + (blocks - 1) * aisle)) / 2, y0 = y + (d - (rows * pitch - 0.2)) / 2;
  const maxN = Math.floor(recipeCap(lot) / h);
  for (let b = 0; b < blocks; b++) for (let r = 0; r < rows; r++) {
    const n = Math.min(stackHeight(rng), maxN);
    p.solids.push(...stackContainers(v3(x0 + b * (len + aisle), y0 + r * pitch, z), n, "x", rng));
  }
  return tonePiece(p, tone);
}

/** `layers` steel sheets 10×2×0.5, each offset 0.4 in x, y and z from the one below. */
export function sheetStack(at: Vec3, layers: number): Solid[] {
  return Array.from({ length: layers }, (_, l) => prism(at.x + 0.4 * l, at.y + 0.4 * l, at.z + 0.5 * l, 10, 2, 0.5, "steel"));
}

/** Four rust pipes `len`×1×1 every 1.2 in y. */
export function pipeBundle(at: Vec3, len: number): Solid[] {
  return Array.from({ length: 4 }, (_, k) => prism(at.x, at.y + 1.2 * k, at.z, len, 1, 1, "rust"));
}

/** `n` rust coils (r 1.5, h 1.5, 8 sides) in rows of 2, centers every 3.2 (the octagon spans 2.78, so the gap stays under 0.5); `at` is the NW corner of the box. */
export function coils(at: Vec3, n: number): Solid[] {
  return Array.from({ length: n }, (_, i): Solid => ({
    kind: "cylinder", at: v3(at.x + 1.5 + 3.2 * (i % 2), at.y + 1.5 + 3.2 * Math.floor(i / 2), at.z), r: 1.5, h: 1.5, mat: "rust", sides: 8,
  }));
}

/** `n` steel hull sections 9×4×3 with a stepped roof, in a row along x every 9.4. */
export function hullSections(at: Vec3, n: number): Solid[] {
  return Array.from({ length: n }, (_, k) => prism(at.x + 9.4 * k, at.y, at.z, 9, 4, 3, "steel", { roof: "step" }));
}

type YardGroup = (at: Vec3) => Solid[];
/** Plan size and min corner of a group built at the origin. */
function footprint(build: YardGroup): { fw: number; fd: number; ox: number; oy: number } {
  const bs = build(v3(0, 0, 0)).map(bounds);
  const x0 = Math.min(...bs.map((b) => b.min.x)), y0 = Math.min(...bs.map((b) => b.min.y));
  return { fw: Math.max(...bs.map((b) => b.max.x)) - x0, fd: Math.max(...bs.map((b) => b.max.y)) - y0, ox: x0, oy: y0 };
}

/** Open storage: 3..6 groups of sheets, pipes, coils or hull sections, placed by rejection at least 1 apart. */
export function stockpile(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  // Each maker draws its size once, so the probe and the final build agree.
  const makers: ((r: Rng) => YardGroup)[] = [
    (r) => { const n = r.int(2, 4); return (a) => sheetStack(a, n); },
    (r) => { const len = r.int(8, 14); return (a) => pipeBundle(a, len); },
    (r) => { const n = r.int(2, 4); return (a) => coils(a, n); },
    (r) => { const n = r.int(1, 2); return (a) => hullSections(a, n); },
  ];
  const groups = Array.from({ length: rng.int(3, 6) }, () => rng.pick(makers)(rng));
  const fallbacks: YardGroup[] = [(a) => coils(a, 2), (a) => sheetStack(a, 2)];
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const fits = (x0: number, y0: number, fw: number, fd: number): boolean =>
    !placed.some((q) => x0 - 1 < q.x1 && q.x0 - 1 < x0 + fw && y0 - 1 < q.y1 && q.y0 - 1 < y0 + fd);
  const put = (build: YardGroup, x0: number, y0: number, fw: number, fd: number, ox: number, oy: number): true => {
    placed.push({ x0, y0, x1: x0 + fw, y1: y0 + fd });
    p.solids.push(...build(v3(x0 - ox, y0 - oy, z)));
    return true;
  };
  // 60 random attempts; a `must` group then falls back to a grid scan so the yard never ends with fewer than three.
  const tryPlace = (build: YardGroup, must: boolean): boolean => {
    const { fw, fd, ox, oy } = footprint(build);
    if (fw > w || fd > d) return false;
    for (let t = 0; t < 60; t++) {
      const x0 = x + rng.next() * (w - fw), y0 = y + rng.next() * (d - fd);
      if (fits(x0, y0, fw, fd)) return put(build, x0, y0, fw, fd, ox, oy);
    }
    if (must) for (let x0 = x; x0 <= x + w - fw + 1e-9; x0 += 0.5) for (let y0 = y; y0 <= y + d - fd + 1e-9; y0 += 0.5) {
      if (fits(x0, y0, fw, fd)) return put(build, x0, y0, fw, fd, ox, oy);
    }
    return false;
  };
  groups.forEach((g, i) => { if (!tryPlace(g, false) && i < 3) fallbacks.some((f) => tryPlace(f, true)); });
  return tonePiece(p, tone);
}

/** Row of 1..3 steel or rust tanks along the long side, each with a mid-height ring and a south ladder, inside a closed concrete wall. */
export function tankGroup(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, long = w >= d, along = long ? w : d, short = long ? d : w;
  const n0 = rng.int(1, 3), rCap = (short - 2.9) / 2, cap = recipeCap(lot);
  const tanks = Array.from({ length: n0 }, () => ({ r: Math.min(rng.int(3, 5), rCap), h: Math.min(rng.int(4, 8), cap), mat: rng.pick<Material>(["steel", "rust"]) }));
  const used = (n: number): number => tanks.slice(0, n).reduce((a, t) => a + 2 * t.r + 0.4, 0) + (n - 1) + 2;
  let n = n0;
  while (n > 1 && used(n) > along) n--;
  let a = (long ? x : y) + (along - (used(n) - 2)) / 2;
  const cc = long ? y + d / 2 : x + w / 2;
  const placed = tanks.slice(0, n).map((t) => {
    const c = a + t.r + 0.2;
    a += 2 * t.r + 0.4 + 1;
    return { ...t, cx: long ? c : cc, cy: long ? cc : c };
  });
  for (const { cx, cy, r, h, mat } of placed) {
    p.solids.push({ kind: "cylinder", at: v3(cx, cy, z), r, h, mat });
    p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h / 2 - 0.15), r: r + 0.2, h: 0.3, mat });
    p.solids.push(prism(cx - 0.15, cy + r, z, 0.3, 0.3, h, "steel"));
    for (let k = 1; k < h; k++) p.solids.push({ kind: "beam", from: v3(cx - 0.15, cy + r + 0.35, z + k), to: v3(cx + 0.15, cy + r + 0.35, z + k), w: 0.1, h: 0.1, mat: "steel" });
  }
  const m = 0.7;
  const gx0 = Math.min(...placed.map((t) => t.cx - t.r - 0.2)) - m, gx1 = Math.max(...placed.map((t) => t.cx + t.r + 0.2)) + m;
  const gy0 = Math.min(...placed.map((t) => t.cy - t.r - 0.2)) - m, gy1 = Math.max(...placed.map((t) => t.cy + t.r + 0.45)) + m;
  p.solids.push({ kind: "strip", path: [{ x: gx0, y: gy0 }, { x: gx1, y: gy0 }, { x: gx1, y: gy1 }, { x: gx0, y: gy1 }, { x: gx0, y: gy0 }], width: 0.6, z: z + 0.02, mat: "concrete" });
  return tonePiece(p, tone);
}

export const QUAY_CRANE_H = 18, RTG_H = 10;

/** Quay crane centered on `at`: four-legged steel gantry on two rails, cabin, mast, boom toward `dir` with a stay and a cyan light on the tip. Nothing above `z + 18`. */
export function quayCraneAt(at: Vec2, dir: "w" | "e" | "s", out: Solid[], accents: Accent[], z = 0): void {
  const sx = dir === "e" ? 1 : dir === "w" ? -1 : 0, sy = dir === "s" ? 1 : 0;
  // `r` runs along the rails (perpendicular to dir), `l` across them.
  const P = (l: number, r: number, zz: number): Vec3 => (sx !== 0 ? v3(at.x + l, at.y + r, zz) : v3(at.x + r, at.y + l, zz));
  const xy = (q: Vec3): Vec2 => ({ x: q.x, y: q.y });
  for (const l of [-3, 3]) {
    for (const r of [-3, 3]) { const c = P(l, r, z); out.push(prism(c.x - 0.4, c.y - 0.4, z, 0.8, 0.8, 9.2, "steel")); }
    out.push({ kind: "beam", from: P(l, -3, z + 9.6), to: P(l, 3, z + 9.6), w: 0.8, h: 0.8, mat: "steel" });
    out.push({ kind: "strip", path: [xy(P(l, -4, 0)), xy(P(l, 4, 0))], width: 0.6, z: z + 0.02, mat: "rail" });
  }
  out.push(prism(at.x - 1, at.y - 1, z + 10, 2, 2, 2, "steel"));
  out.push(prism(at.x - 0.2, at.y - 0.2, z + 12, 0.4, 0.4, 3, "steel"));
  const tip = v3(at.x + 4.4 * sx, at.y + 4.4 * sy, z + 17.5);
  out.push({ kind: "beam", from: v3(at.x + sx, at.y + sy, z + 12), to: tip, w: 0.6, h: 0.4, mat: "steel" });
  out.push({ kind: "beam", from: v3(at.x, at.y, z + 15), to: tip, w: 0.2, h: 0.2, mat: "steel" });
  out.push(prism(tip.x - 0.2, tip.y - 0.2, z + 17.5, 0.4, 0.4, 0.5, "steel")); // light housing: the topmost solid, so flattening is exact
  accents.push({ kind: "dot", at: tip, r: 1, color: "cyan" });
}

/** Quay crane at the lot center, boom toward `open[0]` when it is w, e or s, else west; flattened to the cap. */
export function quayCrane(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), first = lot.open[0];
  quayCraneAt({ x: lot.x + lot.w / 2, y: lot.y + lot.d / 2 }, first === "w" || first === "e" || first === "s" ? first : "w", p.solids, p.accents, lot.z);
  return tonePiece(fitToCap(p, lot), tone);
}

/** RTG gantry: four 1.2 legs on rust wheels at `x0`/`x1` (NW corner) in pairs at `y` and `y + 6`, two cross beams and a rust trolley between them. 10 tall. */
export function rtgAt(x0: number, x1: number, y: number, out: Solid[], z = 0): void {
  for (const x of [x0, x1]) for (const yy of [y, y + 6]) {
    out.push({ kind: "cylinder", at: v3(x + 0.6, yy + 0.6, z), r: 0.6, h: 1.2, mat: "rust" });
    out.push(prism(x, yy, z + 1.2, 1.2, 1.2, 7.8, "steel"));
  }
  const span = x1 + 1.2 - x0;
  for (const yy of [y, y + 6]) out.push(prism(x0, yy, z + 9, span, 1.2, 1, "steel"));
  out.push(prism(x0 + span / 2 - 1.5, y + 1.2, z + 8.6, 3, 6 - 1.2, 1.4, "rust"));
}

/** RTG gantry over a stack of up to 3 containers lengthwise along x between its legs. */
export function rtgGantry(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, x0 = x + 0.5, x1 = x + w - 1.7, y0 = y + (d - 7.2) / 2;
  rtgAt(x0, x1, y0, p.solids, z);
  const sx = (x0 + 1.2 + x1) / 2 - CONTAINER.len / 2;
  p.solids.push(...stackContainers(v3(sx, y0 + 1.2 + (4.8 - CONTAINER.w) / 2, z), Math.min(stackHeight(rng), 3), "x", rng));
  return tonePiece(p, tone);
}

/** Small shed 4×3×2.6 centered in the lot, with a door on the south face. */
export function storeroom(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const mat = rng.pick<Material>(["sheetGreen", "steel"]);
  const shed = prism(x + (w - 4) / 2, y + (d - 3) / 2, z, 4, 3, 2.6, mat);
  shed.plates = [door(2, 4, 1.2, z, 2, mat)];
  p.solids.push(shed);
  return tonePiece(p, tone);
}

export const INDUSTRIAL: readonly RecipeDef[] = [
  { name: "sawtoothHall", recipe: sawtoothHall, family: "industrial" },
  { name: "sheetHall", recipe: sheetHall, family: "industrial" },
  { name: "containerStack", recipe: containerStack, family: "industrial" },
  { name: "stockpile", recipe: stockpile, family: "industrial" },
  { name: "tankGroup", recipe: tankGroup, family: "industrial" },
  { name: "quayCrane", recipe: quayCrane, family: "industrial" },
  { name: "rtgGantry", recipe: rtgGantry, family: "industrial" },
  { name: "storeroom", recipe: storeroom, family: "industrial" },
];
