import { v3 } from "../iso/geometry";
import type { Box } from "../world/frame";
import { cornerLamps, lawn, type NeighborhoodCtx } from "./neighborhood";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";
import { blockParity } from "./tech-zoning";

/** Two diagonal paving paths (northwest to southeast and southwest to northeast), as flat polygons that stick out 1 u onto the sidewalk. */
function paths(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const { x, y } = b;
  ctx.solids.push({ kind: "poly", footprint: [{ x: x - 1, y }, { x: x + 1, y }, { x: x + 25, y: y + 18 }, { x: x + 23, y: y + 18 }], z: 0.05, h: 0.03, mat: "paving" }, { kind: "poly", footprint: [{ x: x - 1, y: y + 18 }, { x: x + 23, y }, { x: x + 25, y }, { x: x + 1, y: y + 18 }], z: 0.05, h: 0.03, mat: "paving" });
}

/** Footprint box of `cx ± hx`, `cy ± hy`. */
const around = (cx: number, cy: number, hx: number, hy: number): Box => ({ x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy });

/** 6-sided carousel: low red disc and yellow conical roof, same center; returns its footprint box. */
function carousel(ctx: NeighborhoodCtx, cx: number, cy: number): Box {
  ctx.solids.push({ kind: "cylinder", at: v3(cx, cy, 0.05), r: 1.6, h: 0.4, mat: "signal", sides: 6 }, { kind: "cone", at: v3(cx, cy, 0.45), r: 1.9, h: 1.2, mat: "safety", sides: 6 });
  return around(cx, cy, 1.9, 1.9);
}

/** Slide: steel platform and red ramp going down toward the south; returns its footprint box. */
function slide(ctx: NeighborhoodCtx, cx: number, cy: number): Box {
  ctx.solids.push(prism(cx - 0.4, cy - 1.6, 0.05, 0.8, 0.8, 2, "steel"), { kind: "ramp", at: v3(cx - 0.4, cy - 0.8, 0.05), w: 0.8, d: 2.4, h: 1.8, mat: "signal", dir: "s" });
  return around(cx, cy, 0.4, 1.6);
}

/** Swings: two posts, a beam resting on both and two seats hanging below; returns its footprint box. */
function swings(ctx: NeighborhoodCtx, cx: number, cy: number): Box {
  ctx.solids.push(prism(cx - 1.4, cy - 0.1, 0.05, 0.2, 0.2, 2.4, "steel"), prism(cx + 1.2, cy - 0.1, 0.05, 0.2, 0.2, 2.4, "steel"), { kind: "beam", from: v3(cx - 1.4, cy, 2.55), to: v3(cx + 1.4, cy, 2.55), w: 0.2, h: 0.2, mat: "steel" }, prism(cx - 0.95, cy - 0.15, 0.6, 0.6, 0.3, 0.15, "safety"), prism(cx + 0.35, cy - 0.15, 0.6, 0.6, 0.3, 0.15, "safety"));
  return around(cx, cy, 1.4, 0.15);
}

/** Sandbox: 3×3 sand box; returns its footprint box. */
function sandbox(ctx: NeighborhoodCtx, cx: number, cy: number): Box { ctx.solids.push(prism(cx - 1.5, cy - 1.5, 0.05, 3, 3, 0.2, "sand")); return around(cx, cy, 1.5, 1.5); }

/** Do the footprint boxes cross? Touching does not count. */
const crosses = (a: Box, c: Box): boolean => a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1;

/** Two cement benches in the west and east triangles; returns their footprint boxes. */
function benches(ctx: NeighborhoodCtx, b: SprawlBlock): Box[] {
  const xs = [b.x + 8.4, b.x + 14];
  ctx.solids.push(...xs.map((bx) => prism(bx, b.y + 8.75, 0.05, 1.6, 0.5, 0.45, "concrete")));
  return xs.map((bx): Box => ({ x0: bx, y0: b.y + 8.75, x1: bx + 1.6, y1: b.y + 9.25 }));
}

/** Two conical trees (west and east), off the paths and `taken`; up to 10 attempts each. */
function trees(ctx: NeighborhoodCtx, b: SprawlBlock, taken: Box[]): void {
  const { x, y } = b, rng = ctx.rng;
  for (const west of [true, false]) {
    const r = 1.5 + 0.5 * rng.next(), h = 4 + 1.5 * rng.next();
    for (let i = 0; i < 10; i++) {
      const u = r + (4.5 - r) * rng.next(), px = west ? x + u : x + 24 - u, py = y + 8 + 2 * rng.next();
      const clear = Math.min(Math.abs(18 * (px - x) - 24 * (py - y)), Math.abs(18 * (px - x) + 24 * (py - y - 18))) / 30;
      const box = around(px, py, r, r);
      if (clear < r + 0.6 || taken.some((t) => crosses(box, t))) continue;
      ctx.solids.push({ kind: "cone", at: v3(px, py, 0.05), r, h, mat: "leaf", sides: 6 });
      taken.push(box);
      break;
    }
  }
}

/** Plaza: lawn, diagonal paths, four play structures (quadrants according to parity; slide and sandbox shifted ±1 u), benches, two trees and street lamps. */
export function plaza(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  lawn(ctx, b);
  paths(ctx, b);
  const { x, y } = b, even = blockParity(b) === 0, jitter = () => 2 * ctx.rng.next() - 1;
  const [ne, nw, se, sw] = [[x + 15.5, y + 2], [x + 8.5, y + 2], [x + 15.5, y + 16], [x + 8.5, y + 16]] as const;
  const [cc, sc] = even ? [ne, sw] : [sw, ne];
  const taken = [carousel(ctx, cc[0], cc[1]), swings(ctx, sc[0], sc[1])];
  const [sx, nx] = [se[0] + jitter(), nw[0] + jitter()];
  taken.push(slide(ctx, sx, se[1]), sandbox(ctx, nx, nw[1]), ...benches(ctx, b));
  trees(ctx, b, taken);
  cornerLamps(ctx, b);
}
