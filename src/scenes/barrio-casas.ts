import { v3 } from "../iso/geometry";
import type { Material } from "../map/palette-iso";
import { homeWindow, lawn, wallWindow, type BarrioCtx } from "./barrio";
import { lamp, prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

const Z0 = 0.05;
type House = { x: number; y: number; w: number; d: number; h: number; mat: Material };

/** Casa a dos aguas con teja: la cumbrera sigue la paridad de la manzana (el ancho `w` ya viene orientado). */
function house(ctx: BarrioCtx, c: House): void {
  ctx.solids.push(prism(c.x, c.y, Z0, c.w, c.d, c.h, c.mat, { roof: "gable", roofMat: "tile" }));
}

/** Chimenea de ladrillo sobre el alero: a 0.8 del piñón visible y a 0.5 del alero visible. */
function chimney(ctx: BarrioCtx, c: House, parity: number): void {
  const x = c.x + c.w - (parity === 0 ? 0.8 : 0.5) - 0.6, y = c.y + c.d - (parity === 0 ? 0.5 : 0.8) - 0.6;
  ctx.solids.push(prism(x, y, Z0 + c.h, 0.6, 0.6, 1.6, "brick"));
}

/** Puerta y ventanas bajas (y altas en las de dos pisos) sobre la pared sur; cada una es su propio grupo. */
function windows(ctx: BarrioCtx, b: SprawlBlock, c: House, i: number): void {
  const at = (f: number, z0: number, z1: number, lit: boolean, id: string) => homeWindow(ctx, wallWindow({ y: c.y + c.d }, c.x + f * c.w - 0.35, c.x + f * c.w + 0.35, Z0 + z0, Z0 + z1), lit, `${b.x},${b.y}:c${i}:${id}`);
  at(0.25, 0, 1.6, ctx.rng.chance(0.5), "p");
  [0.6, 0.85].slice(0, ctx.rng.int(1, 2)).forEach((f, j) => at(f, 1.1, 1.9, ctx.rng.chance(0.27), `v${j}`));
  if (c.h === 5.5) [0.25, 0.6].slice(0, ctx.rng.int(1, 2)).forEach((f, j) => at(f, 3.6, 4.4, ctx.rng.chance(0.27), `u${j}`));
}

/** Cochera blanca al oeste de la casa H, techo de teja a un agua y entrada de auto hasta el cordón sur. */
function garage(ctx: BarrioCtx, b: SprawlBlock, c: House): void {
  const gy = c.y + c.d - 3.5, cx = c.x - 1.5;
  ctx.solids.push(prism(c.x - 3, gy, Z0, 3, 3.5, 2.3, "whitewash"));
  ctx.solids.push({ kind: "ramp", at: v3(c.x - 3.4, gy - 0.2, Z0 + 2.3), w: 3.4, d: 3.9, h: 0.8, mat: "tile", dir: "s" });
  ctx.solids.push({ kind: "strip", path: [{ x: cx, y: gy + 3.5 }, { x: cx, y: b.y + 18 }], width: 2.5, z: 0.06, mat: "paving" });
}

/** Muro bajo de ladrillo con reja, en dos tramos con un hueco de 3 u centrado en la entrada de auto. */
function wall(ctx: BarrioCtx, b: SprawlBlock, cx: number): void {
  const reja = [{ wall: 2, shape: "rect" as const, u0: 0.05, u1: 0.95, z0: Z0 + 0.8, z1: Z0 + 1.2, mat: "officeDark" as const, toneOffset: -2 }];
  for (const [x0, x1] of [[b.x, cx - 1.5], [cx + 1.5, b.x + 24]] as const) ctx.solids.push({ ...prism(x0, b.y + 17.5, Z0, x1 - x0, 0.3, 1.2, "brick"), plates: reja });
}

/** Tres árboles de vereda sobre la calle sur, corridos si taparían la entrada de auto. */
function trees(ctx: BarrioCtx, b: SprawlBlock, cx: number): void {
  for (let i = 0; i < 3; i++) {
    const r = 1.3 + 0.3 * ctx.rng.next(), h = 3.5 + ctx.rng.next();
    let x = b.x + 3 + 8 * i + 2 * ctx.rng.next();
    if (Math.abs(x - cx) < 1.25 + r) x = cx + (x < cx ? -1 : 1) * (1.25 + r);
    ctx.solids.push({ kind: "cone", at: v3(x, b.y + 18.8, 0), r, h, mat: "leaf", sides: 6 });
  }
}

/**
 * Manzana de casas de Ciudad Jardín: césped, 4 o 5 casas a dos aguas (lotes de 8 u, piñón según paridad), la primera de la fila sur con
 * cochera al oeste (lote sur 0 siempre vacío) y, con 4 casas Y H en el lote sur 1, un ala al este; chimeneas, ventanas al sur, muro con reja, árboles y dos faroles.
 */
export function casas(ctx: BarrioCtx, b: SprawlBlock): void {
  const { rng } = ctx, parity = blockParity(b);
  lawn(ctx, b);
  const n = Math.min(4 + rng.int(0, 2), 5), lots = [0, 1, 2, 4, 5];
  if (n === 4) lots.splice(rng.int(0, 4), 1);
  const hi = lots.findIndex((l) => l >= 3); // casa H del plan: la primera de la fila sur
  const houses = lots.map((lot, i): House => {
    const south = lot >= 3, a = rng.int(5, 6), c0 = rng.int(4, 5), c = a === c0 ? c0 - 1 : c0, h = rng.chance(0.6) ? 3 : 5.5;
    const [w, d] = parity === 0 ? [a, c] : [c, a];
    const mat: Material = rng.chance(0.6) ? "whitewash" : "brick";
    return { x: b.x + 1.5 + 8 * (lot % 3), y: b.y + (south ? 10 : 2), w: i === hi ? Math.min(w, 5) : w, d, h, mat };
  });
  houses.forEach((h, i) => { house(ctx, h); if (i % 2 === 0) chimney(ctx, h, parity); windows(ctx, b, h, i); });
  const home = houses[hi]!, cx = home.x - 1.5;
  garage(ctx, b, home);
  if (n === 4 && lots.includes(4)) house(ctx, { x: home.x + home.w, y: home.y + home.d - 3, w: 3, d: 3, h: 3, mat: home.mat });
  wall(ctx, b, cx);
  trees(ctx, b, cx);
  lamp(ctx.solids, ctx.accents, b.x + 23, b.y + 18.6, 0);
  lamp(ctx.solids, ctx.accents, b.x + 24.6, b.y + 4, 0);
}
