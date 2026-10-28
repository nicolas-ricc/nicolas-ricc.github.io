import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { createRng } from "../map/seed";
import { ALWAYS_LIT, homeWindow, lawn, type BarrioCtx } from "./barrio";

const newCtx = (): BarrioCtx => ({ solids: [], ground: [], accents: [], homes: [], rng: createRng(7) });

describe("barrio", () => {
  it("lawn: un prisma leafDark h 0.05 de toda la manzana", () => {
    const ctx = newCtx();
    lawn(ctx, { x: 132, y: 448, w: 24, d: 18 });
    expect(ctx.solids).toEqual([{ kind: "prism", at: v3(132, 448, 0), w: 24, d: 18, h: 0.05, mat: "leafDark" }]);
  });
  it("homeWindow agrega la ventana tal cual", () => {
    const ctx = newCtx(), pts = [v3(0, 1, 0), v3(1, 1, 0), v3(1, 1, 1), v3(0, 1, 1)];
    homeWindow(ctx, pts, true, "g");
    expect(ctx.homes).toEqual([{ pts, lit: true, group: "g" }]);
  });
  it("los grupos fijos encendidos son la escalera de la escuela y el gimnasio del club", () => {
    expect([...ALWAYS_LIT].sort()).toEqual(["club-gimnasio", "escuela-escalera"]);
  });
});
