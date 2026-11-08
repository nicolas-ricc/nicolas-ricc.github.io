import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { RECIPES } from "../kit/index";
import { LANDMARK_MAX_H } from "../kit/piece";
import { PLINTH_H } from "../scenes/city-pieces";
import { BLOCK_D, BLOCK_W, SIDEWALK, SITE, STREET, TOWER, WEST_QUAY, blocks, estuaryEast, type Block } from "../scenes/city-grid";
import { zoneRng } from "../scenes/world";
import { SEED } from "../map/seed";
import { CATALOGUE, FIXED, FOOTBRIDGE_LOT, MAX_BUILDING_H, MAX_DISTRICT_H, WATER_TOWER_BLOCK, assign, neighborhoodOf, maxDistrictHeight, maxHeightFor, openSides, waterTowerLot, type Neighborhood, type Placed } from "./zoning";

const key = (b: { x: number; y: number }): string => `${b.x},${b.y}`;
const blockAt = (x: number, y: number): Block => blocks().find((b) => b.x === x && b.y === y && b.kind !== "plaza")!;
const cells = (neighborhood: Neighborhood): string[] => blocks().filter((b) => b.kind !== "plaza" && neighborhoodOf(b) === neighborhood).map(key).sort();
const sorted = (xs: [number, number][]): string[] => xs.map(([x, y]) => key({ x, y })).sort();
const worldAssign = (): Placed[] => assign(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1));
const sceneAssign = (): Placed[] => assign(createRng(7), createRng(8));
const NEIGHBORHOODS: readonly Neighborhood[] = ["downtown", "bars", "residential", "civic", "riverside", "district"];

