import { v3 } from "../iso/geometry";
import { cornerLamps, lawn, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

/** Dos senderos de paving en diagonal (NO→SE y SO→NE), como polígonos planos que sobresalen 1 u a la vereda. */
function paths(ctx: BarrioCtx, b: SprawlBlock): void {
  const { x, y } = b;
  ctx.solids.push({ kind: "poly", footprint: [{ x: x - 1, y }, { x: x + 1, y }, { x: x + 25, y: y + 18 }, { x: x + 23, y: y + 18 }], z: 0.05, h: 0.03, mat: "paving" }, { kind: "poly", footprint: [{ x: x - 1, y: y + 18 }, { x: x + 23, y }, { x: x + 25, y }, { x: x + 1, y: y + 18 }], z: 0.05, h: 0.03, mat: "paving" });
}

/** Calesita de 6 lados: disco rojo bajo y techo cónico amarillo, mismo centro. */
function carousel(ctx: BarrioCtx, cx: number, cy: number): void {
  ctx.solids.push({ kind: "cylinder", at: v3(cx, cy, 0.05), r: 1.6, h: 0.4, mat: "signal", sides: 6 }, { kind: "cone", at: v3(cx, cy, 0.45), r: 1.9, h: 1.2, mat: "safety", sides: 6 });
}

/** Tobogán: plataforma de acero y rampa roja que baja hacia el sur. */
function slide(ctx: BarrioCtx, cx: number, cy: number): void {
  ctx.solids.push(prism(cx - 0.4, cy - 1.6, 0.05, 0.8, 0.8, 2, "steel"), { kind: "ramp", at: v3(cx - 0.4, cy - 0.8, 0.05), w: 0.8, d: 2.4, h: 1.8, mat: "signal", dir: "s" });
}

/** Hamacas: dos postes, viga entre ambos y dos asientos que cuelgan por debajo. */
function swings(ctx: BarrioCtx, cx: number, cy: number): void {
  ctx.solids.push(prism(cx - 1.4, cy - 0.1, 0.05, 0.2, 0.2, 2.4, "steel"), prism(cx + 1.2, cy - 0.1, 0.05, 0.2, 0.2, 2.4, "steel"), { kind: "beam", from: v3(cx - 1.4, cy, 2.35), to: v3(cx + 1.4, cy, 2.35), w: 0.2, h: 0.2, mat: "steel" }, prism(cx - 0.95, cy - 0.15, 0.6, 0.6, 0.3, 0.15, "safety"), prism(cx + 0.35, cy - 0.15, 0.6, 0.6, 0.3, 0.15, "safety"));
}

/** Arenero: cajón de arena de 3×3. */
function sandbox(ctx: BarrioCtx, cx: number, cy: number): void { ctx.solids.push(prism(cx - 1.5, cy - 1.5, 0.05, 3, 3, 0.2, "sand")); }

type Rect = readonly [x0: number, y0: number, x1: number, y1: number];

const crosses = (a: Rect, c: Rect): boolean => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];

/** Dos bancos de cemento en los triángulos oeste y este; devuelve sus cajas en planta. */
function benches(ctx: BarrioCtx, b: SprawlBlock): Rect[] {
  const xs = [b.x + 8.4, b.x + 14];
  ctx.solids.push(...xs.map((bx) => prism(bx, b.y + 8.75, 0.05, 1.6, 0.5, 0.45, "concrete")));
  return xs.map((bx): Rect => [bx, b.y + 8.75, bx + 1.6, b.y + 9.25]);
}

/** Dos árboles cónicos (oeste y este), fuera de los senderos y de `taken`; hasta 10 intentos cada uno. */
function trees(ctx: BarrioCtx, b: SprawlBlock, taken: Rect[]): void {
  const { x, y } = b, rng = ctx.rng;
  for (const west of [true, false]) {
    const r = 1.5 + 0.5 * rng.next(), h = 4 + 1.5 * rng.next();
    for (let i = 0; i < 10; i++) {
      const u = r + (4.5 - r) * rng.next(), px = west ? x + u : x + 24 - u, py = y + 8 + 2 * rng.next();
      const clear = Math.min(Math.abs(18 * (px - x) - 24 * (py - y)), Math.abs(18 * (px - x) + 24 * (py - y - 18))) / 30;
      const box: Rect = [px - r, py - r, px + r, py + r];
      if (clear < r + 0.6 || taken.some((t) => crosses(box, t))) continue;
      ctx.solids.push({ kind: "cone", at: v3(px, py, 0.05), r, h, mat: "leaf", sides: 6 });
      taken.push(box);
      break;
    }
  }
}

/** Plaza: césped, senderos en diagonal, cuatro juegos (cuadrantes según la paridad; tobogán y arenero corridos ±1 u), bancos, dos árboles y faroles. */
export function plaza(ctx: BarrioCtx, b: SprawlBlock): void {
  lawn(ctx, b);
  paths(ctx, b);
  const { x, y } = b, even = blockParity(b) === 0, jitter = () => 2 * ctx.rng.next() - 1;
  const [ne, nw, se, sw] = [[x + 15.5, y + 2], [x + 8.5, y + 2], [x + 15.5, y + 16], [x + 8.5, y + 16]] as const;
  const [cc, sc] = even ? [ne, sw] : [sw, ne];
  carousel(ctx, cc[0], cc[1]);
  swings(ctx, sc[0], sc[1]);
  const [sx, nx] = [se[0] + jitter(), nw[0] + jitter()];
  slide(ctx, sx, se[1]);
  sandbox(ctx, nx, nw[1]);
  const games: Rect[] = [[cc[0] - 1.9, cc[1] - 1.9, cc[0] + 1.9, cc[1] + 1.9], [sc[0] - 1.4, sc[1] - 0.2, sc[0] + 1.4, sc[1] + 0.2], [sx - 0.4, se[1] - 1.6, sx + 0.4, se[1] + 1.6], [nx - 1.5, nw[1] - 1.5, nx + 1.5, nw[1] + 1.5]];
  trees(ctx, b, [...games, ...benches(ctx, b)]);
  cornerLamps(ctx, b);
}
