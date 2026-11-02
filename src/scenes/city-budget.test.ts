import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { isFlat } from "../iso/solids";
import { SEED } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { city } from "./city";
import { zoneRng } from "./world";

// Topes de conteo de la spec 2026-10-15 §9, sobre la semilla real del mundo.
const resume = () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));

describe("presupuesto de Resume nivel 2", () => {
  it("sólidos elevados ≤ 2 200, strip ≤ 150, acentos estáticos ≤ 900", () => {
    const s = resume();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeLessThanOrEqual(2200);
    expect(s.ground.filter((g) => g.kind === "strip").length).toBeLessThanOrEqual(150);
    expect(s.accents.length).toBeLessThanOrEqual(900);
  });

  it("polígonos estáticos del mundo ≤ 46 000 (mismo cálculo que stage.staticCount)", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    expect(buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length).toBeLessThanOrEqual(46000);
  });
});
