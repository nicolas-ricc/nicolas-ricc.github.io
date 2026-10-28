import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_Y, inCoverQuad, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { COOLING, PARKING, POWER, PYLON_N, ROAD_Y, SILOS, TANKS, WEST_RAIL_X0, hinterland } from "./hinterland";
import { GREEN_BELT } from "./sprawl-grid";
import { bleedTerrainAt, terrainAt } from "./terrain";

const PORTFOLIO_MATS: readonly Material[] = ["slab", "concrete", "rust", "steel", "road", "rail", "sand", "brick", "leaf", "leafDark", "paving"];
const scene = () => hinterland(createRng(7));
const groundAt = (x: number, y: number) => (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1 ? terrainAt(x, y) : bleedTerrainAt(x, y));
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 3) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1));

describe("hinterland", () => {
  it("es determinístico, cae en Portfolio con materiales de Portfolio y dentro del presupuesto", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
    const s = scene();
    const raised = s.solids.filter((x) => !isFlat(x));
    expect(raised.length).toBeGreaterThan(200); expect(raised.length).toBeLessThan(850);
    for (const x of s.solids) {
      const b = bounds(x);
      expect(b.max.y).toBeLessThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
      expect(PORTFOLIO_MATS).toContain(x.mat);
    }
  });

  it("nada apoya en agua ni en loma; solo silos, torres y pórticos superan 18, y son esbeltos", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (x.kind !== "cone") {
        const g = groundAt(b.min.x, b.min.y);
        if (!(x.kind === "prism" && x.mat === "concrete" && x.at.z === -1)) expect(["water", "river", "sea", "shore", "abyss"]).not.toContain(g); // salvo el muelle, que nace en el agua
        if (b.min.x < WORLD.x0 || b.min.y < WORLD.y0) expect(g === "industrial" || (g === "jungle" && b.min.y >= GREEN_BELT.y0)).toBe(true);
      }
      if (b.max.z > 18) expect(slender(x)).toBe(true);
    }
  });

  it("playa de maniobras con vagones, galpones, tanques, silos, torres con cables, contenedores apilados y selva en el cinturón", () => {
    const s = scene();
    expect(s.ground.filter((g) => g.kind === "strip" && g.mat === "rail").length).toBeGreaterThanOrEqual(14); // 5 vías E-O y 2 N-S, de a dos rieles
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 8 && x.d === 2.4 && x.h === 3).length).toBeGreaterThanOrEqual(12); // vagones
    expect(s.solids.filter((x) => x.kind === "prism" && x.roof === "gable" && x.mat === "concrete").length).toBeGreaterThanOrEqual(3);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r >= 7 && x.sides === 12)).toHaveLength(TANKS.length);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.h === SILOS.h)).toHaveLength(SILOS.cols * SILOS.rows);
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 14 && x.w === 1)).toHaveLength(PYLON_N - 2); // las dos últimas caerían en la feria
    expect(s.solids.filter((x) => x.kind === "prism" && x.d === 0.24).length).toBeGreaterThanOrEqual(2 * (PYLON_N - 4)); // cables
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 6 && x.d === 2.4 && x.h === 2.6 && x.at.z > 0).length).toBeGreaterThan(20); // contenedores apilados
    const belt = s.solids.filter((x) => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark") && x.at.y >= GREEN_BELT.y0 && x.at.y < GREEN_BELT.y1 && x.at.x < WORLD.x0);
    expect(belt.length).toBeGreaterThanOrEqual(20); // 30 antes del corredor del tren (#280): despeja 10 conos del cinturón
  });

  it("acentos cian y colores del atlas", () => {
    const s = scene();
    expect(s.accents.length).toBeGreaterThanOrEqual(8);
    expect(s.accents.every((a) => a.kind === "dot" && a.color.startsWith("cyan"))).toBe(true);
    const colors = allIsoColors();
    for (const i of buildRenderList([...s.ground, ...s.solids])) expect(colors.has(i.color)).toBe(true);
  });

  it("central térmica al norte: sala con fachada, dos chimeneas humeantes, torre de refrigeración, transformadores; calle y estacionamiento; todo dentro del cover y sobre tierra industrial", () => {
    const s = scene();
    expect(s.stacks).toHaveLength(2);
    for (const st of s.stacks) expect(st.z).toBeGreaterThanOrEqual(26);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "concrete" && x.w === POWER.w && x.d === POWER.d && x.facade)).toBe(true);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r === 2 && x.h === 26)).toHaveLength(2);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r === COOLING.r && x.sides === 14)).toBe(true);
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "steel" && x.w === 3 && x.d === 2 && x.h === 3)).toHaveLength(6);
    expect(s.ground.some((g) => g.kind === "strip" && g.mat === "road" && g.width === 6)).toBe(true);
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 1.2 && x.w === 2.2 && bounds(x).min.x >= PARKING.x && bounds(x).max.x <= PARKING.x + PARKING.w).length).toBeGreaterThanOrEqual(10);
    expect(s.solids.filter((x) => x.kind === "cone" && x.mat === "rust" && bounds(x).max.y < -204)).toHaveLength(3); // acopios de carbón
    expect(s.ground.filter((g) => g.kind === "strip" && g.mat === "steel" && g.width === 0.8)).toHaveLength(1); // cinta transportadora
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 1.2 && x.w !== 2.2 && x.mat === "steel" && bounds(x).max.y < -204)).toHaveLength(4); // cerco de la central
    expect(s.accents.filter((a) => a.kind === "dot" && a.color === "cyan" && a.at.y < ROAD_Y)).toHaveLength(5); // 2 farolas del patio de transformadores + 3 de la calle
    const north = s.solids.filter((x) => bounds(x).max.y < -204 && !isFlat(x));
    expect(north.length).toBeGreaterThan(30); expect(north.length).toBeLessThanOrEqual(250);
    for (const x of north) { const b = bounds(x); expect(inCoverQuad((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, 16 / 9, 30)).toBe(true); }
  });

  it("las vías del oeste del astillero siguen por el cinturón verde hasta el borde del sangrado, sin conos encima", () => {
    const s = scene();
    const rails = s.ground.filter((g) => g.kind === "strip" && g.mat === "rail" && g.path[0]!.x === WEST_RAIL_X0 && g.path[1]!.x === 0);
    expect(rails.map((g) => g.kind === "strip" && g.path[0]!.y)).toEqual([131, 134]);
    const sleepers = s.solids.filter((x) => x.kind === "prism" && x.mat === "rust" && x.d === 5 && x.h === 0.3);
    expect(sleepers.length).toBeGreaterThanOrEqual(90);
    for (const x of sleepers) { const b = bounds(x); expect(b.min.x).toBeGreaterThan(WEST_RAIL_X0); expect(b.max.x).toBeLessThan(0); }
    for (const c of s.solids) if (c.kind === "cone" && (c.mat === "leaf" || c.mat === "leafDark")) for (const ry of [131, 134]) expect(Math.abs(c.at.y - ry)).toBeGreaterThanOrEqual(c.r + 1.5);
  });
});
