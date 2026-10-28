import { describe, expect, it } from "vitest";
import { blockAt, faces, inside, newCtx } from "./barrio-fixtures";
import { club } from "./barrio-club";
import { CLUB } from "./tech-zoning";

describe("club (marcador)", () => {
  const b = blockAt(CLUB.x, CLUB.y), ctx = newCtx();
  club(ctx, b);
  it("zócalo y frente stone 10×6×9, dentro de la manzana y del tope", () => {
    expect(ctx.solids).toContainEqual({ kind: "prism", at: { x: b.x, y: b.y, z: 0 }, w: b.w, d: b.d, h: 0.3, mat: "paving" });
    expect(ctx.solids).toContainEqual({ kind: "prism", at: { x: b.x + 2, y: b.y + 11, z: 0.3 }, w: 10, d: 6, h: 9, mat: "stone" });
    for (const s of [...ctx.solids, ...ctx.ground]) expect(inside(s, b, 0.5)).toBe(true);
    expect(faces(ctx)).toBeLessThanOrEqual(150);
  });
  it("banda encendida del gimnasio en la pared sur", () => {
    expect(ctx.homes).toHaveLength(1);
    expect(ctx.homes[0]).toMatchObject({ lit: true, group: "club-gimnasio" });
    for (const p of ctx.homes[0]!.pts) expect(p.y).toBe(b.y + 17);
  });
});
