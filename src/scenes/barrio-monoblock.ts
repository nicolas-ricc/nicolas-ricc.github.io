import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import { cornerLamps, homeWindow, lawn, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

/** Una placa del monoblock: esquina (x, y) del cuerpo 20×5, altura h, revoque, planta baja de ladrillo y vanos de loggia (0..7). */
export interface Slab { x: number; y: number; h: number; mat: "whitewash" | "stone"; brick: boolean; loggias: number[] }

/** Placa de pared: rect de u0..u1 y z0..z1 sobre `wall` (1 este, 2 sur). */
const rect = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat, toneOffset });

/** Zócalo, cuerpo con ladrillo, bandas de vidrio, pilastras y loggias, tanques de azotea y antena. */
export function slab(p: Slab): Solid[] {
  const floors = p.h / 3, top = 0.3 + p.h, n = floors >= 5 ? 3 : 2, plates: Plate[] = [];
  if (p.brick) plates.push(rect(1, 0, 1, 0.3, 3.3, "brick"), rect(2, 0, 1, 0.3, 3.3, "brick"));
  for (let f = 0; f < floors; f++) for (const wall of [2, 1]) plates.push(rect(wall, 0.03, 0.97, 0.3 + 3 * f + 1, 0.3 + 3 * f + 2.1, "glass", -1));
  for (let k = 1; k <= 7; k++) plates.push(rect(2, k / 8 - 0.01, k / 8 + 0.01, 0.3, top, p.mat, 1));
  plates.push(rect(1, 0.46, 0.54, 0.3, top, p.mat, 1));
  for (const k of p.loggias) {
    plates.push(rect(2, k / 8, (k + 1) / 8, 0.3, top, "officeDark", -2));
    for (let f = 0; f < floors; f++) plates.push(rect(2, k / 8, (k + 1) / 8, 0.3 + 3 * f + 0.9, 0.3 + 3 * f + 1.1, "whitewash"));
  }
  const body = { ...prism(p.x, p.y, 0.3, 20, 5, p.h, p.mat), plates };
  const tanks = Array.from({ length: n }, (_, k) => prism(p.x + 20 * (k + 0.5) / n - 1, p.y + 1.5, top, 2, 2, 2.8, "concrete"));
  const c = tanks[0]!.at;
  return [prism(p.x - 0.3, p.y - 0.3, 0, 20.6, 5.6, 0.3, "paving"), body, ...tanks, prism(c.x + 0.9, c.y + 0.9, top + 2.8, 0.2, 0.2, 2.5, "steel")];
}

/** Ventanas encendibles: sur (por vano no loggia) y este por piso; una por piso por columna de loggia, con `lit` común. */
export function windows(ctx: BarrioCtx, b: SprawlBlock, slabs: Slab[]): void {
  slabs.forEach((s, i) => {
    const floors = s.h / 3, lit: Record<number, boolean> = {};
    for (const k of s.loggias) lit[k] = ctx.rng.chance(0.5);
    for (let f = 0; f < floors; f++) {
      const z = 0.3 + 3 * f;
      for (let k = 0; k < 8; k++) {
        const cx = s.x + 20 * (1 - (k + 0.5) / 8), loggia = s.loggias.includes(k);
        if (loggia) homeWindow(ctx, wallWindow({ y: s.y + 5 }, cx - 1.25, cx + 1.25, z + 1.2, z + 2.6), lit[k]!, `${b.x},${b.y}:p${i}-L${k}`);
        else homeWindow(ctx, wallWindow({ y: s.y + 5 }, cx - 0.45, cx + 0.45, z + 1.1, z + 2), ctx.rng.chance(0.38), `${b.x},${b.y}:p${i}-s${f}-${k}`);
      }
      for (let j = 0; j < 2; j++) { const c = s.y + 1.25 + 2.5 * j; homeWindow(ctx, wallWindow({ x: s.x + 20 }, c - 0.45, c + 0.45, z + 1.1, z + 2), ctx.rng.chance(0.38), `${b.x},${b.y}:p${i}-e${f}-${j}`); }
    }
  });
}

/** Monoblocks del Barrio Simón Bolívar: una o dos placas de 4 a 6 pisos con grilla y loggias, ventanas al sur y al este, dos faroles. */
export function monoblock(ctx: BarrioCtx, b: SprawlBlock): void {
  lawn(ctx, b);
  const two = ctx.rng.chance(0.5), hs = [12, 15, 18], slabs: Slab[] = [];
  for (let i = 0; i < (two ? 2 : 1); i++) {
    const h = ctx.rng.pick(hs); hs.splice(hs.indexOf(h), 1);
    const y = b.y + (two ? (i === 0 ? 2 : 11) : blockParity(b) === 0 ? 2 : 11), mat = ctx.rng.chance(0.5) ? "whitewash" : "stone";
    slabs.push({ x: b.x + 2, y, h, mat, brick: ctx.rng.chance(0.5), loggias: ctx.rng.int(1, 2) === 1 ? [2] : [2, 6] });
  }
  slabs.forEach((s) => ctx.solids.push(...slab(s)));
  windows(ctx, b, slabs);
  cornerLamps(ctx, b);
}
