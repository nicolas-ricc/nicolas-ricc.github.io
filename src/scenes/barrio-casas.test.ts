import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { blockAt, faces, inside, newCtx } from "./barrio-fixtures";
import { casas } from "./barrio-casas";
import { blockParity } from "./tech-zoning";

describe("casas (marcador)", () => {
  const b0 = blockAt(132, 520), b1 = blockAt(102, 520);
  it("las dos manzanas de prueba tienen paridad distinta", () => expect(blockParity(b0)).not.toBe(blockParity(b1)));
  for (const b of [b0, b1]) for (const seed of [1, 7, 11]) {
    it(`(${b.x},${b.y}) semilla ${seed}: 4..6 casas gable con teja, una ventana cada una, dentro del tope`, () => {
      const ctx = newCtx(createRng(seed));
      casas(ctx, b);
      const houses = ctx.solids.filter((s) => s.kind === "prism" && s.roof === "gable");
      expect(houses.length).toBeGreaterThanOrEqual(4); expect(houses.length).toBeLessThanOrEqual(6);
      for (const h of houses) expect(h).toMatchObject({ mat: "whitewash", roofMat: "tile", h: 3, ...(blockParity(b) === 0 ? { w: 5, d: 4 } : { w: 4, d: 5 }) });
      expect(ctx.homes).toHaveLength(houses.length);
      for (const w of ctx.homes) expect(w.group.startsWith(`${b.x},${b.y}:`)).toBe(true);
      for (const s of [...ctx.solids, ...ctx.ground]) expect(inside(s, b, 2)).toBe(true);
      expect(faces(ctx)).toBeLessThanOrEqual(64);
    });
  }
});
