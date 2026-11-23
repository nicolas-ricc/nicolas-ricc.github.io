import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { RECIPES } from "../kit/index";
import { LANDMARK_MAX_H } from "../kit/piece";
import { PLINTH_H } from "../scenes/city-pieces";
import { ROWS, SIDEWALK, STREET, WEST_QUAY, blocks, estuaryEast, type Block } from "../scenes/city-grid";
import { zoneRng } from "../scenes/world";
import { SEED } from "../map/seed";
import { CATALOGUE, FIXED, FRONT_CAP_H, FOOTBRIDGE_LOT, MAX_BUILDING_H, assign, builtParcels, isBare, neighborhoodOf, maxHeightFor, neighborhoodOfParcel, parcelOpenSides, tooSmall, openSides, waterTowerLot, type Neighborhood, type Placed } from "./zoning";

const key = (b: { x: number; y: number }): string => `${b.x},${b.y}`;
const blockAt = (x: number, y: number): Block => blocks().find((b) => b.x === x && b.y === y)!;
const cells = (neighborhood: Neighborhood): string[] => blocks().filter((b) => neighborhoodOf(b) === neighborhood).map(key).sort();
const sorted = (xs: [number, number][]): string[] => xs.map(([x, y]) => key({ x, y })).sort();
const worldAssign = (): Placed[] => assign(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1));
const sceneAssign = (): Placed[] => assign(createRng(7), createRng(8));
const NEIGHBORHOODS: readonly Neighborhood[] = ["downtown", "bars", "residential", "civic", "riverside", "district", "industrial", "warehouses", "freight", "harbor"];

