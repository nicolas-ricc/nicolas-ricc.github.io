import { v3 } from "../iso/geometry";
import { lawn, type BarrioCtx } from "./barrio";
import { lamp } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

/** Marcador de la plaza: césped, dos senderos en diagonal, calesita y dos faroles según la paridad. */
export function plaza(ctx: BarrioCtx, b: SprawlBlock): void {
  lawn(ctx, b);
  const { x, y, w, d } = b, p = blockParity(b);
  ctx.ground.push({ kind: "strip", path: [{ x, y }, { x: x + w, y: y + d }], width: 1.2, z: 0.08, mat: "paving" }, { kind: "strip", path: [{ x, y: y + d }, { x: x + w, y }], width: 1.2, z: 0.08, mat: "paving" });
  ctx.solids.push({ kind: "cylinder", at: p === 0 ? v3(x + 18, y + 4.5, 0.05) : v3(x + 6, y + 13.5, 0.05), r: 1.6, h: 0.4, mat: "signal", sides: 8 });
  const [l0, l1] = p === 0 ? [[23, -1.5], [1, 18.6]] : [[1, -1.5], [23, 18.6]];
  lamp(ctx.solids, ctx.accents, x + l0![0]!, y + l0![1]!, 0); lamp(ctx.solids, ctx.accents, x + l1![0]!, y + l1![1]!, 0);
}
