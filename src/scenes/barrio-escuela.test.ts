import { describe, expect, it } from "vitest";
import { blockAt, faces, inside, newCtx } from "./barrio-fixtures";
import { escuela } from "./barrio-escuela";
import { SCHOOL } from "./tech-zoning";

describe("escuela (marcador)", () => {
  const b = blockAt(SCHOOL.x, SCHOOL.y), ctx = newCtx();
  escuela(ctx, b);
  it("zócalo de la manzana y bloque whitewash 6×16×5.6, dentro de la manzana y del tope", () => {
    expect(ctx.solids).toContainEqual({ kind: "prism", at: { x: b.x, y: b.y, z: 0 }, w: b.w, d: b.d, h: 0.3, mat: "paving" });
    expect(ctx.solids).toContainEqual({ kind: "prism", at: { x: b.x + 2, y: b.y + 1, z: 0.3 }, w: 6, d: 16, h: 5.6, mat: "whitewash" });
    for (const s of [...ctx.solids, ...ctx.ground]) expect(inside(s, b, 0.5)).toBe(true);
    expect(faces(ctx)).toBeLessThanOrEqual(120);
  });
  it("caja de escalera encendida 1×1 en la pared este", () => {
    expect(ctx.homes).toHaveLength(1);
    const w = ctx.homes[0]!;
    expect(w).toMatchObject({ lit: true, group: "escuela-escalera" });
    expect(w.pts).toHaveLength(4);
    for (const p of w.pts) expect(p.x).toBe(b.x + 8);
    const ys = w.pts.map((p) => p.y), zs = w.pts.map((p) => p.z);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1);
  });
});
