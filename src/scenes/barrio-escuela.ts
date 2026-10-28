import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";

/** Marcador de la escuela: zócalo, bloque encalado y caja de escalera siempre encendida en la pared este. */
export function escuela(ctx: BarrioCtx, b: SprawlBlock): void {
  const py = b.y + 1, yc = py + 8;
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, 0.3, "paving"), prism(b.x + 2, py, 0.3, 6, 16, 5.6, "whitewash"));
  homeWindow(ctx, wallWindow({ x: b.x + 8 }, yc - 0.5, yc + 0.5, 2.3, 3.3), true, "escuela-escalera");
}
