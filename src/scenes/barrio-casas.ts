import { cornerLamps, homeWindow, lawn, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

/** Marcador de casas: 4 a 6 casas encaladas a dos aguas en lotes de 8 u, una ventana al sur cada una, dos faroles. */
export function casas(ctx: BarrioCtx, b: SprawlBlock): void {
  lawn(ctx, b);
  const n = 4 + ctx.rng.int(0, 2), [w, d] = blockParity(b) === 0 ? [5, 4] : [4, 5];
  for (let i = 0; i < n; i++) {
    const x = b.x + 1.5 + 8 * (i % 3), y = b.y + (i < 3 ? 2 : 10);
    ctx.solids.push(prism(x, y, 0.05, w, d, 3, "whitewash", { roof: "gable", roofMat: "tile" }));
    homeWindow(ctx, wallWindow({ y: y + d }, x + w / 2 - 0.35, x + w / 2 + 0.35, 1.05, 1.85), ctx.rng.chance(0.27), `${b.x},${b.y}:c${i}`);
  }
  cornerLamps(ctx, b);
}
