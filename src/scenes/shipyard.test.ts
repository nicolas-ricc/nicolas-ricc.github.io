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

  it("lo viejo no vuelve a su lugar viejo: naves, talleres, tanques del patio ni chatas (#247)", () => {
    const s = scene();
    const ps = prisms(s);
    expect(ps.filter((x) => x.roof === "gable" && x.w === 90 && x.d === 16 && (x.at.y === 36 || x.at.y === 56))).toEqual([]); // naves en ROW_Y
    expect(ps.filter((x) => x.roof === "step" && x.w === 24 && x.d === 14 && x.at.y === 80)).toEqual([]);                     // talleres viejos
    expect(ps.filter((x) => x.w === 4.4 && x.d === 8 && x.h === 3)).toEqual([]);                                               // chatas
    const cyl = s.solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
    expect(cyl.filter((c) => (c.at.x === 80 && c.at.y === 10) || (c.at.x === 92 && c.at.y === 22))).toEqual([]); // tanques del patio viejo
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

describe("shipyard en la banda norte (#247)", () => {
  const prisms = (s: Scene) => s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism");
  const cylinders = (s: Scene) => s.solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
  const at = (x: Solid & { kind: "prism" }) => [x.at.x, x.at.y, x.at.z];
  const box = (ss: Solid[]) => {
    const bs = ss.map(bounds);
    return { x0: Math.min(...bs.map((b) => b.min.x)), y0: Math.min(...bs.map((b) => b.min.y)), x1: Math.max(...bs.map((b) => b.max.x)), y1: Math.max(...bs.map((b) => b.max.y)) };
  };
  type Box = ReturnType<typeof box>;
  const apart = (a: Box, b: Box) => a.x1 <= b.x0 + 1e-9 || b.x1 <= a.x0 + 1e-9 || a.y1 <= b.y0 + 1e-9 || b.y1 <= a.y0 + 1e-9;

  const halls = (s: Scene) => prisms(s).filter((x) => x.roof === "gable" && x.w === 90 && x.d === 16 && x.h === 10 && x.mat === "concrete");
  const forklifts = (s: Scene) => prisms(s).filter((x) => x.at.z === 0 && x.h === 2 && ((x.mat === "rust" && x.w === 2 && x.d === 3) || (x.mat === "steel" && x.w === 3 && x.d === 2)) && x.at.y < 0);
  const workshops = (s: Scene) => prisms(s).filter((x) => x.roof === "step" && x.w === 24 && x.d === 14 && x.h === 7 && x.mat === "concrete");
  const units = (s: Scene) => prisms(s).filter((x) => x.mat === "steel" && x.w === 2 && x.d === 2 && x.h === 1 && x.at.z === 7);
  const yard = (s: Scene): Solid[] => [
    ...prisms(s).filter((x) => (x.w === 10 && x.d === 2 && x.h === 0.5) || (x.w === 14 && x.d === 1 && x.h === 1) || (x.roof === "step" && x.w === 9 && x.d === 4 && x.h === 3)),
    ...cylinders(s).filter((c) => (c.r === 1.5 && c.h === 1.5) || (c.mat === "concrete" && ((c.at.x === 174 && c.at.y === -54) || (c.at.x === 186 && c.at.y === -42)))),
  ];
  const band = (s: Scene) => s.solids.filter((x) => x.kind !== "cone" && bounds(x).max.y < 0 && bounds(x).min.x < 198);

  it("naves a dos aguas: dos gable 90×16×10 en HALL_ROWS_Y con 4 autoelevadores", () => {
    const s = scene();
    expect(halls(s).map(at)).toEqual([[10, -52, 0], [10, -32, 0]]);
    expect(Math.max(...halls(s).map((h) => bounds(h).max.z))).toBeCloseTo(13.5, 9); // cumbrera
    const fl = forklifts(s).map((x) => [x.mat, x.at.x, x.at.y]);
    expect(fl).toHaveLength(4);
    expect(fl).toEqual(expect.arrayContaining([["rust", 92, -50], ["rust", 92, -30], ["steel", 12, -41], ["steel", 12, -21]]));
  });

  it("talleres con techo escalonado y equipos en el techo", () => {
    const s = scene();
    const ws = workshops(s);
    expect(ws.map(at)).toEqual([[106, -33, 0], [134, -33, 0]]);
    expect(s.solids.filter((x) => x.kind === "prism" && x.roof === "step").length).toBeGreaterThanOrEqual(2);
    expect(units(s).map((x) => [x.at.x, x.at.y]).sort((a, b) => a[0]! - b[0]!)).toEqual([[109, -30], [124, -23], [137, -30], [152, -23]]);
  });

  it("patio de material: tanques cilíndricos y pilas apiladas, trasladado (+94, −64)", () => {
    const s = scene();
    expect(cylinders(s).filter((c) => c.r >= 4).length).toBeGreaterThanOrEqual(3); // dos en el patio, uno en alistamiento
    expect(s.solids.filter((x) => x.kind === "prism" && x.at.z > 0 && x.at.z < 3 && x.h <= 1).length).toBeGreaterThanOrEqual(5); // apilados
    const plates = prisms(s).filter((x) => x.w === 10 && x.d === 2 && x.h === 0.5);
    expect(plates.filter((x) => x.at.z === 0).map(at)).toEqual([[104, -58, 0], [118, -58, 0], [104, -50, 0], [118, -50, 0], [132, -56, 0]]);
    const pipes = prisms(s).filter((x) => x.w === 14 && x.d === 1 && x.h === 1 && x.mat === "rust");
    expect(pipes).toHaveLength(12);
    expect(pipes.filter((x) => x.at.y === -42 || x.at.y === -44).map((x) => [x.at.x, x.at.y])).toEqual([[104, -42], [122, -42], [140, -44]]);
    const coils = cylinders(s).filter((c) => c.r === 1.5 && c.h === 1.5 && c.mat === "rust" && c.sides === 8);
    expect(coils.map((c) => [c.at.x, c.at.y])).toEqual([[149, -57], [154, -57], [159, -57], [149, -52], [154, -52], [159, -52]]);
    const sections = prisms(s).filter((x) => x.roof === "step" && x.w === 9 && x.d === 4 && x.h === 3 && x.mat === "steel");
    expect(sections.map(at)).toEqual([[150, -46, 0], [162, -46, 0], [150, -40, 0], [162, -40, 0]]);
    const tanks = cylinders(s).filter((c) => c.mat === "concrete" && c.at.y < 0).map((c) => [c.at.x, c.at.y, c.r, c.h]);
    expect(tanks).toEqual([[174, -54, 5, 8], [186, -42, 4, 6]]);
    const b = box(yard(s));
    expect(b.x0).toBeGreaterThanOrEqual(104); expect(b.x1).toBeLessThanOrEqual(192);
    expect(b.y0).toBeGreaterThanOrEqual(-59); expect(b.y1).toBeLessThanOrEqual(-35.7);
  });

  it("el rng da lo mismo que en main (seed 7): autos, secciones prefabricadas y chatarra", () => {
    // valores de origin/main (a34dec0) medidos con tsx: el orden de llamadas de main consume el rng igual
    const ps = prisms(scene());
    expect(ps.filter((x) => x.h === 1.5 && x.w === 3).map((x) => [x.at.x, x.at.y, x.mat])).toEqual([[65, 102, "steel"], [73, 116, "steel"], [53, 116, "rust"], [57, 102, "steel"], [73, 102, "rust"]]);
    expect(ps.filter((x) => x.mat === "steel" && x.w === 9 && x.d === 5 && x.h === 3).map((x) => [x.at.x, x.at.y])).toEqual([[112, 82], [136, 82], [148, 82], [112, 90], [124, 90], [136, 90], [148, 90]]);
    expect(ps.filter((x) => x.w === 3 && x.d === 2 && x.h === 1 && x.at.x >= 302).map((x) => [x.at.x, x.at.y])).toEqual([[303, 140], [315, 136], [319, 140], [317, 140], [322, 130], [306, 133]]);
  });

  it("naves ↔ talleres ↔ patio apartados (cajas disjuntas, 1e-9)", () => {
    const s = scene();
    const ws = workshops(s), us = units(s);
    const groups: Box[] = [
      ...halls(s).map((h) => box([h])),
      ...ws.map((w) => box([w, ...us.filter((u) => u.at.x >= w.at.x && u.at.x < w.at.x + w.w)])),
      box(yard(s)),
    ];
    expect(groups).toHaveLength(5);
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) expect(apart(groups[i]!, groups[j]!), `${i} ↔ ${j}`).toBe(true);
  });

  it("la banda norte: todo sólido con max.y < 0 (salvo muelle, bolardos y conos) cae en x 10..192, y −59..−13 y no supera z 22", () => {
    const bs = band(scene()).map(bounds);
    expect(bs.length).toBeGreaterThanOrEqual(40); // naves, autoelevadores, talleres, equipos y patio: sin esto pasaría vacío
    for (const b of bs) {
      const where = JSON.stringify(b);
      expect(b.min.x, where).toBeGreaterThanOrEqual(10); expect(b.max.x, where).toBeLessThanOrEqual(192);
      expect(b.min.y, where).toBeGreaterThanOrEqual(-59); expect(b.max.y, where).toBeLessThanOrEqual(-13);
      expect(b.max.z, where).toBeLessThanOrEqual(22);
    }
  });
});
