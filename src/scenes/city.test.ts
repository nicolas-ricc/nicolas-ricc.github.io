import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, type Solid } from "../iso/solids";
import { QUAY_X, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { AVENUE, BOULEVARD, BRIDGE, CITY_EDGE, COLLAPSED, ROWS, CRATERS, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_RING, FALLEN_BLOCK, MALECON, PLAZA, TOWER, WEST_QUAY, blocks, estuaryEast, inBlock, inCrater } from "./city-grid";
import { PLINTH_H, TOWER_H, city, type CityScene } from "./city";
import { CAR } from "../kit/props";
import { FIXED, FOOTBRIDGE_LOT, MAX_BUILDING_H, WATER_TOWER_BLOCK, assign } from "../city/zoning";
import { SEED } from "../world/assemble";
import { zoneRng } from "./world";

const scene = (): CityScene => city(createRng(7), createRng(8), createRng(9));
const all = (s: CityScene): Solid[] => [...s.ground, ...s.solids];
const inRect = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, r: { x: number; y: number; w: number; d: number }) =>
  b.min.x >= r.x - 1e-6 && b.max.x <= r.x + r.w + 1e-6 && b.min.y >= r.y - 1e-6 && b.max.y <= r.y + r.d + 1e-6;
/** Interior estricto de la plaza: una senda que termina justo sobre el borde (y = PLAZA.y) no la pisa. */
const inPlaza = (x: number, y: number) => x > PLAZA.x && x < PLAZA.x + PLAZA.w && y > PLAZA.y && y < PLAZA.y + PLAZA.d;
const DISTRICT = blocks().filter((b) => b.kind === "district" || b.kind === "site");
const inDistrict = (s: Solid) => DISTRICT.some((b) => inRect(bounds(s), b));
const inBlockXY = (x: number, y: number) => blocks().some((b) => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.d + 1);
/** Las manzanas fijas (landmarks): pueden llegar a 24 sobre el zócalo, con remate. */
const FIXED_BLOCKS = blocks().filter((b) => b.kind !== "plaza" && FIXED.some((f) => f.x === b.x && f.y === b.y));
const inFixed = (s: Solid) => FIXED_BLOCKS.some((b) => inRect(bounds(s), b));
const inFootbridge = (x: number, y: number) => x >= FOOTBRIDGE_LOT.x && x <= FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w && y >= FOOTBRIDGE_LOT.y && y <= FOOTBRIDGE_LOT.y + FOOTBRIDGE_LOT.d;
/** Las cuatro piezas que pueden pasar de 21: el prisma de la torre, su cornisa, la sala de máquinas y el mástil. Los conos y las enredaderas de la base no quedan exentos. */
const isTowerPiece = (s: Solid) => {
  const b = bounds(s);
  return s.kind !== "cone" && b.min.x >= TOWER.x - 0.6 && b.max.x <= TOWER.x + TOWER.w + 0.6 && b.min.y >= TOWER.y - 0.6 && b.max.y <= TOWER.y + TOWER.d + 0.6;
};

// la fila sur frente a la torre: PLAZA.x - 6 .. PLAZA.x + PLAZA.w + 6, la banda que el ruling del controller topa en 10
const ROW_SOUTH = ROWS[3], FRONT_X0 = PLAZA.x - 6, FRONT_X1 = PLAZA.x + PLAZA.w + 6;

const CITY_MATS: readonly Material[] = ["office", "officeDark", "glass", "asphalt", "paving", "plaza", "curtain", "stone", "copper", "leaf", "leafDark", "water", "steel", "rust", "plaster", "terracotta", "marble", "awning", "deck"];

