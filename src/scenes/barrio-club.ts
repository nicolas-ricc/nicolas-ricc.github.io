import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
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

/** Club Pedro Echagüe: zócalo, frente de piedra con cartel y gimnasio con bóveda. */
export function club(ctx: BarrioCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, 0.3, "paving"));
  front(ctx, b);
  gym(ctx, b);
}
