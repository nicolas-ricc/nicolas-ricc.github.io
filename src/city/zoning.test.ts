import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { RECIPES } from "../kit/index";
import { LANDMARK_MAX_H } from "../kit/piece";
import { PLINTH_H } from "../scenes/city-pieces";
import { BLOCK_D, BLOCK_W, SIDEWALK, SITE, STREET, TOWER, WEST_QUAY, blocks, estuaryEast, type Block } from "../scenes/city-grid";
import { zoneRng } from "../scenes/world";
import { SEED } from "../map/seed";
import { CATALOGUE, FIXED, FOOTBRIDGE_LOT, MAX_BUILDING_H, MAX_DISTRICT_H, NO_PLINTH, WATER_TOWER_BLOCK, assign, barrioOf, maxDistrictHeight, maxHeightFor, openSides, waterTowerLot, type Barrio, type Placed } from "./zoning";

const key = (b: { x: number; y: number }): string => `${b.x},${b.y}`;
const blockAt = (x: number, y: number): Block => blocks().find((b) => b.x === x && b.y === y && b.kind !== "plaza")!;
const cells = (barrio: Barrio): string[] => blocks().filter((b) => b.kind !== "plaza" && barrioOf(b) === barrio).map(key).sort();
const sorted = (xs: [number, number][]): string[] => xs.map(([x, y]) => key({ x, y })).sort();
const worldAssign = (): Placed[] => assign(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1));
const sceneAssign = (): Placed[] => assign(createRng(7), createRng(8));
const BARRIOS: readonly Barrio[] = ["centro", "bares", "residencial", "civico", "ribera", "distrito"];