describe("city", () => {
  it("es determinística por seed", () => {
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).toBe(JSON.stringify(city(createRng(7), createRng(8), createRng(9))));
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).not.toBe(JSON.stringify(city(createRng(8), createRng(8), createRng(9))));
  });

  it("todo cae en la zona Resume salvo la selva del cinturón, y usa solo materiales de la ciudad", () => {
    for (const s of all(scene())) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 3); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X + 1); // el distrito crece hasta el borde oeste del mundo
      expect(b.max.y).toBeLessThanOrEqual(WORLD.y1 + 1);
      if (s.kind !== "cone") expect(b.min.y).toBeGreaterThanOrEqual(ZONE_SPLIT_Y - 1);
      expect(CITY_MATS).toContain(s.mat);
      if (s.mat === "steel" || s.mat === "rust") expect(["prism", "cylinder"]).toContain(s.kind); // solo mobiliario y autos
    }
    const mats = new Set(all(scene()).map((s) => s.mat));
    for (const m of ["plaster", "terracotta", "marble", "awning"] as const) expect(mats.has(m)).toBe(true);
  });

  it("hay un zócalo por manzana construida y los edificios con fachada caen en su manzana", () => {
    const s = scene();
    const plinths = s.solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.h === PLINTH_H && x.at.z === 0 && x.w === 24 && x.d === 18);
    expect(plinths.length).toBeGreaterThanOrEqual(40);
    const buildings = s.solids.filter((x) => (x.kind === "prism" || x.kind === "poly" || x.kind === "cylinder") && x.facade !== undefined);
    expect(buildings.length).toBeGreaterThanOrEqual(90);
    for (const b of buildings) {
      if (isTowerPiece(b)) continue;
      expect(b.kind !== "prism" || b.h <= (inDistrict(b) || inFixed(b) ? 24 : MAX_BUILDING_H)).toBe(true);
      expect(blocks().some((blk) => inRect(bounds(b), blk))).toBe(true); // dentro de una manzana
    }
  });

  it("la torre mide 30 sobre la plaza, tiene fachada 8×4 con el piso 5 encendido, y nada más supera 21", () => {
    const s = scene();
    const tower = s.solids.find((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.h === TOWER_H)!;
    expect(tower).toBeDefined();
    expect(tower.mat).toBe("officeDark");
    expect(tower.facade).toMatchObject({ floors: 8, cols: 4, litFloor: 5, base: "portico" });
    expect(inRect(bounds(tower), PLAZA)).toBe(true);
    expect(s.tower.litWindows.length).toBe(8); // 4 columnas × 2 paredes visibles
    expect(s.tower.litWindows.every((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
    expect(s.tower.antenna.z).toBeGreaterThan(TOWER_H + 5);
    expect(s.tower.paperWindow.x).toBeCloseTo(TOWER.x + TOWER.w, 6); // pared este
    for (const x of s.solids) if (!isTowerPiece(x)) expect(bounds(x).max.z).toBeLessThanOrEqual(inDistrict(x) || inFixed(x) ? 25 : 21); // el distrito y los landmarks llegan a 24 sobre el zócalo, con remate
  });

  it("frente a la torre ningún edificio supera 10 ni nada llega a 15 (las ventanas encendidas se pintan arriba de todo)", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (!(b.min.y >= ROW_SOUTH && b.min.y < DISTRICT_ROWS[0] && b.min.x >= FRONT_X0 && b.max.x <= FRONT_X1)) continue; // solo la fila vieja frente a la torre, no el distrito
      if (x.kind === "prism" && x.facade) expect(x.h).toBeLessThanOrEqual(10);
      expect(b.max.z).toBeLessThanOrEqual(15);
    }
  });

  it("la plaza tiene baldosas rotas y las manzanas devoradas, selva sobre su suelo", () => {
    const s = scene();
    const plaza = s.ground.filter((g) => g.kind === "ground" && g.mat === "plaza");
    expect(plaza).toHaveLength(1);
    const tris = plaza[0]!.kind === "ground" ? plaza[0]!.tris : [];
    expect(tris.length).toBe((PLAZA.w / 6) * (PLAZA.d / 6) * 2);
    expect(tris.some((t) => (t.toneOffset ?? 0) !== 0)).toBe(true);
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "leafDark").length).toBeGreaterThanOrEqual(3);
  });

  it("ningún cono pisa asfalto fuera de cráteres, manzanas y la ribera; los acentos son ámbar, ventanas o neones con sus Bleed", () => {
    const s = scene();
    for (const c of s.solids) {
      if (c.kind !== "cone") continue;
      // al sur del distrito la ribera este es selva sin grilla (ya no hay manzanas del lado este)
      const onCity = c.at.x >= CITY_EDGE.west && c.at.x < MALECON.x0 && c.at.y >= CITY_EDGE.north && c.at.y < CITY_EDGE.south && !(c.at.x > QUAY_X && c.at.x < EAST_RING.x0) && !(c.at.x > EAST_RING.x0 && c.at.y >= DISTRICT_BANK_Y);
      if (onCity) expect(inBlock(c.at.x, c.at.y) || inCrater(c.at.x, c.at.y) || (c.at.y >= BOULEVARD.y0 && c.at.y <= BOULEVARD.y1)).toBe(true);
    }
    expect(s.accents.length).toBeGreaterThan(6);
    const NEON = ["magenta", "magentaBleed", "cyan", "cyanBleed"];
    expect(s.accents.every((a) => a.color.startsWith("amber") || a.color === "windowWarm" || a.color === "windowCool" || NEON.includes(a.color))).toBe(true);
    expect(s.accents.filter((a) => a.color === "windowWarm" || a.color === "windowCool").length).toBeGreaterThanOrEqual(100);
  });

  it("el rng de las luces no cambia la ciudad, solo sus luces", () => {
    const a = city(createRng(7), createRng(8), createRng(9)), b = city(createRng(7), createRng(8), createRng(10));
    expect(JSON.stringify(b.solids)).toBe(JSON.stringify(a.solids));
    expect(JSON.stringify(b.ground)).toBe(JSON.stringify(a.ground));
    expect(JSON.stringify(b.lights)).not.toBe(JSON.stringify(a.lights));
  });

  it("todo el render usa colores del atlas", () => {
    const s = scene();
    const colors = allIsoColors();
    for (const i of buildRenderList(all(s))) expect(colors.has(i.color)).toBe(true);
  });

  it("avenida: boulevard, carriles, sendas y semáforos; faroles solo en avenida, puente, plaza y malecón", () => {
    const s = scene();
    const strips = s.ground.filter((g) => g.kind === "strip");
    expect(strips.length).toBeGreaterThan(60);
    expect(strips.length).toBeLessThanOrEqual(150);
    expect(strips.every((g) => g.kind === "strip" && g.mat === "paving" && g.z > 0 && g.z < 0.1)).toBe(true);
    // ninguna raya pisa el estuario (el suelo se dibuja encima del agua): el anillo este se corta donde entra el agua
    for (const g of strips) if (g.kind === "strip") for (const p of g.path) expect(p.x <= QUAY_X || p.x > estuaryEast(p.y)).toBe(true);
    // ninguna raya cae sobre la plaza: el suelo se dibuja en orden de inserción y la taparía
    for (const g of strips) if (g.kind === "strip") for (const p of g.path) expect(inPlaza(p.x, p.y)).toBe(false);
    // ninguna raya del anillo este llega a la franja de selva de la ribera (salvo el cruce de la avenida)
    for (const g of strips) {
      if (g.kind !== "strip" || g.mat !== "paving" || g.width !== 0.4) continue;
      if (!g.path.some((p) => p.x > EAST_RING.x0)) continue;
      for (const p of g.path) expect(p.y <= DISTRICT_BANK_Y || (p.y >= AVENUE.y0 && p.y <= AVENUE.y1)).toBe(true);
    }
    // los dos charcos de luz sí caen enteros dentro de la plaza (alpha 0.25: el reloj y el cartel del distrito también son amberBleed, con otro alpha; se excluyen los charcos de neones de bares)
    const neonAccents = new Set(s.lights.neons.flatMap((n) => n.accents)); // los neones de bares ámbar también dejan un charco (otro lugar: ante su pared)
    const spills = s.accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.25 && !neonAccents.has(a));
    expect(spills.length).toBeGreaterThanOrEqual(2);
    for (const sp of spills) if (sp.kind === "poly") for (const p of sp.pts) expect(inPlaza(p.x, p.y)).toBe(true);
    const boulevard = s.solids.filter((x) => x.kind === "prism" && x.mat === "leafDark" && x.at.z === 0); // no la terraza verde de una torre de vidrio del distrito
    expect(boulevard.length).toBeGreaterThanOrEqual(8);
    expect(boulevard.every((x) => bounds(x).min.y >= BOULEVARD.y0 && bounds(x).max.y <= BOULEVARD.y1)).toBe(true);
    const lamps = s.accents.filter((a) => a.kind === "dot" && a.color === "amber");
    expect(lamps.length).toBeGreaterThanOrEqual(20);
    for (const l of lamps) {
      if (l.kind !== "dot") continue;
      const onAvenue = l.at.y >= AVENUE.y0 - 3 && l.at.y <= AVENUE.y1 + 3, onMalecon = l.at.x >= MALECON.x0, onPlaza = inRect({ min: l.at, max: l.at }, PLAZA);
      expect(onAvenue || onMalecon || onPlaza || inFootbridge(l.at.x, l.at.y) || inBlockXY(l.at.x, l.at.y)).toBe(true); // las recetas del kit traen sus luces (obra, helipuerto, baliza, faroles de la estación)
    }
  });

  it("puente: tablero sobre el agua de muelle a anillo, pilotes hasta el fondo, rampas en las cabeceras", () => {
    const s = scene();
    const deck = s.solids.find((x) => x.kind === "prism" && x.mat === "asphalt" && x.w > 60)!;
    expect(deck.kind === "prism" && deck.at.x).toBe(WEST_QUAY.x0);
    expect(deck.kind === "prism" && deck.at.x + deck.w).toBe(EAST_RING.x1);
    expect(deck.kind === "prism" && deck.at.z).toBe(1.2);
    const piers = s.solids.filter((x) => x.kind === "prism" && x.mat === "plaza" && x.at.z === -1 && x.at.y === BRIDGE.y0);
    expect(piers).toHaveLength(4);
    const ramps = s.solids.filter((x) => x.kind === "ramp" && x.mat === "asphalt" && x.at.y === BRIDGE.y0);
    expect(ramps.map((r) => r.kind === "ramp" && r.dir).sort()).toEqual(["e", "w"]);
  });

  it("muelle oeste y malecón: muros desde el agua, parapeto, escaleras dentro de la zona", () => {
    const s = scene();
    const walls = s.solids.filter((x) => x.kind === "prism" && x.at.z === -1 && x.d > 30);
    expect(walls.length).toBeGreaterThanOrEqual(4); // dos tramos por lado
    expect(walls.some((x) => x.kind === "prism" && x.mat === "plaza" && x.at.x === WEST_QUAY.x0)).toBe(true);
    expect(walls.some((x) => x.kind === "prism" && x.mat === "paving" && x.at.x === MALECON.x0)).toBe(true);
    const parapet = s.solids.filter((x) => x.kind === "prism" && x.at.x >= MALECON.x1 - 2 && x.h === 0.8);
    expect(parapet.length).toBeGreaterThanOrEqual(2);
    const stairs = s.solids.filter((x) => x.kind === "ramp" && x.at.z === -1);
    expect(stairs.length).toBeGreaterThanOrEqual(2);
    for (const st of stairs) expect(bounds(st).max.x).toBeLessThanOrEqual(ZONE_SPLIT_X);
  });

  it("derrumbe: rampa al agua, bloques hundidos y el cuarto caído en la calle frente al malecón", () => {
    const s = scene();
    const sunk = s.solids.filter((x) => x.kind === "prism" && x.mat === "officeDark" && x.at.z < 0);
    expect(sunk.length).toBeGreaterThanOrEqual(3);
    for (const b of sunk) expect(b.kind === "prism" && b.at.y).toBeGreaterThanOrEqual(240);
    // el cuarto bloque, caído en la calle frente al malecón (la spec lo pide; el mar frente al malecón ya es zona Blog)
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "officeDark" && x.at.z === 0 && x.h <= 1 && x.at.x === FALLEN_BLOCK.x && x.at.y === FALLEN_BLOCK.y && x.w === FALLEN_BLOCK.w && x.d === FALLEN_BLOCK.d)).toBe(true);
    expect(s.solids.some((x) => x.kind === "ramp" && x.mat === "asphalt" && x.dir === "w" && x.at.y === COLLAPSED.y)).toBe(true);
  });

  it("autos: una sola medida, no caen en manzana ni cráter, y ninguno se superpone con otro", () => {
    const s = scene();
    const cars = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && (x.mat === "steel" || x.mat === "rust") && x.h === 1.2);
    expect(cars.length).toBeGreaterThanOrEqual(20);
    expect(new Set(cars.map((c) => `${c.w}x${c.d}x${c.h}`))).toEqual(new Set([`${CAR.w}x${CAR.d}x1.2`]));
    for (const c of cars) {
      expect(inBlock(c.at.x + 1.5, c.at.y + 0.75)).toBe(false);
      expect(inCrater(c.at.x + 1.5, c.at.y + 0.75)).toBe(false);
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i]!, b = cars[j]!;
      const overlap = a.at.x < b.at.x + b.w && a.at.x + a.w > b.at.x && a.at.y < b.at.y + b.d && a.at.y + a.d > b.at.y;
      expect(overlap).toBe(false);
    }
  });

  it("selva: cinturón norte, ribera este y cráteres, más de 60 conos (los bordes oeste y sur son del distrito tecnológico)", () => {
    const s = scene();
    const cones = s.solids.filter((x) => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark"));
    expect(cones.length).toBeGreaterThan(60);
    expect(cones.some((c) => c.kind === "cone" && c.at.y < CITY_EDGE.north)).toBe(true);        // cinturón
    expect(cones.some((c) => c.kind === "cone" && c.at.x < CITY_EDGE.west)).toBe(false);        // borde oeste: asfalto del distrito tecnológico
    expect(cones.some((c) => c.kind === "cone" && c.at.x > QUAY_X && c.at.x < EAST_RING.x0)).toBe(true); // ribera este
    for (const cr of CRATERS) expect(cones.some((c) => c.kind === "cone" && inCrater(c.at.x, c.at.y) && Math.hypot(c.at.x - cr.x, c.at.y - cr.y) <= cr.r)).toBe(true);
  });

  it("la avenida llega al borde oeste nuevo y el malecón baja hasta 326", () => {
    const s = scene();
    const carriageways = [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2];
    expect(s.ground.some((g) => g.kind === "strip" && g.mat === "paving" && g.width === 0.4 && g.path[0]!.x <= CITY_EDGE.west + 4 && carriageways.includes(g.path[0]!.y))).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "paving" && x.at.x === MALECON.x0 && x.at.y + x.d >= MALECON.y1)).toBe(true);
  });

  it("neon: ≥ 6 carteles coplanares en y y una luz sobre cada farol del malecón", () => {
    const worldCity = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)); // la semilla real del mundo
    expect(worldCity.neon.signs.length).toBeGreaterThanOrEqual(6);
    const c = scene();
    expect(c.neon.signs.length).toBeGreaterThanOrEqual(6);
    for (const s of [...c.neon.signs, ...worldCity.neon.signs]) {
      if (s.kind !== "poly") throw new Error("cartel no poly");
      expect(s.pts).toHaveLength(4);
      expect(new Set(s.pts.map((p) => p.y)).size).toBe(1);
    }
    const bulbs = c.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.at.x === MALECON.x1 - 3 + 0.3);
    expect(c.neon.malecon).toHaveLength(8);
    for (const p of c.neon.malecon) expect(bulbs.some((b) => b.kind === "dot" && b.at.x === p.x && b.at.y === p.y && b.at.z + 0.4 === p.z)).toBe(true);
  });

  it("las props salen del kit: city.ts y streets.ts no arman bolardos, autos, semáforos, tanques ni charcos a mano", () => {
    for (const f of ["src/scenes/city.ts", "src/city/streets.ts", "src/city/fixed.ts"]) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
      expect(src).not.toMatch(/r: 0\.4, h: 0\.8/);          // bolardo
      expect(src).not.toMatch(/3, 1\.5, 1\.2/);             // auto
      expect(src).not.toMatch(/0\.3, 0\.3, 4, "steel"/);    // semáforo
      expect(src).not.toMatch(/PUDDLE_RADII/);              // charco
      expect(src).not.toMatch(/r: 1\.2, h: 2, mat: "rust"/); // tanque de agua
    }
  });

  it("placed: una pieza por manzana asignada, con el barrio, la receta y el primer sólido de la pieza", () => {
    const s = scene(), expected = assign(createRng(7), createRng(8));
    expect(s.placed.map((p) => [p.placed.block.x, p.placed.block.y, p.placed.barrio, p.placed.recipe])).toEqual(expected.map((p) => [p.block.x, p.block.y, p.barrio, p.recipe]));
    for (const { piece, solidOffset } of s.placed) {
      expect(piece.solids.length).toBeGreaterThan(0);
      expect(s.solids[solidOffset]).toBe(piece.solids[0]);
      expect(s.solids.slice(solidOffset, solidOffset + piece.solids.length)).toEqual(piece.solids);
    }
  });

  it("torre de agua en el patio de (12, 164) y puente peatonal de piedra sobre el estuario", () => {
    const s = scene();
    const host = s.placed.find((p) => p.placed.block.x === WATER_TOWER_BLOCK.x && p.placed.block.y === WATER_TOWER_BLOCK.y)!;
    expect(host.placed.recipe).toBe("patioResidential");
    const court = host.piece.courtyard!;
    const tank = s.solids.find((x) => x.kind === "dome" && x.mat === "copper" && x.r === 2.2);
    expect(tank).toBeDefined();
    if (tank?.kind !== "dome") throw new Error("sin cúpula de la torre de agua");
    expect(tank.at.x).toBeCloseTo(court.x + court.w / 2, 6);
    expect(tank.at.y).toBeCloseTo(court.y + court.d / 2, 6);
    const deck = s.solids.find((x) => x.kind === "prism" && x.mat === "stone" && x.at.x === FOOTBRIDGE_LOT.x && x.w === FOOTBRIDGE_LOT.w);
    expect(deck).toBeDefined();
    const b = bounds(deck!);
    expect(b.min.y).toBeGreaterThanOrEqual(174);
    expect(b.max.y).toBeLessThanOrEqual(178);
    expect(b.min.x).toBe(WEST_QUAY.x1);
    expect(b.max.x).toBeGreaterThan(estuaryEast(178));
  });

  it("carteles del distrito: cian o magenta opacos, 1.6 de alto, 0.4 delante de la cara sur de un edificio del distrito", () => {
    const s = scene();
    for (const sign of s.neon.signs) {
      if (sign.kind !== "poly") throw new Error("cartel no poly");
      expect(["cyan", "magenta"]).toContain(sign.color);
      expect(sign.alpha).toBe(1);
      const zs = sign.pts.map((p) => p.z), y = sign.pts[0]!.y;
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1.6, 6);
      const wall = s.solids.find((w) => w.kind === "prism" && !!w.facade && inDistrict(w) && Math.abs(w.at.y + w.d + 0.4 - y) < 1e-6);
      expect(wall).toBeDefined();
    }
  });
});
