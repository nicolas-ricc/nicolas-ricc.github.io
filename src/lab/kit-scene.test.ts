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

  it("los lotes de receta sin ground (vidrio, clásico, obra) llevan un zócalo prisma paving de 24×18×PLINTH_H en su origen", () => {
    const { solids, lots } = kitScene(7, "centro");
    for (const l of lots.filter((q) => q.name !== "campus")) {
      const plinth = solids.find((s) => s.kind === "prism" && s.mat === "paving" && s.at.x === l.x && s.at.y === l.y && s.at.z === 0);
      expect(plinth, l.name).toMatchObject({ w: KIT_LOT.w, d: KIT_LOT.d, h: PLINTH_H });
    }
  });

  it("el campus no lleva zócalo en su origen y su suelo leafDark queda a z 0.05", () => {
    const { solids, lots } = kitScene(7, "centro");
    const l = lots.find((q) => q.name === "campus")!;
    expect(solids.some((s) => s.kind === "prism" && s.at.x === l.x && s.at.y === l.y && s.at.z === 0 && s.w === KIT_LOT.w && s.d === KIT_LOT.d)).toBe(false);
    const g = solids.find((s) => s.kind === "ground" && s.mat === "leafDark" && s.tris.every((t) => t.pts.every((p) => p.x >= l.x && p.x <= l.x + KIT_LOT.w && p.y >= l.y && p.y <= l.y + KIT_LOT.d)));
    expect(g?.kind === "ground" && g.tris.every((t) => t.pts.every((p) => p.z === 0.05))).toBe(true);
  });

  it("el seed y el estilo cambian la escena; el mismo par la repite", () => {
    const a = JSON.stringify(kitScene(7, "centro"));
    expect(JSON.stringify(kitScene(7, "centro"))).toBe(a);
    expect(JSON.stringify(kitScene(8, "centro"))).not.toBe(a);
    expect(JSON.stringify(kitScene(7, "residencial"))).not.toBe(a); // trim stone: cambian losas y cornisas
  });
});