describe("zoning", () => {
  it("toda manzana tiene barrio y la unión de barrios reproduce blocks()", () => {
    const all = blocks();
    for (const b of all) expect(BARRIOS).toContain(barrioOf(b));
    const union = BARRIOS.flatMap((z) => all.filter((b) => barrioOf(b) === z));
    expect(union.map((b) => `${key(b)},${b.kind}`).sort()).toEqual(all.map((b) => `${key(b)},${b.kind}`).sort());
  });

  it("bares son exactamente las seis manzanas del muelle", () => {
    expect(cells("bares")).toEqual(sorted([[102, 164], [132, 164], [162, 164], [102, 188], [132, 188], [162, 188]]));
  });

  it("centro, residencial, cívico, ribera y distrito según la tabla", () => {
    expect(cells("centro")).toEqual(sorted([[72, 164], [72, 188], [42, 218], [72, 242], [102, 242], [132, 242], [162, 242]]));
    expect(cells("residencial")).toEqual(sorted([[12, 164], [12, 188], [12, 218], [12, 242], [42, 164], [42, 188]]));
    expect(cells("civico")).toEqual(sorted([[72, 218], [162, 218], [42, 242]]));
    expect(barrioOf(blocks().find((b) => b.kind === "plaza")!)).toBe("civico");
    expect(cells("ribera")).toEqual(blocks().filter((b) => b.bank === "east").map(key).sort());
    expect(barrioOf(blocks().find((b) => b.kind === "collapsed")!)).toBe("ribera");
    expect(cells("distrito")).toEqual(blocks().filter((b) => b.kind === "district" || b.kind === "site").map(key).sort());
    expect(cells("distrito")).toHaveLength(24);
  });

  it("los fijos están donde dice la tabla y existen en el kit", () => {
    const at = (recipe: string) => FIXED.filter((f) => f.recipe === recipe).map(key);
    expect(at("station")).toEqual(["-18,188"]);
    expect(at("market")).toEqual(["280,188"]);
    expect(at("theatre")).toEqual(["72,218"]);
    expect(at("civicPalace")).toEqual(["162,218"]);
    expect(at("library")).toEqual(["42,242"]);
    expect(at("constructionSite")).toEqual([key(SITE)]);
    expect(FIXED.find((f) => key(f) === key(WATER_TOWER_BLOCK))?.recipe).toBe("patioResidential");
    for (const f of FIXED) expect(RECIPES.some((r) => r.name === f.recipe)).toBe(true);
  });

  it("assign pone cada fijo en su manzana y toda manzana cívica que no es la plaza es fija", () => {
    const placed = sceneAssign();
    for (const f of FIXED) expect(placed.find((p) => key(p.block) === key(f))?.recipe).toBe(f.recipe);
    for (const b of blocks()) if (b.kind !== "plaza" && barrioOf(b) === "civico") expect(FIXED.some((f) => key(f) === key(b))).toBe(true);
  });

  it("catálogos: pesos del issue, recetas registradas y política de luces", () => {
    const weights = (z: Barrio) => Object.fromEntries(CATALOGUE[z].recipes.map((r) => [r.name, r.weight]));
    expect(weights("centro")).toEqual({ podiumTower: 30, decoStepped: 20, chamfer: 20, classic: 15, cylinderTower: 15 });
    expect(weights("bares")).toEqual({ shopRow: 50, gallery: 20, patioResidential: 20, courtyardO: 10 });
    expect(weights("residencial")).toEqual({ patioResidential: 40, courtyardO: 20, courtyardU: 15, rowHouses: 15, eatenRuin: 10 });
    expect(weights("civico")).toEqual({});
    expect(weights("ribera")).toEqual({ classic: 30, lTower: 30, eatenRuin: 40 });
    expect(weights("distrito")).toEqual({ glassTower: 30, twinTowers: 20, classic: 20, campus: 20, cylinderTower: 10 });
    const lights = Object.fromEntries(BARRIOS.map((z) => [z, CATALOGUE[z].lights]));
    expect(lights).toEqual({
      centro: { on: 0.45, warm: 0.3 }, bares: { on: 0.7, warm: 0.9 }, residencial: { on: 0.55, warm: 0.95 },
      civico: { on: 0.6, warm: 0.7 }, ribera: { on: 0.25, warm: 0.5 }, distrito: { on: 0.4, warm: 0.15 },
    });
    for (const z of BARRIOS) {
      expect(CATALOGUE[z].style).toBe(z);
      for (const r of CATALOGUE[z].recipes) expect(RECIPES.some((d) => d.name === r.name)).toBe(true);
    }
  });

  it("maxHeightFor topa a 10 la fila frente a la torre y a la fuente de la plaza", () => {
    expect(maxHeightFor(blockAt(102, 242))).toBe(10);
    expect(maxHeightFor(blockAt(132, 242))).toBe(10);
    expect(maxHeightFor(blockAt(132, 242), LANDMARK_MAX_H)).toBe(10);
    expect(maxHeightFor(blockAt(72, 242))).toBe(MAX_BUILDING_H);
    expect(maxHeightFor(blockAt(162, 242))).toBe(10); // delante de la fuente (150, 227): más alta la tapa y su charco flota sobre el techo
    expect(maxHeightFor(blockAt(72, 242), LANDMARK_MAX_H)).toBe(LANDMARK_MAX_H);
  });

  it("maxDistrictHeight conserva la guarda del piso encendido", () => {
    expect(maxDistrictHeight({ x: TOWER.x + 20, y: TOWER.y + 20, w: 24, d: 18 })).toBe(10); // en pantalla pisa el piso encendido y queda delante
    expect(maxDistrictHeight(SITE)).toBe(MAX_DISTRICT_H);
    expect(blocks().filter((b) => maxDistrictHeight(b) < MAX_DISTRICT_H).map(key)).toEqual(["132,242"]); // ya topada a 10 por maxHeightFor
  });

  it("open: avenida, muelle, ribera y plaza", () => {
    expect(openSides(blockAt(102, 188))).toEqual(["s"]);
    expect(openSides(blockAt(162, 164))).toEqual(["e"]);
    expect(openSides(blockAt(162, 188))).toEqual(["s", "e"]);
    expect(openSides(blockAt(102, 242))).toEqual(["n"]);
    expect(openSides(blockAt(72, 218))).toContain("e");
    expect(openSides(blockAt(72, 218))).toContain("n");
    expect(openSides(blockAt(162, 218))).toContain("w");
    expect(openSides(blockAt(280, 164))).toEqual(["w"]);
    expect(openSides(blockAt(310, 164))).toEqual([]);
    expect(openSides(blockAt(12, 164))).toEqual([]);
  });

  it("assign es determinístico, salta plaza y derrumbe, y arma lotes con vereda, zócalo y tope", () => {
    expect(JSON.stringify(sceneAssign())).toBe(JSON.stringify(sceneAssign()));
    const placed = sceneAssign();
    expect(placed.map((p) => `${key(p.block)},${p.block.kind}`)).toEqual(blocks().filter((b) => b.kind !== "plaza" && b.kind !== "collapsed").map((b) => `${key(b)},${b.kind}`));
    for (const p of placed) {
      const b = p.block, fixed = FIXED.some((f) => key(f) === key(b));
      expect(p.barrio).toBe(barrioOf(b));
      if (!fixed) expect(CATALOGUE[p.barrio].recipes.map((r) => r.name)).toContain(p.recipe);
      expect([-1, 0, 1]).toContain(p.tone);
      expect(p.lot).toMatchObject({ x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, open: openSides(b) });
      expect(p.lot.z).toBe(NO_PLINTH.includes(p.recipe) ? 0 : PLINTH_H);
      const top = fixed || p.barrio === "distrito" ? LANDMARK_MAX_H : MAX_BUILDING_H;
      expect(p.lot.maxH).toBe(Math.min(maxHeightFor(b, top), maxDistrictHeight(b)));
    }
    expect(placed.find((p) => key(p.block) === "102,242")!.lot.maxH).toBe(10);
    expect(placed.find((p) => key(p.block) === "72,242")!.lot.maxH).toBe(MAX_BUILDING_H);
    expect(placed.find((p) => key(p.block) === "72,218")!.lot.maxH).toBe(LANDMARK_MAX_H);
    expect(JSON.stringify(sceneAssign())).not.toBe(JSON.stringify(assign(createRng(9), createRng(8))));
  });

  it("el tono sale de rng y no depende de districtRng", () => {
    const tones = (d: number) => assign(createRng(7), createRng(d)).map((p) => p.tone);
    expect(tones(8)).toEqual(tones(9));
  });

  it("con la semilla del mundo se usan ≥ 14 recetas distintas", () => {
    expect(new Set(worldAssign().map((p) => p.recipe)).size).toBeGreaterThanOrEqual(14);
  });

  it("el residencial no repite receta en manzanas adyacentes", () => {
    for (const placed of [worldAssign(), sceneAssign()]) {
      const res = placed.filter((p) => p.barrio === "residencial");
      for (const a of res) for (const b of res) {
        if (a === b || Math.abs(a.block.x - b.block.x) > BLOCK_W + STREET || Math.abs(a.block.y - b.block.y) > BLOCK_D + STREET) continue;
        expect(b.recipe, `${key(a.block)} y ${key(b.block)}`).not.toBe(a.recipe);
      }
    }
  });

  it("lotes de la torre de agua y el puente peatonal", () => {
    const court = { x: 10, y: 20, w: 9, d: 7 };
    const lot = waterTowerLot(court, PLINTH_H);
    expect(lot).toMatchObject({ w: 7, d: 7, z: PLINTH_H, open: [], maxH: LANDMARK_MAX_H });
    expect(lot.x + lot.w / 2).toBe(court.x + court.w / 2);
    expect(lot.y + lot.d / 2).toBe(court.y + court.d / 2);
    expect(waterTowerLot({ x: 0, y: 0, w: 3, d: 4 }, 0)).toMatchObject({ w: 5, d: 5, x: -1, y: -0.5 }); // patio chico: 5 y se acepta el roce
    expect(FOOTBRIDGE_LOT).toMatchObject({ x: WEST_QUAY.x1, y: 174, d: 4, z: -1, open: [], maxH: LANDMARK_MAX_H });
    expect(FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w).toBe(Math.ceil(estuaryEast(176)) + 1);
    expect(FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w).toBeGreaterThan(estuaryEast(178)); // apoya en la ribera este, no termina en el agua
  });
});
