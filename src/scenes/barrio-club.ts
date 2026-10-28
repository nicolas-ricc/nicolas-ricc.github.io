import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { lamp, prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";

/** Placa de pared: rect de u0..u1 y z0..z1 sobre `wall` (1 este, 2 sur). */
const rect = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat, toneOffset });

/** Frente de piedra 10×6×9: ventanas por piso, puerta, ventanal de escalera y cartel azul con letras amarillas (se pintan en este orden); luz del ventanal. */
function front(ctx: BarrioCtx, b: SprawlBlock): void {
  const plates: Plate[] = [];
  for (const f of [1, 2]) for (const c of [0.2, 0.45, 0.7]) plates.push(rect(2, c - 0.06, c + 0.06, 0.3 + 3 * f + 0.9, 0.3 + 3 * f + 2.3, "glass", -1));
  plates.push(rect(2, 0.15, 0.3, 0.3, 2.8, "officeDark", -2), rect(2, 0.82, 0.94, 0.6, 8.4, "glass"), rect(2, 0.08, 0.72, 7.3, 8.7, "hullBlue"), rect(2, 0.14, 0.66, 7.55, 8.45, "safety"));
  for (let f = 0; f < 3; f++) plates.push(rect(1, 0.4, 0.6, 0.3 + 3 * f + 0.9, 0.3 + 3 * f + 2.3, "glass", -1));
  ctx.solids.push({ ...prism(b.x + 2, b.y + 11, 0.3, 10, 6, 9, "stone"), plates });
  homeWindow(ctx, wallWindow({ y: b.y + 17 }, b.x + 2.6, b.x + 3.8, 0.6, 8.4), true, "club-escalera");
}

/** Gimnasio 14×9×5 con banda alta de vidrio, bóveda de dos rampas con lomo, y luces fijas de la banda (este y tramo visible del sur). */
function gym(ctx: BarrioCtx, b: SprawlBlock): void {
  const plates = [rect(1, 0.04, 0.96, 3.6, 4.6, "glass"), rect(2, 0.04, 0.96, 3.6, 4.6, "glass")];
  const vault = (y: number, dir: "n" | "s"): Solid => ({ kind: "ramp", at: v3(b.x + 1.8, y, 5), w: 14.4, d: 4.4, h: 1.6, mat: "steel", dir });
  ctx.solids.push({ ...prism(b.x + 2, b.y + 1, 0, 14, 9, 5, "whitewash"), plates }, vault(b.y + 0.8, "n"), vault(b.y + 5.6, "s"), prism(b.x + 1.8, b.y + 5.2, 6.6, 14.4, 0.4, 0.2, "steel"));
  homeWindow(ctx, wallWindow({ x: b.x + 16 }, b.y + 1.36, b.y + 9.64, 3.6, 4.6), true, "club-gimnasio");
  homeWindow(ctx, wallWindow({ y: b.y + 10 }, b.x + 12, b.x + 15.44, 3.6, 4.6), true, "club-gimnasio");
}

/** Cancha de básquet: piso azul con pintura verde, dos aros con tablero hacia la cancha, cerco de 4 postes con 2 alambres y dos torres de luz con dot ámbar. */
function court(ctx: BarrioCtx, b: SprawlBlock): void {
  const { x, y } = b;
  ctx.solids.push(prism(x + 17, y + 2, 0.3, 5, 14, 0.1, "hullBlue"), prism(x + 17.7, y + 3.5, 0.4, 3.6, 11, 0.05, "leaf"));
  for (const py of [2.4, 15.4]) ctx.solids.push(prism(x + 19.4, y + py, 0.4, 0.2, 0.2, 3, "steel"));
  for (const by of [2.6, 15.25]) ctx.solids.push(prism(x + 18.9, y + by, 2.2, 1.2, 0.15, 0.8, "whitewash"));
  for (const [fx, fy] of [[16.8, 1.8], [22.05, 1.8], [16.8, 16.05], [22.05, 16.05]] as const) ctx.solids.push(prism(x + fx, y + fy, 0.3, 0.15, 0.15, 3, "steel"));
  ctx.solids.push({ kind: "beam", from: v3(x + 22.125, y + 1.875, 2.9), to: v3(x + 22.125, y + 16.125, 2.9), w: 0.15, h: 0.15, mat: "steel" }, { kind: "beam", from: v3(x + 16.875, y + 16.125, 2.9), to: v3(x + 22.125, y + 16.125, 2.9), w: 0.15, h: 0.15, mat: "steel" });
  for (const ty of [4, 14]) {
    ctx.solids.push(prism(x + 22.5, y + ty, 0.3, 0.3, 0.3, 8, "steel"));
    ctx.accents.push({ kind: "dot", at: v3(x + 22.65, y + ty + 0.15, 8.3), r: 0.8, color: "amber" });
  }
}

/** Vereda: farol en la esquina sur y árbol cónico al este. */
function sidewalk(ctx: BarrioCtx, b: SprawlBlock): void {
  lamp(ctx.solids, ctx.accents, b.x + 1, b.y + 18.6, 0);
  ctx.solids.push({ kind: "cone", at: v3(b.x + 24.8, b.y + 9, 0), r: 1.4, h: 4, mat: "leaf", sides: 6 });
}

/** Club Pedro Echagüe: zócalo, frente de piedra con cartel, gimnasio con bóveda, cancha con aros, cerco y torres de luz, y vereda con farol y árbol. */
export function club(ctx: BarrioCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, 0.3, "paving"));
  front(ctx, b);
  gym(ctx, b);
  court(ctx, b);
  sidewalk(ctx, b);
}
