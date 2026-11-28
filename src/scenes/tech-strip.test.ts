import { describe, expect, it } from "vitest";
import { bounds } from "../iso/solids";
import { PAN_REACH_SX, inPanReach } from "../map/geo";
import { createRng } from "../map/seed";
import { isStrip, maxHFor, stripZoning } from "../city/zoning";
import { CITY_EDGE } from "./city-grid";
import { PLINTH_H } from "./city-pieces";
import { BLOCK, COASTAL_CUT_Y, GRID_ORIGIN, PITCH, inCrossingPlaza, onAxis } from "./city-plan";
import { newCtx } from "./neighborhood-fixtures";
import { southParcels, techBlocks, urbanAt, parcelBlock } from "./sprawl-grid";
import { stripBlock } from "./tech";
import { southStreets } from "./tech-streets";

// #496: the coastal neighborhood builds the strip a pan shows south of the coastal cut.
const rectDist = (r: { x: number; y: number; w: number; d: number }, x: number, y: number) => Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.d));

describe("the coastal neighborhood builds the strip (#496)", () => {
  it("reaches the pan reach", () => {
    const blocks = techBlocks();
    for (let j = 10; j < 24; j++) for (let i = -20; i < 10; i++) {
      const x = GRID_ORIGIN.x + PITCH * i + BLOCK / 2, y = GRID_ORIGIN.y + PITCH * j + BLOCK / 2;
      if (y <= COASTAL_CUT_Y || y > 711 || !inPanReach(x, y) || x - y < PAN_REACH_SX + 15) continue;
      if (!urbanAt(x, Math.max(y, CITY_EDGE.south)) || onAxis(x, y) || inCrossingPlaza(x, y)) continue;
      expect(blocks.some((b) => rectDist(b, x, y) <= 20), `${x},${y}`).toBe(true);
    }
  });

  it("strip blocks come after the core and avoid the axes and the crossing plazas", () => {
    const ps = southParcels(), first = ps.findIndex(isStrip);
    expect(first).toBeGreaterThan(0);
    for (const [i, p] of ps.entries()) expect(isStrip(p), `${i}`).toBe(i >= first);
    for (const p of ps.filter(isStrip)) {
      const { x, y, w, d } = p.rect;
      expect(onAxis(p.c.x, p.c.y), `${p.cell.col},${p.cell.row}`).toBe(false);
      for (const [px, py] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d], [p.c.x, p.c.y]] as const) expect(inCrossingPlaza(px, py), `${p.cell.col},${p.cell.row}`).toBe(false);
    }
  });

  it("the south streets run to the south edge", () => {
    expect(southStreets().ground.some((s) => s.kind === "strip" && s.path.some((p) => p.y > 690))).toBe(true);
  });

  it("a south strip block the zoning calls non-bajo builds a city catalogue recipe", () => {
    const p = southParcels().filter(isStrip).find((q) => q.rect.w >= 20 && q.rect.d >= 20)!;
    expect(p).toBeDefined();
    for (const n of ["transicion", "moderno"] as const) {
      const ctx = newCtx(createRng(3));
      stripBlock(ctx, parcelBlock(p), n);
      expect(ctx.solids.length, n).toBeGreaterThan(0);
      expect(ctx.homes.length, n).toBeGreaterThan(0);
      for (const s of ctx.solids) expect(bounds(s).max.z, n).toBeLessThanOrEqual(maxHFor(n, p) + PLINTH_H + 0.5);
    }
  });

  it("a south strip block the zoning calls bajo builds houses no taller than the bajo cap", () => {
    const p = southParcels().filter(isStrip).find((q) => stripZoning().get(q) === "bajo")!;
    expect(p).toBeDefined();
    const ctx = newCtx(createRng(4));
    stripBlock(ctx, parcelBlock(p), "bajo");
    expect(ctx.solids.length).toBeGreaterThan(0);
    for (const s of ctx.solids) expect(bounds(s).max.z).toBeLessThanOrEqual(maxHFor("bajo", p) + PLINTH_H + 0.5);
  });
});
