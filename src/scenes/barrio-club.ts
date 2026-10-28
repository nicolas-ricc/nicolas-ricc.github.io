import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";

/** Marcador del club: zócalo, frente de piedra y banda del gimnasio siempre encendida en la pared sur. */
export function club(ctx: BarrioCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, 0.3, "paving"), prism(b.x + 2, b.y + 11, 0.3, 10, 6, 9, "stone"));
  homeWindow(ctx, wallWindow({ y: b.y + 17 }, b.x + 3, b.x + 11, 6.3, 7.3), true, "club-gimnasio");
}
