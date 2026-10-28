import { cornerLamps, homeWindow, lawn, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

/** Marcador del monoblock: placa encalada de 4 a 6 pisos sobre zócalo, ventanas al sur y al este, dos faroles. */
export function monoblock(ctx: BarrioCtx, b: SprawlBlock): void {
  lawn(ctx, b);
  const px = b.x + 2, py = b.y + (blockParity(b) === 0 ? 2 : 11), h = ctx.rng.pick([12, 15, 18]);
  ctx.solids.push(prism(px, py, 0.05, 20, 5, 0.3, "paving"), prism(px, py, 0.35, 20, 5, h, "whitewash"));
  for (let f = 0; f < h / 3; f++) {
    const z = 0.35 + 3 * f + 1.5 - 0.45;
    for (let i = 0; i < 8; i++) { const c = px + 2.5 * (i + 0.5); homeWindow(ctx, wallWindow({ y: py + 5 }, c - 0.45, c + 0.45, z, z + 0.9), ctx.rng.chance(0.38), `${b.x},${b.y}:s${f}-${i}`); }
    for (let j = 0; j < 2; j++) { const c = py + 2.5 * (j + 0.5); homeWindow(ctx, wallWindow({ x: px + 20 }, c - 0.45, c + 0.45, z, z + 0.9), ctx.rng.chance(0.38), `${b.x},${b.y}:e${f}-${j}`); }
  }
  cornerLamps(ctx, b);
}
