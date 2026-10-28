import { describe, expect, it } from "vitest";
import { bounds, tessellate } from "../iso/solids";
import { WORLD } from "../map/geo";
import type { Rng } from "../map/seed";
import { newCtx } from "./barrio-fixtures";
import { CITY_EDGE, WEST_QUAY } from "./city-grid";
import { costanera } from "./costanera";
import { REACH } from "./sprawl-grid";

describe("costanera (marcador: el muelle de hoy)", () => {
  const noRng: Rng = { next: () => { throw new Error("rng"); }, int: () => { throw new Error("rng"); }, chance: () => { throw new Error("rng"); }, pick: () => { throw new Error("rng"); } };
  const ctx = newCtx(noRng);
  costanera(ctx);
  const y1 = WORLD.y1 + REACH.s;
  it("el muelle de la ribera oeste y sus bolardos, sin rng", () => {
    expect(ctx.solids[0]).toEqual({ kind: "prism", at: { x: WEST_QUAY.x0, y: CITY_EDGE.south, z: -1 }, w: WEST_QUAY.x1 - WEST_QUAY.x0, d: y1 - CITY_EDGE.south, h: 1.6, mat: "plaza" });
    const ys: number[] = [];
    for (let y = CITY_EDGE.south + 8; y < y1; y += 24) ys.push(y);
    expect(ctx.solids.slice(1)).toEqual(ys.map((y) => ({ kind: "cylinder", at: { x: WEST_QUAY.x0 + 3, y, z: 0.6 }, r: 0.4, h: 0.8, mat: "rust", sides: 6 })));
    expect(ctx.ground).toEqual([]); expect(ctx.accents).toEqual([]); expect(ctx.homes).toEqual([]);
  });
  it("dentro del tope y sin pasar x 198", () => {
    expect(ctx.solids.reduce((n, s) => n + tessellate(s).length, 0)).toBeLessThanOrEqual(350);
    for (const s of ctx.solids) expect(bounds(s).max.x).toBeLessThanOrEqual(198);
  });
});
