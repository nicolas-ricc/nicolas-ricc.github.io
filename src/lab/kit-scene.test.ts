import { describe, expect, it } from "vitest";
import { RECIPES } from "../kit/index";
import { PLINTH_H } from "../scenes/city-pieces";
import { KIT_LOT, KIT_STEP, kitScene } from "./kit-scene";

describe("escena del lab del kit", () => {
  it("un lote por receta, una fila por familia en el orden del registro, paso 30×24", () => {
    const { lots } = kitScene(7, "centro");
    expect(lots.map((l) => l.name)).toEqual(RECIPES.map((r) => r.name));
    const families = [...new Set(RECIPES.map((r) => r.family))];
    RECIPES.forEach((r, i) => {
      const row = families.indexOf(r.family), col = RECIPES.filter((q) => q.family === r.family).indexOf(r);
      expect(lots[i]).toMatchObject({ x: col * KIT_STEP.x, y: row * KIT_STEP.y });
    });
  });

  it("cada lote de 24×18 lleva una losa paving plana a PLINTH_H que cubre el lote", () => {
    const { solids, lots } = kitScene(7, "centro");
    for (const l of lots) {
      const slab = solids.find((s) => s.kind === "ground" && s.mat === "paving" && s.tris.every((t) => t.pts.every((p) => p.z === PLINTH_H && p.x >= l.x && p.x <= l.x + KIT_LOT.w && p.y >= l.y && p.y <= l.y + KIT_LOT.d)) && s.tris.some((t) => t.pts.some((p) => p.x === l.x && p.y === l.y)));
      expect(slab?.kind === "ground" && slab.tris.length).toBe(2);
      if (slab?.kind !== "ground") continue;
      const pts = slab.tris.flatMap((t) => t.pts);
      expect([Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))]).toEqual([l.x, l.x + KIT_LOT.w, l.y, l.y + KIT_LOT.d]);
    }
  });

  it("la losa va antes del suelo de la receta del mismo lote (campus)", () => {
    const { solids, lots } = kitScene(7, "centro");
    const l = lots.find((q) => q.name.includes("campus"))!;
    const inLot = (p: { x: number; y: number }): boolean => p.x >= l.x && p.x <= l.x + KIT_LOT.w && p.y >= l.y && p.y <= l.y + KIT_LOT.d;
    const idx = solids.map((s, i) => (s.kind === "ground" && s.tris.every((t) => t.pts.every(inLot)) ? i : -1)).filter((i) => i >= 0);
    const slab = idx.find((i) => { const s = solids[i]!; return s.kind === "ground" && s.mat === "paving" && s.tris.length === 2 && s.tris.every((t) => t.pts.every((p) => p.z === PLINTH_H)); })!;
    expect(slab).toBe(idx[0]);
    expect(idx.length).toBeGreaterThan(1);
  });

  it("el seed y el estilo cambian la escena; el mismo par la repite", () => {
    const a = JSON.stringify(kitScene(7, "centro"));
    expect(JSON.stringify(kitScene(7, "centro"))).toBe(a);
    expect(JSON.stringify(kitScene(8, "centro"))).not.toBe(a);
    expect(JSON.stringify(kitScene(7, "residencial"))).not.toBe(a); // trim stone: cambian losas y cornisas
  });
});
