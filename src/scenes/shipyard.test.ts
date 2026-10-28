import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, type Solid } from "../iso/solids";
import { WORLD } from "../map/geo";
import { allIsoColors } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { AREA_H, AREA_W, STREET_EDGE, shipyard, type Scene } from "./shipyard";

const scene = (): Scene => shipyard(createRng(7));
const all = (s: Scene): Solid[] => [...s.ground, ...s.solids, s.trolley];

describe("shipyard", () => {
  it("es determinística por seed", () => {
    expect(JSON.stringify(shipyard(createRng(7)))).toBe(JSON.stringify(shipyard(createRng(7))));
    expect(JSON.stringify(shipyard(createRng(7)))).not.toBe(JSON.stringify(shipyard(createRng(8))));
  });

  it("todo cae dentro del área", () => {
    for (const s of all(scene())) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 1);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1);
      expect(b.max.x).toBeLessThanOrEqual(AREA_W + 1);
      expect(b.max.y).toBeLessThanOrEqual(AREA_H + 1);
    }
  });

  it("hay galpones a dos aguas en alistamiento, gradas en rampa, un casco, cuadernas y una grúa", () => {
    const s = scene();
    const kinds = (k: Solid["kind"]) => s.solids.filter((x) => x.kind === k);
    const gables = s.solids.filter((x) => x.kind === "prism" && x.roof === "gable");
    expect(gables.filter((x) => x.kind === "prism" && x.at.x > 300)).toHaveLength(2); // los galpones del muelle de alistamiento
    expect(gables.every((x) => x.kind === "prism" && x.at.x > 300)).toBe(true);       // las naves de montaje se fueron de la región nueva
    expect(kinds("ramp").filter((r) => r.kind === "ramp" && r.at.z === 0)).toHaveLength(2); // las gradas; los dientes de sierra van en alto
    expect(kinds("hull").length).toBeGreaterThanOrEqual(1);
    expect(s.weldSpots.length).toBeGreaterThan(10);
    const tall = s.solids.filter((x) => bounds(x).max.z >= 24);
    expect(tall.length).toBeGreaterThanOrEqual(3); // dos patas y la viga
  });

  it("el carro está sobre la viga y su rango cabe entre las gradas", () => {
    const s = scene();
    expect(s.trolley.at.z).toBeGreaterThanOrEqual(24);
    expect(s.trolleyRange[0]).toBeLessThan(s.trolleyRange[1]);
    expect(s.trolley.at.y).toBe(s.trolleyRange[0]);
  });

  it("los acentos son cian y están a la altura de las paredes", () => {
    const s = scene();
    expect(s.accents.length).toBeGreaterThan(8);
    expect(s.accents.every((a) => a.kind === "dot" && a.color.startsWith("cyan") && a.at.z > 0)).toBe(true);
  });

  it("todo el render usa colores del atlas", () => {
    const s = scene();
    const colors = allIsoColors();
    for (const i of buildRenderList(all(s))) expect(colors.has(i.color)).toBe(true);
  });
});

describe("shipyard parte 2", () => {
  it("dique seco: pozo con paredes, compuerta y un casco hundido", () => {
    const s = scene();
    const sunk = s.solids.filter((x) => bounds(x).min.z <= -5);
    expect(sunk.length).toBeGreaterThanOrEqual(6); // 4 paredes + compuerta + casco
    expect(sunk.some((x) => x.kind === "hull")).toBe(true);
    expect(s.ground.some((g) => g.kind === "ground" && g.tris.length > 0 && g.tris.every((t) => t.pts.every((p) => p.z === -6)))).toBe(true);
  });

  it("autos en la playa", () => {
    const s = scene();
    const cars = s.solids.filter((x) => x.kind === "prism" && x.h === 1.5 && x.w === 3);
    expect(cars.length).toBeGreaterThanOrEqual(3);
  });

  it("selva: conos en el SO y en la franja este, nunca sobre la losa", () => {
    const s = scene();
    const cones = s.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark"));
    expect(cones.length).toBeGreaterThanOrEqual(20);
    for (const c of cones) expect(c.at.x < 42 || c.at.x > 300).toBe(true);
  });

  it("muelle de alistamiento: galpones a dos aguas al este del río y escollera", () => {
    const s = scene();
    const sheds = s.solids.filter((x) => x.kind === "prism" && x.roof === "gable" && x.at.x > 300);
    expect(sheds).toHaveLength(2);
    const rocks = s.solids.filter((x) => x.kind === "cone" && x.mat === "rock");
    expect(rocks.length).toBeGreaterThan(30);
  });

  it("faroles: poste de acero con luz cian encima", () => {
    const s = scene();
    const poles = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.w === 0.6 && x.h === 5 && x.at.x > STREET_EDGE && x.at.x < STREET_EDGE + 2);
    expect(poles.length).toBeGreaterThanOrEqual(5);
    for (const p of poles) expect(s.accents.some((a) => a.kind === "dot" && Math.abs(a.at.x - p.at.x) < 1 && Math.abs(a.at.y - p.at.y) < 1 && a.at.z === 5)).toBe(true);
  });
});

