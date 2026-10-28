import { describe, expect, it } from "vitest";
import { blockAt, faces, inside, newCtx } from "./barrio-fixtures";
import { monoblock } from "./barrio-monoblock";

describe("monoblock (marcador)", () => {
  const b = blockAt(132, 448), ctx = newCtx();
  monoblock(ctx, b);
  const placa = ctx.solids.find((s) => s.kind === "prism" && s.mat === "whitewash");
  it("placa whitewash 20×5 de 12, 15 o 18 sobre zócalo, dentro de la manzana con veredas y del tope", () => {
    expect(placa).toMatchObject({ kind: "prism", w: 20, d: 5, at: { x: b.x + 2, y: b.y + 2 } });
    if (placa?.kind !== "prism") return;
    expect([12, 15, 18]).toContain(placa.h);
    expect(ctx.solids.some((s) => s.kind === "prism" && s.mat === "paving" && s.w === 20 && s.d === 5 && s.h === 0.3)).toBe(true);
    for (const s of [...ctx.solids, ...ctx.ground]) expect(inside(s, b, 2)).toBe(true);
    expect(faces(ctx)).toBeLessThanOrEqual(115);
  });
  it("diez ventanas por piso (8 al sur, 2 al este), grupos propios con el prefijo de la manzana", () => {
    if (placa?.kind !== "prism") throw new Error("sin placa");
    expect(ctx.homes).toHaveLength((placa.h / 3) * 10);
    const south = ctx.homes.filter((w) => w.pts.every((p) => p.y === placa.at.y + 5));
    const east = ctx.homes.filter((w) => w.pts.every((p) => p.x === placa.at.x + 20));
    expect(south).toHaveLength((placa.h / 3) * 8); expect(east).toHaveLength((placa.h / 3) * 2);
    for (const w of ctx.homes) { expect(w.pts).toHaveLength(4); expect(w.group.startsWith(`${b.x},${b.y}:`)).toBe(true); }
    expect(new Set(ctx.homes.map((w) => w.group)).size).toBe(ctx.homes.length);
  });
  it("con paridad 1 la placa va al fondo de la manzana", () => {
    const c = newCtx(); monoblock(c, { ...b, y: b.y + 24 });
    expect(c.solids.find((s) => s.kind === "prism" && s.mat === "whitewash")).toMatchObject({ at: { x: b.x + 2, y: b.y + 24 + 11 } });
  });
});
