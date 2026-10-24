import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { PLANT, RAIL_YARD_X, STACKS, STACK_BASE_H, factory, type FactoryScene } from "./factory";
import { terrainAt } from "./terrain";

const scene = (): FactoryScene => factory(createRng(7));
const PORTFOLIO_MATS: readonly Material[] = ["slab", "concrete", "rust", "steel", "road", "rail", "sand", "brick", "leaf", "leafDark", "whitewash", "glass", "office", "signal", "stockbrick", "safety"];
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 4) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1)) || s.kind === "beam"; // chimeneas, mástiles, vigas y barandas
const tallOk = (s: Solid) => bounds(s).max.z <= 26 || slender(s);

describe("factory", () => {
  it("es determinística y trae más de 90 sólidos elevados dentro de Portfolio", () => {
    expect(JSON.stringify(factory(createRng(7)))).toBe(JSON.stringify(factory(createRng(7))));
    const s = scene();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeGreaterThan(90); // la selva del cinturón descarta los conos que pisarían las vías del oeste
    for (const x of [...s.ground, ...s.solids]) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 1); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1); expect(b.max.y).toBeLessThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
      expect(PORTFOLIO_MATS).toContain(x.mat);
    }
  });

  it("nada apoya en agua y todo lo que supera z 26 es esbelto (cilindro r ≤ 4, prisma fino o viga)", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (x.kind !== "cone") expect(terrainAt(b.min.x, b.min.y)).not.toBe("water");
      expect(tallOk(x)).toBe(true);
    }
  });

  it("la regla de altura rechaza un sólido ancho por encima de z 26 y acepta vigas y cilindros finos", () => {
    const at = { x: 0, y: 0, z: 0 };
    expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 27, mat: "brick" })).toBe(false);
    expect(tallOk({ kind: "cylinder", at, r: 4.5, h: 27, mat: "brick" })).toBe(false);
    expect(tallOk({ kind: "cylinder", at, r: 4, h: 30, mat: "brick" })).toBe(true);
    expect(tallOk({ kind: "beam", from: at, to: { x: 0, y: 0, z: 30 }, w: 1, h: 1, mat: "steel" })).toBe(true);
    expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 26, mat: "brick" })).toBe(true);
  });

  it("planta de ladrillo con dientes de sierra, tres chimeneas con banda, torre de enfriamiento y grúa", () => {
    const s = scene();
    const plant = s.solids.find((x) => x.kind === "prism" && x.mat === "brick" && x.h === PLANT.h)!;
    expect(bounds(plant)).toMatchObject({ min: { x: PLANT.x, y: PLANT.y } });
    expect(s.solids.filter((x) => x.kind === "ramp" && x.mat === "brick")).toHaveLength(5);
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "brick");
    expect(stacks).toHaveLength(3);
    expect(s.stacks).toHaveLength(3);
    STACKS.forEach((st, i) => expect(s.stacks[i]).toEqual({ x: st.x, y: st.y, z: STACK_BASE_H + st.h }));
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "rust" && x.h === 1)).toHaveLength(3); // bandas
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r >= 7)).toHaveLength(4); // torre de enfriamiento
    expect(s.solids.some((x) => x.kind === "prism" && x.h === 20 && x.w === 1.2)).toBe(true); // mástil de la grúa
  });

  it("desvío con seis vagones y locomotora, cinta elevada, subestación, camiones y playa de vías con acopios", () => {
    const s = scene();
    const wagons = s.solids.filter((x) => x.kind === "prism" && x.w === 8 && x.d === 2.4 && x.h === 3);
    expect(wagons).toHaveLength(6);
    for (let i = 0; i < wagons.length; i++) for (let j = i + 1; j < wagons.length; j++) {
      const a = bounds(wagons[i]!), b = bounds(wagons[j]!);
      expect(a.max.x <= b.min.x || b.max.x <= a.min.x).toBe(true);
    }
    const conveyorPieces = s.solids.filter((x) => x.kind === "prism" && ((x.at.z === 6 && x.h === 0.6) || (x.w === 0.8 && x.d === 0.8 && x.h === 6)));
    expect(s.solids.filter((x) => x.kind === "prism" && x.at.z === 6 && x.h === 0.6)).toHaveLength(2); // dos tramos de cinta
    for (const c of conveyorPieces) { const b = bounds(c); expect(b.min.x >= PLANT.x + PLANT.w || b.min.y >= PLANT.y + PLANT.d).toBe(true); } // la cinta no pisa la planta
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 3 && x.d === 3 && x.h === 3 && x.mat === "steel")).toHaveLength(6); // transformadores
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 6 && x.d === 2.4 && x.h === 2.8)).toHaveLength(3); // camiones
    const rails = s.ground.filter((x) => x.kind === "strip" && x.mat === "steel");
    expect(rails.length).toBeGreaterThanOrEqual(RAIL_YARD_X.length * 2 + 2);
    const piles = s.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "rust" || x.mat === "sand"));
    expect(piles).toHaveLength(6);
    for (const p of piles) expect(p.at.x - p.r).toBeGreaterThanOrEqual(Math.max(...RAIL_YARD_X) + 1); // ningún acopio pisa las vías
  });

  it("acentos cian a la altura de los postes y todo el render usa colores del atlas", () => {
    const s = scene();
    expect(s.accents.length).toBeGreaterThanOrEqual(7);
    expect(s.accents.every((a) => a.kind === "dot" && a.color.startsWith("cyan") && a.at.z > 0)).toBe(true);
    const colors = allIsoColors();
    for (const i of buildRenderList([...s.ground, ...s.solids])) expect(colors.has(i.color)).toBe(true);
  });
});
