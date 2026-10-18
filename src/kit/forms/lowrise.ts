import { v3, type Vec2, type Vec3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Solid } from "../../iso/solids";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { PLINTH_H, prism, tiles } from "../../scenes/city-pieces";
import { jungle } from "../../scenes/flora";
import { RECIPE_MAX_H, addBuilding, emptyPiece } from "../piece";
import { awning, patioTree } from "../props";
import { HIP_ROOF_H, cornice, hipRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Side, Slot, Style } from "../types";

/**
 * Familia `lowrise`: hilera de locales con neón por local, casas en hilera con
 * jardín trasero y la manzana devorada por la selva. Spec §5 y §6.
 */
const SHOP_MIN = 4, SHOP_MAX = 6, SHOP_BACK = 3, NEON_Z0 = 2.4, NEON_H = 1.2, AWNING_Z = 2;

const alongX = (side: Side): boolean => side === "n" || side === "s";
export const frontLen = (lot: Lot, side: Side): number => (alongX(side) ? lot.w : lot.d);

/** Franja `s0..s1` a lo largo del frente `side`, pegada a él, con todo el fondo menos `back`. */
export function frontRect(lot: Lot, side: Side, s0: number, s1: number, back: number): Rect {
  const deep = (alongX(side) ? lot.d : lot.w) - back;
  switch (side) {
    case "s": return { x: lot.x + s0, y: lot.y + back, w: s1 - s0, d: deep };
    case "n": return { x: lot.x + s0, y: lot.y, w: s1 - s0, d: deep };
    case "e": return { x: lot.x + back, y: lot.y + s0, w: deep, d: s1 - s0 };
    case "w": return { x: lot.x, y: lot.y + s0, w: deep, d: s1 - s0 };
  }
}

/** Pared del lado `side` de `r`: extremos a→b en planta y normal hacia afuera. */
export function wallOf(r: Rect, side: Side): { a: Vec2; b: Vec2; normal: Vec3 } {
  switch (side) {
    case "s": return { a: { x: r.x, y: r.y + r.d }, b: { x: r.x + r.w, y: r.y + r.d }, normal: v3(0, 1, 0) };
    case "n": return { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y }, normal: v3(0, -1, 0) };
    case "e": return { a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.d }, normal: v3(1, 0, 0) };
    case "w": return { a: { x: r.x, y: r.y }, b: { x: r.x, y: r.y + r.d }, normal: v3(-1, 0, 0) };
  }
}

/** Slot de neón de ancho `width` centrado en la pared `side` de `r`, z `lot.z + 2.4 .. + 3.6`. */
function neonSlot(r: Rect, side: Side, width: number, z: number, local: number): Slot {
  const { a, b, normal } = wallOf(r, side), len = Math.hypot(b.x - a.x, b.y - a.y);
  const at = (t: number, zz: number) => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, zz);
  const t0 = (len - width) / 2 / len, t1 = 1 - t0, z0 = z + NEON_Z0, z1 = z0 + NEON_H;
  return { pts: [at(t0, z0), at(t1, z0), at(t1, z1), at(t0, z1)], wall: normal, side, kind: "neon", local };
}

/** Toldo de `len` centrado sobre la pared `side` de `r`, bajando hacia la calle. */
function shopAwning(r: Rect, side: Side, len: number, z: number): Solid[] {
  const { a } = wallOf(r, side), pad = (alongX(side) ? r.w : r.d) / 2 - len / 2, za = z + AWNING_Z;
  const at = side === "s" ? v3(a.x + pad, a.y, za) : side === "n" ? v3(a.x + pad, a.y - 0.8, za) : side === "e" ? v3(a.x, a.y + pad, za) : v3(a.x - 0.8, a.y + pad, za);
  return awning(at, len, side);
}

/** Anchos de `n` locales que suman `len` (decisión 5). */
function shopWidths(rng: Rng, len: number): number[] {
  const n = Math.max(Math.min(rng.int(4, 5), Math.floor(len / SHOP_MIN)), Math.min(5, Math.ceil(len / SHOP_MAX)));
  const ws = Array.from({ length: n }, () => SHOP_MIN);
  let rest = len - n * SHOP_MIN;
  while (rest > 1e-9) {
    const free = ws.flatMap((w, i) => (w < SHOP_MAX ? [i] : []));
    if (free.length === 0) { for (let i = 0; i < n; i++) ws[i]! += rest / n; break; }
    const i = rng.pick(free), add = Math.min(1, rest, SHOP_MAX - ws[i]!);
    ws[i]! += add; rest -= add;
  }
  return ws;
}

/** El techo con el tono de su cuerpo (`prism` omite el tono 0). */
const toned = (solids: Solid[], tone: number): Solid[] => (tone ? solids.map((q) => ({ ...q, tone })) : solids);

/** El local de esquina hacia `second`: el último si `second` está al final del eje del frente, el primero al principio, ninguno si es el lado opuesto. */
function cornerLocal(front: Side, second: Side, n: number): number | undefined {
  if (alongX(front) === alongX(second)) return undefined;
  return second === "e" || second === "s" ? n - 1 : 0;
}

