import { v3 } from "../iso/geometry";
import { WORLD } from "../map/geo";
import type { BarrioCtx } from "./barrio";
import { CITY_EDGE, WEST_QUAY } from "./city-grid";
import { prism } from "./city-pieces";
import { REACH } from "./sprawl-grid";

export const ACCESSES = [400, 500, 600] as const;

const Y0 = CITY_EDGE.south, Y1 = WORLD.y1 + REACH.s;

/** Costanera oeste: muelle, paseo, bicisenda con línea blanca, cantero y doce tipas; sin rng. */
export function costanera(ctx: BarrioCtx): void {
  const { x0, x1 } = WEST_QUAY;
  ctx.solids.push(prism(x0, Y0, -1, x1 - x0, Y1 - Y0, 1.6, "plaza"));
  for (const [x, width, z, mat] of [[187.5, 3, 0.05, "paving"], [190.2, 1.6, 0.05, "asphalt"], [190.2, 0.15, 0.07, "whitewash"], [186.6, 1.2, 0.06, "leafDark"]] as const) ctx.ground.push({ kind: "strip", path: [{ x, y: Y0 }, { x, y: Y1 }], width, z, mat });
  for (let k = 0; k < 12; k++) ctx.solids.push({ kind: "cone", at: v3(186.6, 336 + 24 * k, 0.06), r: 2.2, h: 4.5, mat: "leaf", sides: 6 });
  for (const [a, b] of railSpans()) ctx.solids.push({ ...prism(197.4, a, 0.6, 0.4, b - a, 1, "officeDark"), plates: [{ wall: 1, shape: "rect", u0: 0.08, u1: 0.92, z0: 0.9, z1: 1.4, mat: "officeDark", toneOffset: -2 }] });
  for (let k = 0; k <= 12; k++) { const y = Y0 + 24 * k; ctx.solids.push(prism(197.35, y - 0.25, 0.6, 0.5, 0.5, 1.3, "stone"), prism(197.3, y - 0.3, 1.9, 0.6, 0.6, 0.15, "stone")); }
  lamps(ctx); carts(ctx); anglers(ctx); furniture(ctx);
}

/** Veinte faroles de acero cada 15 u, con cabeza ámbar. */
function lamps(ctx: BarrioCtx): void {
  for (let k = 0; k < 20; k++) { const y = 330 + 15 * k; ctx.solids.push(prism(193, y, 0.6, 0.3, 0.3, 6.5, "steel")); ctx.accents.push({ kind: "dot", at: v3(193.15, y + 0.15, 7.2), r: 0.7, color: "amber" }); }
}

/** Tres carritos: caja, poste, sombrilla de 4 lados, mesita y luz ámbar. */
function carts(ctx: BarrioCtx): void {
  for (const Y of [372, 468, 564]) {
    ctx.solids.push(prism(194.5, Y, 0.6, 1.6, 1, 1.2, "whitewash"), prism(195.225, Y + 0.425, 1.8, 0.15, 0.15, 1, "steel"), { kind: "cone", at: v3(195.3, Y + 0.5, 2.8), r: 1.1, h: 0.6, mat: "signal", sides: 4 }, prism(195, Y + 2.5, 0.6, 0.6, 0.6, 0.5, "steel"));
    ctx.accents.push({ kind: "dot", at: v3(196.1, Y + 0.5, 1.5), r: 0.4, color: "amber" });
  }
}

/** Cuatro pescadores con cuerpo, cabeza y caña sobre el agua. */
function anglers(ctx: BarrioCtx): void {
  for (const Y of [350, 430, 520, 590]) ctx.solids.push(prism(196.8, Y, 0.6, 0.4, 0.4, 1.2, "officeDark"), prism(196.875, Y + 0.075, 1.8, 0.25, 0.25, 0.25, "sand"), { kind: "beam", from: v3(197, Y, 1.7), to: v3(199.6, Y + 0.4, 2.6), w: 0.15, h: 0.15, mat: "steel" });
}

/** Tres bancos de hormigón y tres cestos de acero. */
function furniture(ctx: BarrioCtx): void {
  for (const Y of [396, 444, 540]) ctx.solids.push(prism(194.6, Y, 0.6, 0.5, 1.6, 0.45, "concrete"), { kind: "cylinder", at: v3(194.85, Y + 2.1, 0.6), r: 0.25, h: 0.7, mat: "steel", sides: 6 });
}

/** Tramos de baranda: 25 paneles de 11.6 u cada 12 u, menos [a − 1, a + 1] por cada acceso. */
function railSpans(): [number, number][] {
  let spans: [number, number][] = Array.from({ length: 25 }, (_, k) => [Y0 + 0.2 + 12 * k, Y0 + 11.8 + 12 * k]);
  for (const a of ACCESSES) spans = spans.flatMap(([s, e]) => [[s, Math.min(e, a - 1)], [Math.max(s, a + 1), e]] as [number, number][]).filter(([s, e]) => e > s);
  return spans;
}