describe("shipyard sin la región nueva (#242)", () => {
  const prisms = (s: Scene) => s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism");
  const rails = (s: Scene) => s.ground.filter((x): x is Solid & { kind: "strip" } => x.kind === "strip" && x.mat === "rail");

  it("la región nueva (x 4..99, y −4..99) queda vacía salvo conos de selva", () => {
    for (const x of scene().solids) {
      if (x.kind === "cone") continue;
      const b = bounds(x);
      expect(b.min.x < 99 && b.max.x > 4 && b.min.y < 99 && b.max.y > -4, JSON.stringify(b)).toBe(false);
    }
  });

  it("sin rieles nave→grada, ramal embutido en la calle ni ramal al patio", () => {
    for (const r of rails(scene())) {
      for (const x of [101, 104]) expect(r.path.every((p) => p.x === x), `vertical en x ${x}`).toBe(false);
      for (const y of [40, 47, 60, 67, 30.5, 33.5]) expect(r.path.every((p) => p.y === y), `horizontal en y ${y}`).toBe(false);
    }
  });

  it("no quedan naves, talleres con sus equipos, patio de material ni chatas", () => {
    const s = scene();
    const ps = prisms(s);
    expect(ps.filter((x) => x.roof === "gable" && x.w === 90 && x.d === 16)).toEqual([]);           // naves de montaje
    expect(ps.filter((x) => x.roof === "step" && x.w === 24 && x.d === 14 && x.at.y === 80)).toEqual([]); // talleres
    expect(ps.filter((x) => x.w === 2 && x.d === 2 && x.h === 1 && x.at.z === 7)).toEqual([]);      // equipos en el techo
    expect(ps.filter((x) => x.w === 10 && x.d === 2 && x.h === 0.5)).toEqual([]);                    // chapas
    expect(ps.filter((x) => x.w === 14 && x.d === 1 && x.h === 1)).toEqual([]);                      // caños
    expect(ps.filter((x) => x.roof === "step" && x.w === 9 && x.d === 4 && x.h === 3)).toEqual([]);  // secciones de casco
    expect(ps.filter((x) => x.w === 4.4 && x.d === 8 && x.h === 3)).toEqual([]);                     // chatas
    const cyl = s.solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
    expect(cyl.filter((c) => (c.at.x === 80 && c.at.y === 10) || (c.at.x === 92 && c.at.y === 22))).toEqual([]); // tanques del patio
    expect(cyl.filter((c) => c.r === 1.5 && c.h === 1.5)).toEqual([]);                               // bobinas
  });

  it("la vía del oeste sigue terminando en x 104 con durmientes; el camión de la calle sigue", () => {
    const s = scene();
    for (const y of [131, 134]) {
      expect(rails(s).some((r) => r.path.length === 2 && r.path[0]!.x === 0 && r.path[0]!.y === y && r.path[1]!.x === 104 && r.path[1]!.y === y), `vía y ${y}`).toBe(true);
    }
    expect(prisms(s).filter((x) => x.mat === "rust" && x.w === 1 && x.d === 5 && x.h === 0.3 && x.at.y === 130).length).toBeGreaterThanOrEqual(20);
    expect(prisms(s).some((x) => x.mat === "rust" && x.at.x === 105 && x.at.y === 88 && x.w === 3 && x.d === 7 && x.h === 2.5)).toBe(true);
  });
});