describe("zoning", () => {
  it("every block has a neighborhood and the union of neighborhoods reproduces blocks()", () => {
    const all = blocks();
    for (const b of all) expect(NEIGHBORHOODS).toContain(neighborhoodOf(b));
    const union = NEIGHBORHOODS.flatMap((z) => all.filter((b) => neighborhoodOf(b) === z));
    expect(union.map((b) => `${key(b)},${b.kind}`).sort()).toEqual(all.map((b) => `${key(b)},${b.kind}`).sort());
  });

  it("bars are exactly the six blocks of the quay", () => {
    expect(cells("bars")).toEqual(sorted([[102, 164], [132, 164], [162, 164], [102, 188], [132, 188], [162, 188]]));
  });

  it("downtown, residential, civic, riverside and district according to the table", () => {
    expect(cells("downtown")).toEqual(sorted([[72, 164], [72, 188], [42, 218], [72, 242], [102, 242], [132, 242], [162, 242]]));
    expect(cells("residential")).toEqual(sorted([[12, 164], [12, 188], [12, 218], [12, 242], [42, 164], [42, 188]]));
    expect(cells("civic")).toEqual(sorted([[72, 218], [162, 218], [42, 242]]));
    expect(neighborhoodOf(blocks().find((b) => b.kind === "plaza")!)).toBe("civic");
    expect(cells("riverside")).toEqual(blocks().filter((b) => b.bank === "east").map(key).sort());
    expect(neighborhoodOf(blocks().find((b) => b.kind === "collapsed")!)).toBe("riverside");
    expect(cells("district")).toEqual(blocks().filter((b) => b.kind === "district" || b.kind === "site").map(key).sort());
    expect(cells("district")).toHaveLength(24);
  });

  it("the fixed ones are where the table says and exist in the kit", () => {
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

  it("assign puts each fixed one on its block and every civic block that isn't the plaza is fixed", () => {
    const placed = sceneAssign();
    for (const f of FIXED) expect(placed.find((p) => key(p.block) === key(f))?.recipe).toBe(f.recipe);
    for (const b of blocks()) if (b.kind !== "plaza" && neighborhoodOf(b) === "civic") expect(FIXED.some((f) => key(f) === key(b))).toBe(true);
  });

  it("catalogues: weights from the issue, registered recipes and lights policy", () => {
    const weights = (z: Neighborhood) => Object.fromEntries(CATALOGUE[z].recipes.map((r) => [r.name, r.weight]));
    expect(weights("downtown")).toEqual({ podiumTower: 30, decoStepped: 20, chamfer: 20, classic: 15, cylinderTower: 15 });
    expect(weights("bars")).toEqual({ shopRow: 50, gallery: 20, patioResidential: 20, courtyardO: 10 });
    expect(weights("residential")).toEqual({ patioResidential: 40, courtyardO: 20, courtyardU: 15, rowHouses: 15, eatenRuin: 10 });
    expect(weights("civic")).toEqual({});
    expect(weights("riverside")).toEqual({ classic: 30, lTower: 30, eatenRuin: 40 });
    expect(weights("district")).toEqual({ glassTower: 30, twinTowers: 20, classic: 20, campus: 20, cylinderTower: 10 });
    const lights = Object.fromEntries(NEIGHBORHOODS.map((z) => [z, CATALOGUE[z].lights]));
    expect(lights).toEqual({
      downtown: { on: 0.45, warm: 0.3 }, bars: { on: 0.7, warm: 0.9 }, residential: { on: 0.55, warm: 0.95 },
      civic: { on: 0.6, warm: 0.7 }, riverside: { on: 0.25, warm: 0.5 }, district: { on: 0.4, warm: 0.15 },
    });
    for (const z of NEIGHBORHOODS) {
      expect(CATALOGUE[z].style).toBe(z);
      for (const r of CATALOGUE[z].recipes) expect(RECIPES.some((d) => d.name === r.name)).toBe(true);
    }
  });

  it("maxHeightFor caps the row facing the tower and the plaza fountain at 10", () => {
    expect(maxHeightFor(blockAt(102, 242))).toBe(10);
    expect(maxHeightFor(blockAt(132, 242))).toBe(10);
    expect(maxHeightFor(blockAt(132, 242), LANDMARK_MAX_H)).toBe(10);
    expect(maxHeightFor(blockAt(72, 242))).toBe(MAX_BUILDING_H);
    expect(maxHeightFor(blockAt(162, 242))).toBe(10); // in front of the fountain (150, 227): anything taller hides it and its puddle floats above the roof
    expect(maxHeightFor(blockAt(72, 242), LANDMARK_MAX_H)).toBe(LANDMARK_MAX_H);
  });

  it("maxDistrictHeight keeps the lit-floor guard", () => {
    expect(maxDistrictHeight({ x: TOWER.x + 20, y: TOWER.y + 20, w: 24, d: 18 })).toBe(10); // on screen it overlaps the lit floor and stands in front
    expect(maxDistrictHeight(SITE)).toBe(MAX_DISTRICT_H);
    expect(blocks().filter((b) => maxDistrictHeight(b) < MAX_DISTRICT_H).map(key)).toEqual(["132,242"]); // already capped at 10 by maxHeightFor
  });

  it("open: avenue, quay, bank and plaza", () => {
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

  it("assign is deterministic, skips plaza and collapse, and builds street-level lots with sidewalk and cap", () => {
    expect(JSON.stringify(sceneAssign())).toBe(JSON.stringify(sceneAssign()));
    const placed = sceneAssign();
    expect(placed.map((p) => `${key(p.block)},${p.block.kind}`)).toEqual(blocks().filter((b) => b.kind !== "plaza" && b.kind !== "collapsed").map((b) => `${key(b)},${b.kind}`));
    for (const p of placed) {
      const b = p.block, fixed = FIXED.some((f) => key(f) === key(b));
      expect(p.neighborhood).toBe(neighborhoodOf(b));
      if (!fixed) expect(CATALOGUE[p.neighborhood].recipes.map((r) => r.name)).toContain(p.recipe);
      expect([-1, 0, 1]).toContain(p.tone);
      expect(p.lot).toMatchObject({ x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, open: openSides(b) });
      expect(p.lot.z).toBe(0); // street level: city() decides the plinth (seat)
      const top = fixed || p.neighborhood === "district" ? LANDMARK_MAX_H : MAX_BUILDING_H;
      expect(p.lot.maxH).toBe(Math.min(maxHeightFor(b, top), maxDistrictHeight(b)));
    }
    expect(placed.find((p) => key(p.block) === "102,242")!.lot.maxH).toBe(10);
    expect(placed.find((p) => key(p.block) === "72,242")!.lot.maxH).toBe(MAX_BUILDING_H);
    expect(placed.find((p) => key(p.block) === "72,218")!.lot.maxH).toBe(LANDMARK_MAX_H);
    expect(JSON.stringify(sceneAssign())).not.toBe(JSON.stringify(assign(createRng(9), createRng(8))));
  });

  it("the tone comes from rng and does not depend on districtRng", () => {
    const tones = (d: number) => assign(createRng(7), createRng(d)).map((p) => p.tone);
    expect(tones(8)).toEqual(tones(9));
  });

  it("with the world seed ≥ 14 distinct recipes are used", () => {
    expect(new Set(worldAssign().map((p) => p.recipe)).size).toBeGreaterThanOrEqual(14);
  });

  it("residential doesn't repeat a recipe on adjacent blocks", () => {
    for (const placed of [worldAssign(), sceneAssign()]) {
      const res = placed.filter((p) => p.neighborhood === "residential");
      for (const a of res) for (const b of res) {
        if (a === b || Math.abs(a.block.x - b.block.x) > BLOCK_W + STREET || Math.abs(a.block.y - b.block.y) > BLOCK_D + STREET) continue;
        expect(b.recipe, `${key(a.block)} and ${key(b.block)}`).not.toBe(a.recipe);
      }
    }
  });

  it("lots of the water tower and the footbridge", () => {
    const court = { x: 10, y: 20, w: 9, d: 7 };
    const lot = waterTowerLot(court, PLINTH_H);
    expect(lot).toMatchObject({ w: 7, d: 7, z: PLINTH_H, open: [], maxH: LANDMARK_MAX_H });
    expect(lot.x + lot.w / 2).toBe(court.x + court.w / 2);
    expect(lot.y + lot.d / 2).toBe(court.y + court.d / 2);
    expect(waterTowerLot({ x: 0, y: 0, w: 3, d: 4 }, 0)).toMatchObject({ w: 5, d: 5, x: -1, y: -0.5 }); // small courtyard: 5 and the grazing is accepted
    expect(FOOTBRIDGE_LOT).toMatchObject({ x: WEST_QUAY.x1, y: 174, d: 4, z: -1, open: [], maxH: LANDMARK_MAX_H });
    expect(FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w).toBe(Math.ceil(estuaryEast(176)) + 1);
    expect(FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w).toBeGreaterThan(estuaryEast(178)); // rests on the east bank, doesn't end in the water
  });
});
