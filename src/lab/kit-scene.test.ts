import { describe, expect, it } from "vitest";
import { LAB_LOTS, RECIPES } from "../kit/index";
import { STYLES } from "../kit/styles";
import { createRng } from "../map/seed";
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

  it("los lotes estándar de receta sin ground llevan un zócalo prisma paving de 24×18×PLINTH_H en su origen", () => {
    const { solids, lots } = kitScene(7, "centro");
    // mismo lote y rng que kitScene: algunas recetas traen ground según el seed (courtyardO)
    const hasGround = (i: number): boolean => RECIPES[i]!.recipe({ x: lots[i]!.x, y: lots[i]!.y, w: KIT_LOT.w, d: KIT_LOT.d, z: PLINTH_H, open: ["s", "e"], maxH: 24 }, createRng(7 * 1000 + i), STYLES.centro).ground.length > 0;
    const plain = lots.filter((l, i) => !LAB_LOTS[l.name] && !hasGround(i));
    expect(plain.length).toBeLessThan(lots.length); // campus y eatenRuin traen ground
    for (const l of plain) {
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

  it("la torre de agua va en un lote 6×6 centrado en su celda, sobre un zócalo de 6×6", () => {
    const { solids, lots } = kitScene(7, "civico"), l = lots.find((q) => q.name === "waterTower")!;
    const plinth = solids.find((s) => s.kind === "prism" && s.mat === "paving" && s.at.z === 0 && s.at.x === l.x + 9 && s.at.y === l.y + 6);
    expect(plinth).toMatchObject({ w: 6, d: 6, h: PLINTH_H });
    const legs = solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 9);
    expect(legs).toHaveLength(4);
    for (const s of legs) if (s.kind === "prism") expect(s.at.z).toBe(PLINTH_H);
  });

  it("el puente peatonal va en un lote 54×5 a z −1 sin zócalo, último de su fila, y ocupa dos celdas", () => {
    const { solids, lots } = kitScene(7, "civico"), l = lots.find((q) => q.name === "footbridge")!;
    const deck = solids.find((s) => s.kind === "prism" && s.mat === "stone" && s.w === 54);
    expect(deck).toMatchObject({ at: { x: l.x, y: l.y + 6.5 + 0.5 } });
    expect(deck?.kind === "prism" && Math.abs(deck.at.z - 1.2) < 1e-9).toBe(true);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "paving" && s.at.x === l.x && s.at.y === l.y && s.at.z === 0)).toBe(false);
    expect(lots.filter((q) => q.y === l.y && q.x > l.x)).toEqual([]);
    expect(l.x + 54).toBeLessThanOrEqual(l.x + 2 * KIT_STEP.x);
  });

  it("el seed y el estilo cambian la escena; el mismo par la repite", () => {
    const a = JSON.stringify(kitScene(7, "centro"));
    expect(JSON.stringify(kitScene(7, "centro"))).toBe(a);
    expect(JSON.stringify(kitScene(8, "centro"))).not.toBe(a);
    expect(JSON.stringify(kitScene(7, "residencial"))).not.toBe(a); // trim stone: cambian losas y cornisas
  });
});
