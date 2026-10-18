import { describe, expect, it } from "vitest";
import { RECIPES } from "../kit/index";
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

  it("cada lote de 24×18 lleva zócalo paving de 0.3", () => {
    const { solids, lots } = kitScene(7, "centro");
    for (const l of lots) expect(solids.some((s) => s.kind === "prism" && s.mat === "paving" && s.at.x === l.x && s.at.y === l.y && s.at.z === 0 && s.w === KIT_LOT.w && s.d === KIT_LOT.d && s.h === 0.3)).toBe(true);
  });

  it("el seed y el estilo cambian la escena; el mismo par la repite", () => {
    const a = JSON.stringify(kitScene(7, "centro"));
    expect(JSON.stringify(kitScene(7, "centro"))).toBe(a);
    expect(JSON.stringify(kitScene(8, "centro"))).not.toBe(a);
    expect(JSON.stringify(kitScene(7, "residencial"))).not.toBe(a); // trim stone: cambian losas y cornisas
  });
});