export function shopRow(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), front = lot.open[0] ?? "s", second = lot.open[1];
  const ws = shopWidths(rng, frontLen(lot, front));
  const corner = second ? cornerLocal(front, second, ws.length) : undefined;
  const neons = lot.open.length > 0; // sin frente abierto: sur sin neones
  let s0 = 0;
  ws.forEach((lw, k) => {
    const r = frontRect(lot, front, s0, s0 + lw, SHOP_BACK); s0 += lw;
    const floors = Math.min(rng.int(2, 3), Math.max(1, Math.floor((cap - HIP_ROOF_H) / style.floorH))), h = floors * style.floorH;
    const facade: Facade = { floors, cols: Math.max(1, Math.round(lw / 2.5)), base: "glass" }, tone = style.tone + rng.int(-1, 1);
    addBuilding(p, prism(r.x, r.y, lot.z, r.w, r.d, h, style.mat, { facade, tone }), facade);
    const roof = { ...r, z: lot.z + h };
    p.solids.push(...toned(rng.chance(0.5) ? hipRoof(roof, style.roof) : cornice(roof, style.trim), tone));
    p.solids.push(...shopAwning(r, front, lw - 1, lot.z));
    if (!neons) return;
    p.slots.push(neonSlot(r, front, lw - 1, lot.z, k));
    if (k === corner) p.slots.push(neonSlot(r, second!, lw - 1, lot.z, k));
  });
  return p;
}

const HOUSE_BACK = 5; // jardín trasero

/** Punto a `along` sobre el eje del frente y a `fromBack` del fondo del lote. */
function backPoint(lot: Lot, side: Side, along: number, fromBack: number): Vec2 {
  switch (side) {
    case "s": return { x: lot.x + along, y: lot.y + fromBack };
    case "n": return { x: lot.x + along, y: lot.y + lot.d - fromBack };
    case "e": return { x: lot.x + fromBack, y: lot.y + along };
    case "w": return { x: lot.x + lot.w - fromBack, y: lot.y + along };
  }
}

export function rowHouses(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), front = lot.open[0] ?? "s", len = frontLen(lot, front);
  const n = Math.min(rng.int(4, 5), Math.floor(len / 4));
  const ws = Array.from({ length: n }, () => rng.int(4, 5));
  for (let i = n - 1, sum = ws.reduce((a, b) => a + b, 0); sum > len && i >= 0; i--) if (ws[i] === 5) { ws[i] = 4; sum--; }
  const floors = 2 * style.floorH + HIP_ROOF_H <= cap ? 2 : 1, h = floors * style.floorH;
  const facade: Facade = { floors, cols: 1, base: "portico" }; // la puerta: planta baja oscura
  let s = (len - ws.reduce((a, b) => a + b, 0)) / 2;
  const starts: number[] = [];
  for (const hw of ws) {
    starts.push(s);
    const r = frontRect(lot, front, s, s + hw, HOUSE_BACK), tone = style.tone + rng.int(-1, 1);
    addBuilding(p, prism(r.x, r.y, lot.z, r.w, r.d, h, style.mat, { facade, tone }), facade);
    p.solids.push(...toned(hipRoof({ ...r, z: lot.z + h }, style.roof), tone));
    s += hw;
  }
  for (let j = 0; j + 1 < n; j += 2) {
    const c = backPoint(lot, front, (starts[j]! + starts[j + 1]! + ws[j + 1]!) / 2, HOUSE_BACK / 2);
    p.solids.push(...patioTree(v3(c.x, c.y, lot.z)));
  }
  return p;
}

/** La manzana devorada: suelo de selva, losas sueltas, una ruina sin fachada y selva encima. */
export function eatenRuin(lot: Lot, rng: Rng, _style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  p.ground.push(tiles(rng, lot, z + 0.05, "leafDark"));
  p.solids.push(prism(x, y, z, 0.4 * w, 0.4 * d, PLINTH_H, "paving"), prism(x + 0.6 * w, y + 0.55 * d, z, 0.4 * w, 0.45 * d, PLINTH_H, "paving"));
  if (rng.chance(0.5)) p.solids.push(prism(x, y + 0.65 * d, z, 0.3 * w, 0.35 * d, PLINTH_H, "paving"));
  p.solids.push(prism(x + 0.45 * w, y + 1, z + 0.05, 5, 4, rng.int(2, 3), "officeDark")); // ruina, sin pisar ninguna losa
  jungle(p.solids, rng, { x0: x + 4, x1: x + w - 4, y0: y + 4, y1: y + d - 4 }, rng.int(6, 9), z + 0.05); // r ≤ 4: ningún cono sale del lote
  return p;
}

export const LOWRISE: readonly RecipeDef[] = [
  { name: "shopRow", recipe: shopRow, family: "lowrise" },
  { name: "rowHouses", recipe: rowHouses, family: "lowrise" },
  { name: "eatenRuin", recipe: eatenRuin, family: "lowrise" },
];