describe("zoning", () => {
  it("every block has a neighborhood and the union of neighborhoods reproduces blocks()", () => {
    const all = blocks();
    for (const b of all) expect(NEIGHBORHOODS).toContain(neighborhoodOf(b));
    const union = NEIGHBORHOODS.flatMap((z) => all.filter((b) => neighborhoodOf(b) === z));
    expect(union.map((b) => `${key(b)},${b.kind}`).sort()).toEqual(all.map((b) => `${key(b)},${b.kind}`).sort());
  });

  it("the blocks of the grid hold no west-bank neighborhood: downtown, bars, civic, district and residential belong to the parcels now", () => {
    for (const z of ["downtown", "bars", "residential", "civic", "district"] as const) expect(cells(z), z).toEqual([]);
    expect(cells("riverside")).toEqual(blocks().filter((b) => b.bank === "east" && b.row !== -1).map(key).sort());
    expect(cells("harbor")).toEqual(["280,116", "280,140"]); // the two east blocks of the strip, by the inlet (#326)
    expect(neighborhoodOf(blocks().find((b) => b.kind === "collapsed")!)).toBe("riverside");
  });

  it("the fixed ones are where the table says and exist in the kit", () => {
    const at = (recipe: string) => FIXED.filter((f) => f.recipe === recipe).map(key);
    expect(at("market")).toEqual(["280,188"]);
    expect(at("fishMarket")).toEqual(["280,116"]);
    expect(at("foodHall")).toEqual(["280,140"]);
    expect(at("coveredMarket")).toEqual(["72,92"]);
    expect(FIXED).toHaveLength(4);
    for (const f of FIXED) expect(RECIPES.some((r) => r.name === f.recipe)).toBe(true);
  });

  it("assign puts each fixed one on its block and every civic block is fixed", () => {
    const placed = sceneAssign();
    for (const f of FIXED) expect(placed.find((p) => key(p.block) === key(f))?.recipe).toBe(f.recipe);
    expect(blocks().filter((b) => neighborhoodOf(b) === "civic")).toEqual([]); // no civic block is left since #472; the civic pieces return in #477
  });

  it("catalogues: weights from the issue, registered recipes and lights policy", () => {
    const weights = (z: Neighborhood) => Object.fromEntries(CATALOGUE[z].recipes.map((r) => [r.name, r.weight]));
    expect(weights("downtown")).toEqual({ podiumTower: 30, decoStepped: 20, chamfer: 20, classic: 15, cylinderTower: 15 });
    expect(weights("bars")).toEqual({ shopRow: 50, gallery: 20, patioResidential: 20, courtyardO: 10 });
    expect(weights("residential")).toEqual({ patioResidential: 40, courtyardO: 20, courtyardU: 15, rowHouses: 15, eatenRuin: 10 });
    expect(weights("civic")).toEqual({});
    expect(weights("riverside")).toEqual({ classic: 30, lTower: 30, eatenRuin: 40 });
    expect(weights("district")).toEqual({ glassTower: 30, twinTowers: 20, classic: 20, campus: 20, cylinderTower: 10 });
    expect(weights("industrial")).toEqual({});
    expect(weights("warehouses")).toEqual({ loftHall: 30, vaultLoft: 20, brewery: 25, sheetLoft: 15, derelictHall: 10 });
    expect(weights("freight")).toEqual({ freightShed: 60, openDock: 40 });
    expect(weights("harbor")).toEqual({}); // only fixed pieces (#326)
    const lights = Object.fromEntries(NEIGHBORHOODS.map((z) => [z, CATALOGUE[z].lights]));
    expect(lights).toEqual({
      downtown: { on: 0.45, warm: 0.3 }, bars: { on: 0.7, warm: 0.9 }, residential: { on: 0.55, warm: 0.95 },
      civic: { on: 0.6, warm: 0.7 }, riverside: { on: 0.25, warm: 0.5 }, district: { on: 0.4, warm: 0.15 },
      industrial: { on: 0.3, warm: 0 },
      warehouses: { on: 0.6, warm: 0.8 }, freight: { on: 0.3, warm: 0.2 }, harbor: { on: 0.6, warm: 0.85 },
    });
    for (const z of NEIGHBORHOODS) {
      expect(CATALOGUE[z].style).toBe(z);
      for (const r of CATALOGUE[z].recipes) expect(RECIPES.some((d) => d.name === r.name)).toBe(true);
    }
  });

  it("maxHeightFor caps a rect in front of the sign's panel at 10 and leaves one behind it or off its screen span at `top`", () => {
    expect(maxHeightFor({ x: 81, y: 291, w: 16, d: 9 })).toBe(FRONT_CAP_H); // south of the hotel, in front of the glass: tall there would cover the word
    expect(maxHeightFor({ x: 81, y: 291, w: 16, d: 9 }, LANDMARK_MAX_H)).toBe(FRONT_CAP_H);
    expect(maxHeightFor({ x: 60, y: 200, w: 24, d: 18 })).toBe(MAX_BUILDING_H); // behind the slab
    expect(maxHeightFor({ x: 60, y: 200, w: 24, d: 18 }, LANDMARK_MAX_H)).toBe(LANDMARK_MAX_H);
    expect(maxHeightFor(blockAt(42, 92))).toBe(MAX_BUILDING_H); // off the panel's screen span
  });

  it("no parcel but the one at (73, 291) is in front of the sign's panel", () => {
    expect(builtParcels().filter((p) => maxHeightFor(p.rect) < MAX_BUILDING_H).map((p) => `${p.cell.col},${p.cell.row}`)).toEqual(["73,291"]);
  });

  it("open: east bank", () => {
    expect(openSides(blockAt(280, 164))).toEqual(["w"]);
    expect(openSides(blockAt(310, 164))).toEqual([]);
  });

  it("new strip (#320): row 92 opens south, (280, 116) north and west", () => {
    for (const b of blocks().filter((x) => x.y === ROWS[0])) expect(openSides(b), key(b)).toContain("s");
    expect(openSides(blockAt(12, 92))).toEqual(["s"]);
    expect(openSides(blockAt(280, 116))).toEqual(expect.arrayContaining(["n", "w"]));
    expect(openSides(blockAt(280, 116))).toHaveLength(2);
    expect(openSides(blockAt(280, 140))).toEqual(["w"]);
  });

  describe("warehouses, freight and harbor (#325)", () => {
    it("row 92 is warehouses, the freight lots are freight and the two east blocks of the strip are harbor", () => {
      expect(cells("warehouses")).toEqual(sorted([[-48, 92], [-18, 92], [12, 92], [42, 92], [72, 92]]));
      expect(cells("freight")).toEqual(blocks().filter((b) => b.kind === "freight").map(key).sort());
      expect(cells("freight")).toHaveLength(5);
      expect(cells("harbor")).toEqual(["280,116", "280,140"]);
    });

    it("the covered market is fixed at (72, 92) and opens east (frontage) and south", () => {
      expect(FIXED.filter((f) => f.recipe === "coveredMarket").map(key)).toEqual(["72,92"]);
      expect(openSides(blockAt(72, 92))).toEqual(["e", "s"]);
      expect(openSides(blockAt(12, 92))).toEqual(["s"]);
      expect(openSides(blocks().find((b) => b.kind === "freight" && b.x === 12)!)).toEqual(["s"]);
    });

    it("with the world seed the five blocks of row 92 use ≥ 3 distinct recipes", () => {
      const row = worldAssign().filter((p) => p.block.y === ROWS[0]);
      expect(row).toHaveLength(5);
      expect(new Set(row.map((p) => p.recipe)).size).toBeGreaterThanOrEqual(3);
    });

    it("freight lots get freightShed or openDock on a 21 × 10 lot open to the south", () => {
      for (const placed of [worldAssign(), sceneAssign()]) {
        const lots = placed.filter((p) => p.block.kind === "freight");
        expect(lots).toHaveLength(5);
        for (const p of lots) {
          expect(["freightShed", "openDock"]).toContain(p.recipe);
          expect(p.neighborhood).toBe("freight");
          expect(p.lot).toMatchObject({ x: p.block.x + SIDEWALK, y: p.block.y + SIDEWALK, w: 21, d: 10, open: ["s"], maxH: MAX_BUILDING_H });
        }
      }
    });

    it("only a harbor block without a fixed recipe is bare; since #326 both harbor blocks are fixed, so none is", () => {
      for (const b of blocks()) expect(isBare(b), key(b)).toBe(false);
      expect(isBare({ ...blockAt(280, 116), x: 310 })).toBe(true); // a harbor block outside FIXED would be skipped
      for (const placed of [worldAssign(), sceneAssign()]) expect(placed.filter((p) => p.neighborhood === "harbor").map((p) => p.recipe).sort()).toEqual(["fishMarket", "foodHall"]);
    });
  });

  it("assign is deterministic, skips the collapse, and builds street-level lots with sidewalk and cap", () => {
    expect(JSON.stringify(sceneAssign())).toBe(JSON.stringify(sceneAssign()));
    const placed = sceneAssign(), onBlocks = placed.filter((p) => !p.parcel);
    expect(onBlocks.map((p) => `${key(p.block)},${p.block.kind}`)).toEqual(blocks().filter((b) => b.kind !== "collapsed" && !isBare(b)).map((b) => `${key(b)},${b.kind}`));
    expect(placed.slice(0, onBlocks.length)).toEqual(onBlocks); // blocks first, parcels after
    for (const p of onBlocks) {
      const b = p.block, fixed = FIXED.some((f) => key(f) === key(b));
      expect(p.neighborhood).toBe(neighborhoodOf(b));
      if (!fixed) expect(CATALOGUE[p.neighborhood].recipes.map((r) => r.name)).toContain(p.recipe);
      expect([-1, 0, 1]).toContain(p.tone);
      expect(p.lot).toMatchObject({ x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, open: openSides(b) });
      expect(p.lot.z).toBe(0); // street level: city() decides the plinth (seat)
      const top = fixed || p.neighborhood === "district" ? LANDMARK_MAX_H : MAX_BUILDING_H;
      expect(p.lot.maxH).toBe(top); // the blocks (strip and east bank) keep `top`
    }
    for (const p of placed.filter((q) => q.parcel)) {
      expect(p.neighborhood).toBe(neighborhoodOfParcel(p.parcel!));
      expect(CATALOGUE[p.neighborhood].recipes.map((r) => r.name)).toContain(p.recipe);
      expect(p.lot.open).toEqual(parcelOpenSides(p.parcel!));
      const top = p.neighborhood === "district" ? LANDMARK_MAX_H : MAX_BUILDING_H;
      expect(p.lot.maxH).toBe(Math.min(top, maxHeightFor(p.parcel!.rect, top)));
    }
    expect(JSON.stringify(sceneAssign())).not.toBe(JSON.stringify(assign(createRng(9), createRng(8))));
  });

  it("parcels too small for the kit (lot side < MIN_LOT_SIDE) are flagged by tooSmall", () => {
    expect(tooSmall({ x: 0, y: 0, w: 20, d: 3, z: 0, open: [], maxH: 18 })).toBe(true);
    expect(tooSmall({ x: 0, y: 0, w: 7, d: 9, z: 0, open: [], maxH: 18 })).toBe(false);
  });

  it("the tone comes from rng and does not depend on districtRng", () => {
    const tones = (d: number) => assign(createRng(7), createRng(d)).map((p) => p.tone);
    expect(tones(8)).toEqual(tones(9));
  });

  it("with the world seed ≥ 14 distinct recipes are used", () => {
    expect(new Set(worldAssign().map((p) => p.recipe)).size).toBeGreaterThanOrEqual(14);
  });

  // the retry draws only 5 times: with parcels a repeat is rare but possible, so the pin is on the seeds used here
  it("residential doesn't repeat a recipe on adjacent blocks or parcels", () => {
    for (const placed of [worldAssign(), sceneAssign()]) {
      const res = placed.filter((p) => p.neighborhood === "residential");
      for (const a of res) for (const b of res) {
        const gap = (u: number, uw: number, v: number, vw: number) => Math.max(u - (v + vw), v - (u + uw), 0);
        if (a === b || gap(a.block.x, a.block.w, b.block.x, b.block.w) > STREET || gap(a.block.y, a.block.d, b.block.y, b.block.d) > STREET) continue;
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

// ---------------------------------------------------------------- #472: zoning over the parcels of city-plan
import { CITY_BOUNDS, HOTEL_LOT, axisBand, AXES, parcels, type Parcel } from "../scenes/city-plan";
import { CITY_EDGE } from "../scenes/city-grid";

describe("zoning over parcels (#472)", () => {
  const sameRect = (a: { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }) => a.x === b.x && a.y === b.y && a.w === b.w && a.d === b.d;
  const isHotel = (p: Parcel) => sameRect(p.rect, HOTEL_LOT);
  const built = parcels(CITY_BOUNDS).filter((p) => p.c.x > CITY_EDGE.west && p.c.y < 318);
  const placedParcels = (): Placed[] => worldAssign().filter((p) => p.parcel);

  it("every parcel of CITY_BOUNDS gets exactly one Placed, except HOTEL_LOT", () => {
    const placed = placedParcels();
    for (const p of built) expect(placed.filter((q) => q.parcel === p).length, `${p.cell.col},${p.cell.row}`).toBe(isHotel(p) ? 0 : 1);
    expect(placed).toHaveLength(built.filter((p) => !isHotel(p)).length);
    for (const q of placed) expect(q.parcel!.c.x > CITY_EDGE.west && q.parcel!.c.y < 318).toBe(true);
  });

  it("a parcel's block is its rect, west bank, row −2, kind parcel; its lot is the rect minus the sidewalk at z 0", () => {
    for (const q of placedParcels()) {
      const r = q.parcel!.rect;
      expect(q.block).toEqual({ ...r, bank: "west", row: -2, kind: "parcel" });
      expect(q.lot.x).toBeCloseTo(r.x + SIDEWALK, 9);
      expect(q.lot.y).toBeCloseTo(r.y + SIDEWALK, 9);
      expect(q.lot.w).toBeCloseTo(r.w - 2 * SIDEWALK, 9);
      expect(q.lot.d).toBeCloseTo(r.d - 2 * SIDEWALK, 9);
      expect(q.lot.z).toBe(0);
      const top = q.neighborhood === "district" ? LANDMARK_MAX_H : MAX_BUILDING_H;
      expect(q.lot.maxH).toBe(Math.min(top, maxHeightFor(r, top))); // the parcel in front of the sign gets FRONT_CAP_H
    }
  });

  it("barrio → neighborhood: clasico downtown, transicion residential, moderno district, bajo and residencial residential; bars north of the plaza", () => {
    const map = { clasico: "downtown", transicion: "residential", moderno: "district", bajo: "residential", residencial: "residential" } as const;
    for (const q of placedParcels()) {
      const p = q.parcel!;
      const bars = p.c.y < 206 && p.rect.x + p.rect.w >= 157;
      expect(q.neighborhood, `${p.cell.col},${p.cell.row}`).toBe(bars ? "bars" : map[p.barrio]);
    }
  });

  it("bars are exactly the two parcels north of the plaza (columns 133 and 163)", () => {
    const bars = placedParcels().filter((q) => q.neighborhood === "bars").map((q) => q.parcel!.cell).sort((a, b) => a.col - b.col);
    expect(bars).toEqual([{ col: 133, row: 171 }, { col: 163, row: 171 }]);
  });

  it("the open sides of a parcel touching the plaza axis include the side that touches it", () => {
    const band = axisBand(AXES.find((a) => a.id === "plaza")!);
    const y0 = Math.min(...band.map((q) => q.y)), y1 = Math.max(...band.map((q) => q.y)); // 222..234
    const placed = placedParcels();
    const north = placed.filter((q) => Math.abs(q.parcel!.rect.y + q.parcel!.rect.d - y0) < 1e-6 && Math.abs(Math.max(...q.parcel!.poly.map((v) => v.y)) - y0) < 1e-6);
    const south = placed.filter((q) => Math.abs(q.parcel!.rect.y - y1) < 1e-6 && Math.abs(Math.min(...q.parcel!.poly.map((v) => v.y)) - y1) < 1e-6);
    expect(north.length).toBeGreaterThan(0);
    expect(south.length).toBeGreaterThan(0);
    for (const q of north) expect(q.lot.open, `${q.parcel!.cell.col},${q.parcel!.cell.row}`).toContain("s");
    for (const q of south) expect(q.lot.open, `${q.parcel!.cell.col},${q.parcel!.cell.row}`).toContain("n");
  });

  it("FIXED names no west block of rows ≥ 164", () => {
    for (const f of FIXED) expect(f.x < 192 && f.y >= 164, `${f.recipe} ${f.x},${f.y}`).toBe(false);
    expect(FIXED.map((f) => f.recipe).sort()).toEqual(["coveredMarket", "fishMarket", "foodHall", "market"]);
  });
});
