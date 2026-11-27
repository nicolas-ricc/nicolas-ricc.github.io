import { describe, expect, it } from "vitest";
import { COVER_MARGIN, inCoverQuad } from "../map/geo";
import { createRng } from "../map/seed";
import { RECIPES } from "../kit/index";
import { LANDMARK_MAX_H } from "../kit/piece";
import { PLINTH_H } from "../scenes/city-pieces";
import { ROWS, SIDEWALK, STREET, WEST_QUAY, blocks, estuaryEast, type Block } from "../scenes/city-grid";
import { zoneRng } from "../scenes/world";
import { SIGN_BACKING } from "../scenes/hotel-plan";
import { screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import { SEED } from "../map/seed";
import { BARRIO_HEIGHTS, CATALOGUE, FIXED, WEST_DISTRICT_X, TELECOM_CELL, FOOTBRIDGE_LOT, MAX_BUILDING_H, assign, builtParcels, isBare, isStrip, stripZoning, neighborhoodOf, maxHeightFor, neighborhoodOfParcel, parcelOpenSides, tooSmall, openSides, waterTowerLot, type Neighborhood, type Placed } from "./zoning";

const key = (b: { x: number; y: number }): string => `${b.x},${b.y}`;
const blockAt = (x: number, y: number): Block => blocks().find((b) => b.x === x && b.y === y)!;
const cells = (neighborhood: Neighborhood): string[] => blocks().filter((b) => neighborhoodOf(b) === neighborhood).map(key).sort();
const sorted = (xs: [number, number][]): string[] => xs.map(([x, y]) => key({ x, y })).sort();
const worldAssign = (): Placed[] => assign(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1));
const sceneAssign = (): Placed[] => assign(createRng(7), createRng(8));
const NEIGHBORHOODS: readonly Neighborhood[] = ["clasico", "transicion", "moderno", "bajo", "downtown", "bars", "residential", "civic", "riverside", "district", "industrial", "warehouses", "freight", "harbor"];

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
    expect(weights("bars")).toEqual({ shopRow: 50, gallery: 20, patioResidential: 20, courtyardO: 10, portalBase: 30 }); // portalBase: #477
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
      clasico: { on: 0.5, warm: 0.95 }, transicion: { on: 0.5, warm: 0.6 }, moderno: { on: 0.4, warm: 0.15 }, bajo: { on: 0.55, warm: 0.95 },
    });
    for (const z of NEIGHBORHOODS) {
      expect(CATALOGUE[z].style).toBe(z);
      for (const r of CATALOGUE[z].recipes) expect(RECIPES.some((d) => d.name === r.name)).toBe(true);
    }
  });

  it("maxHeightFor caps a rect in front of the sign's plate below the plate's screen bottom", () => {
    const plateBottom = screenBounds(solidBounds(SIGN_BACKING)).maxY;
    const r = { x: 118, y: 316, w: 12, d: 20 }, h = maxHeightFor(r, 100);
    expect(h).toBeLessThan(100);
    expect(h).toBeGreaterThan(0);
    expect(screenBounds({ min: v3(r.x, r.y, 0), max: v3(r.x + r.w, r.y + r.d, h + PLINTH_H) }).minY).toBeGreaterThanOrEqual(plateBottom - 1e-9);
    expect(maxHeightFor({ x: 115, y: 316, w: 15, d: 20 }, 100)).toBeLessThan(100); // straddles the plate in x, south of it: in front
    expect(maxHeightFor({ x: 60, y: 200, w: 24, d: 18 })).toBe(MAX_BUILDING_H); // behind the block
    expect(maxHeightFor({ x: 60, y: 200, w: 24, d: 18 }, LANDMARK_MAX_H)).toBe(LANDMARK_MAX_H);
    expect(maxHeightFor(blockAt(42, 92))).toBe(MAX_BUILDING_H); // off the plate's screen span
  });

  it("no built parcel is capped by the sign", () => {
    expect(builtParcels().filter((p) => maxHeightFor(p.rect, 50) < 50).map((p) => `${p.cell.col},${p.cell.row}`)).toEqual([]);
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
    const onParcels = placed.filter((q) => q.parcel), ruled = parcelNeighborhoods(builtParcels());
    for (const [i, p] of onParcels.entries()) {
      expect(p.neighborhood).toBe(isStrip(p.parcel!) ? stripZoning().get(p.parcel!) : ruled[i]); // neighborhoodOfParcel plus the neighbour rule (#477); the strip by its field (#496)
      expect(p.lot.open).toEqual(parcelOpenSides(p.parcel!));
      const top = maxHFor(p.neighborhood, p.parcel!);
      const named = fixedParcel(p.parcel!);
      if (named) expect(p.recipe).toBe(named.recipe); // singular pieces are named, not drawn
      else expect(catalogueFor(p.neighborhood, p.parcel!).map((r) => r.name)).toContain(p.recipe);
      expect(p.lot.maxH).toBe(Math.min(top, maxHeightFor(p.parcel!.rect, top)));
    }
    expect(JSON.stringify(sceneAssign())).not.toBe(JSON.stringify(assign(createRng(9), createRng(8))));
  });

  it("parcels too small for the kit (lot side < MIN_LOT_SIDE) are flagged by tooSmall", () => {
    expect(tooSmall({ x: 0, y: 0, w: 20, d: 3, z: 0, open: [], maxH: 18 })).toBe(true);
    expect(tooSmall({ x: 0, y: 0, w: 7, d: 9, z: 0, open: [], maxH: 18 })).toBe(false);
  });

  it("the tone of the blocks and of the east parcels comes from rng and does not depend on districtRng; the west's comes from districtRng (#479)", () => {
    const tones = (d: number, west: boolean) => assign(createRng(7), createRng(d)).filter((p) => (p.parcel !== undefined && p.parcel.c.x < WEST_DISTRICT_X) === west).map((p) => p.tone);
    expect(tones(8, false)).toEqual(tones(9, false));
    expect(tones(8, true)).toHaveLength(tones(9, true).length);
    expect(tones(8, true)).not.toEqual(tones(9, true));
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
import { COASTAL_CUT_Y, PLAN_BOUNDS, HOTEL_LOT, axisBand, AXES, parcels, type Parcel } from "../scenes/city-plan";

describe("zoning over parcels (#472)", () => {
  const sameRect = (a: { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }) => a.x === b.x && a.y === b.y && a.w === b.w && a.d === b.d;
  const isHotel = (p: Parcel) => sameRect(p.rect, HOTEL_LOT);
  const built = parcels(PLAN_BOUNDS).filter((p) => p.c.y < COASTAL_CUT_Y); // #493: the city builds PLAN_BOUNDS parcels (to the cut y 378)
  const placedParcels = (): Placed[] => worldAssign().filter((p) => p.parcel);

  it("every parcel of PLAN_BOUNDS gets exactly one Placed, except HOTEL_LOT", () => {
    const placed = placedParcels();
    for (const p of built) expect(placed.filter((q) => q.parcel === p).length, `${p.cell.col},${p.cell.row}`).toBe(isHotel(p) ? 0 : 1);
    expect(placed).toHaveLength(built.filter((p) => !isHotel(p)).length);
    for (const q of placed) expect(q.parcel!.c.y < COASTAL_CUT_Y).toBe(true);
  });

  it("a parcel's block is its rect, west bank, row −2, kind parcel; its lot is the rect minus the sidewalk at z 0 (the bounding box of the inset polygon on oblique polygon lots)", () => {
    for (const q of placedParcels()) {
      const r = q.parcel!.rect;
      expect(q.block).toEqual({ ...r, bank: "west", row: -2, kind: "parcel" });
      const oblique = q.parcel!.poly.some((a, i) => { const b = q.parcel!.poly[(i + 1) % q.parcel!.poly.length]!; return Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6; });
      const inset = q.lot.poly && oblique ? insetPoly(q.parcel!.poly, SIDEWALK) : null; // a degenerate inset falls back to the rect
      if (inset) {
        const ib = polyBox(inset);
        expect(q.lot.x).toBeCloseTo(ib.x, 9);
        expect(q.lot.y).toBeCloseTo(ib.y, 9);
        expect(q.lot.w).toBeCloseTo(ib.w, 9);
        expect(q.lot.d).toBeCloseTo(ib.d, 9);
      } else {
        expect(q.lot.x).toBeCloseTo(r.x + SIDEWALK, 9);
        expect(q.lot.y).toBeCloseTo(r.y + SIDEWALK, 9);
        expect(q.lot.w).toBeCloseTo(r.w - 2 * SIDEWALK, 9);
        expect(q.lot.d).toBeCloseTo(r.d - 2 * SIDEWALK, 9);
      }
      expect(q.lot.z).toBe(0);
      const top = maxHFor(q.neighborhood, q.parcel!);
      expect(q.lot.maxH).toBe(Math.min(top, maxHeightFor(r, top)));
    }
  });

  it("barrio → neighborhood: each barrio keeps its own (residencial = bajo), bars north of the plaza; the neighbour rule only lowers", () => {
    const map = { clasico: "clasico", transicion: "transicion", moderno: "moderno", bajo: "bajo", residencial: "bajo" } as const;
    const placed = placedParcels(), ps = placed.map((q) => q.parcel!), ns = parcelNeighborhoods(ps); // #493: `placed` hoisted out of the loop (the 81 parcels made the repeated call time out at 5 s)
    ps.forEach((p, i) => {
      const bars = p.c.y < 206 && p.rect.x + p.rect.w >= 157;
      const civic = fixedParcel(p)?.civic === true; // the three civic pieces take no part in the barrios
      expect(neighborhoodOfParcel(p), `${p.cell.col},${p.cell.row}`).toBe(bars ? "bars" : civic ? "civic" : map[p.barrio]);
      if (!isStrip(p)) expect(placed[i]!.neighborhood).toBe(ns[i]); // #496: the strip is zoned by the field (stripZoning), not by this rule
      if (!bars && !civic) expect(BARRIO_STEP[ns[i] as CityBarrio], `${p.cell.col},${p.cell.row}`).toBeLessThanOrEqual(BARRIO_STEP[map[p.barrio]]);
    });
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

// ---------------------------------------------------------------- #477: barrios, neighbour rule, towers and singular pieces
import { bounds as solidBounds } from "../iso/solids";
import { polygonDistance } from "../kit/lettering";
import { chamferPoly, insetPoly } from "../kit/polygon";
import { outsideConvex, triangleOverlap } from "../kit/lot-fixtures";
import { CRATERS } from "../scenes/city-grid";
import { PITCH as GRID_PITCH, PLAZA_MAYOR, axis, inPlazaMayor, onAxis, pointInPoly, polyBox } from "../scenes/city-plan";
import type { Side } from "../kit/types";
import { city } from "../scenes/city";
import {
  BARRIO_STEP, FIXED_PARCELS, LIBRARY_CELL, MODERNO_SLAB, OCHAVA, TOWER_FREE_H, WATER_TOWER_CELL,
  catalogueFor, fixedParcel, maxHFor, ochava, parcelLot, parcelNeighborhoods, towerZone, type CityBarrio,
} from "./zoning";

describe("barrios (#477)", () => {
  const scene = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));
  const onParcels = scene.placed.filter((q) => q.placed.parcel);
  const cellKey = (p: Parcel) => `${p.cell.col},${p.cell.row}`;
  const square = (x: number, y: number, barrio: Parcel["barrio"], c?: { x: number; y: number }, d = 150): Parcel => {
    const poly = [{ x, y }, { x: x + 24, y }, { x: x + 24, y: y + 24 }, { x, y: y + 24 }];
    return { poly, c: c ?? { x: x + 12, y: y + 12 }, area: 576, d, barrio, cell: { col: x, row: y }, rect: { x, y, w: 24, d: 24 } };
  };
  const pieceH = (q: (typeof onParcels)[number]) => Math.max(...q.piece.solids.map((s) => solidBounds(s).max.z)) - q.placed.lot.z;
  const isFixed = (p: Parcel) => fixedParcel(p) !== undefined;
  const PARTAKE = (n: string) => n !== "bars" && n !== "civic";

  it("every city parcel has a barrio neighbourhood from the table, with the issue's catalogues", () => {
    for (const q of onParcels) expect(["clasico", "transicion", "moderno", "bajo", "bars", "civic"], cellKey(q.placed.parcel!)).toContain(q.placed.neighborhood);
    const weights = (z: Neighborhood) => Object.fromEntries(CATALOGUE[z].recipes.map((r) => [r.name, r.weight]));
    expect(weights("clasico")).toEqual({ cornerCupola: 30, mansard: 25, classic: 20, portalBase: 15, chamfer: 10 });
    expect(weights("transicion")).toEqual({ balconyBlock: 35, decoStepped: 25, chamfer: 20, courtyardO: 20 });
    expect(weights("moderno")).toEqual({ podiumTower: 45, glassTower: 30, twinTowers: 25 }); // towers only, no campus (#495)
    expect(weights("bajo")).toEqual({ rowHouses: 40, patioResidential: 35, courtyardU: 25 });
    expect(weights("bars")).toEqual({ shopRow: 50, gallery: 20, patioResidential: 20, courtyardO: 10, portalBase: 30 });
    expect(CATALOGUE.clasico.lights).toEqual({ on: 0.5, warm: 0.95 });
    expect(CATALOGUE.transicion.lights).toEqual({ on: 0.5, warm: 0.6 });
    expect(CATALOGUE.moderno.lights).toEqual({ on: 0.4, warm: 0.15 });
    expect(CATALOGUE.bajo.lights).toEqual({ on: 0.55, warm: 0.95 });
    for (const z of ["clasico", "transicion", "moderno", "bajo"] as const) expect(CATALOGUE[z].style).toBe(z);
    expect(MODERNO_SLAB).toEqual([{ name: "campus", weight: 50 }, { name: "classic", weight: 50 }]);
    expect(BARRIO_STEP).toEqual({ bajo: 0, clasico: 1, transicion: 2, moderno: 3 });
  });

  it("heights per barrio stay in the spec ranges", () => {
    for (const q of onParcels) {
      const p = q.placed.parcel!, n = q.placed.neighborhood;
      const cap = isFixed(p) ? LANDMARK_MAX_H : n === "clasico" || n === "transicion" || n === "bajo" ? BARRIO_HEIGHTS[n].hi : n === "moderno" ? (towerZone(p) ? BARRIO_HEIGHTS.moderno.hi : 21) : MAX_BUILDING_H;
      for (const s of q.piece.solids) expect(solidBounds(s).max.z, `${cellKey(p)} ${q.placed.recipe}`).toBeLessThanOrEqual(cap + PLINTH_H + 0.5);
    }
  });

  it("maxHFor and catalogueFor follow the table and the tower zone", () => {
    const north = square(-100, 230, "moderno", { x: -88, y: 250 }, 230), south = square(-100, 320, "moderno", { x: -88, y: 330 }, 230), near = square(-100, 230, "moderno", { x: -88, y: 250 }, 140);
    expect([towerZone(north), towerZone(south), towerZone(near)]).toEqual([true, false, false]);
    expect(maxHFor("moderno", north)).toBe(50);
    expect(maxHFor("moderno", south)).toBe(TOWER_FREE_H);
    expect(TOWER_FREE_H).toBe(21);
    expect(maxHFor("clasico", north)).toBe(BARRIO_HEIGHTS.clasico.hi);
    expect(maxHFor("transicion", north)).toBe(BARRIO_HEIGHTS.transicion.hi);
    expect(maxHFor("bajo", north)).toBe(BARRIO_HEIGHTS.bajo.hi);
    expect(maxHFor("bars", north)).toBe(MAX_BUILDING_H);
    expect(catalogueFor("moderno", north)).toEqual(CATALOGUE.moderno.recipes);
    expect(catalogueFor("moderno", south)).toEqual(MODERNO_SLAB);
    expect(catalogueFor("moderno", near)).toEqual(MODERNO_SLAB);
    expect(catalogueFor("clasico", south)).toEqual(CATALOGUE.clasico.recipes);
  });

  it("no two neighbouring parcels differ by more than one barrio step", () => {
    const ps = onParcels.map((q) => q.placed.parcel!), ns = onParcels.map((q) => q.placed.neighborhood);
    const near = (a: Parcel, b: Parcel) => polygonDistance(a.poly, b.poly) <= STREET + 1 || (Math.abs(a.cell.col - b.cell.col) <= GRID_PITCH && Math.abs(a.cell.row - b.cell.row) <= GRID_PITCH);
    for (let i = 0; i < ps.length; i++) for (let j = 0; j < ps.length; j++) {
      if (i === j || !PARTAKE(ns[i]!) || !PARTAKE(ns[j]!) || !near(ps[i]!, ps[j]!)) continue;
      expect(Math.abs(BARRIO_STEP[ns[i] as CityBarrio] - BARRIO_STEP[ns[j] as CityBarrio]), `${cellKey(ps[i]!)} ${ns[i]} / ${cellKey(ps[j]!)} ${ns[j]}`).toBeLessThanOrEqual(1);
    }
  });

  it("the neighbour rule only lowers, repeats until stable and skips bars", () => {
    expect(parcelNeighborhoods([square(0, 0, "moderno"), square(30, 0, "transicion"), square(60, 0, "bajo")])).toEqual(["transicion", "clasico", "bajo"]);
    // a bars parcel (north of the plaza, east of x 157) between a moderno and a bajo one takes no part: each is 6 from the bars parcel (its
    // neighbour, were it to take part as the clasico of its barrio) and the two are 36 apart, in cells 60 apart: nothing lowers
    const bars = square(160, 170, "clasico", { x: 172, y: 182 });
    expect(parcelNeighborhoods([square(130, 170, "moderno", { x: 142, y: 212 }), bars, square(190, 170, "bajo", { x: 202, y: 212 })])).toEqual(["moderno", "bars", "bajo"]);
    expect(parcelNeighborhoods([square(130, 170, "moderno", { x: 142, y: 212 }), { ...bars, c: { x: 172, y: 212 } }, square(190, 170, "bajo", { x: 202, y: 212 })])).toEqual(["transicion", "clasico", "bajo"]); // the same parcel as a clasico takes part
    // across an axis band (12 wide) two parcels of adjacent cells are neighbours
    expect(parcelNeighborhoods([square(0, 0, "moderno"), { ...square(0, 36, "bajo"), cell: { col: 0, row: 30 } }])).toEqual(["clasico", "bajo"]);
  });

  it("polygonDistance measures convex parcel polygons: 6 across a common street, 0 when they touch", () => {
    expect(polygonDistance(square(0, 0, "clasico").poly, square(30, 0, "clasico").poly)).toBeCloseTo(6, 9);
    expect(polygonDistance(square(0, 0, "clasico").poly, square(24, 0, "clasico").poly)).toBe(0);
  });

  it("towers only north of y 320", () => {
    for (const q of onParcels) {
      const p = q.placed.parcel!;
      // the other barrios rise to their own band (#495): the tower zone is the moderno one
      if (q.placed.neighborhood === "moderno" && pieceH(q) > TOWER_FREE_H + 1e-6) expect(p.c.y < 320 && p.d >= 150, `${cellKey(p)} ${q.placed.recipe} h ${pieceH(q)}`).toBe(true);
    }
    // the plan beyond the city (built from #479): every tower-zone parcel is moderno and the rest of the moderno ones are off it
    const plan = parcels(PLAN_BOUNDS);
    expect(plan.some((p) => p.barrio === "moderno" && towerZone(p))).toBe(true);
  });

  it("bars front the costanera north of the bridge", () => {
    const bars = onParcels.filter((q) => q.placed.neighborhood === "bars").map((q) => q.placed.parcel!);
    expect(bars.map(cellKey)).toEqual(["133,171", "163,171"]);
    for (const p of bars) expect(p.c.y < 206 && p.rect.x + p.rect.w >= 157, cellKey(p)).toBe(true);
  });

  it("no crater on an axis", () => {
    for (const c of CRATERS) for (let k = -1; k < 8; k++) {
      const x = k < 0 ? c.x : c.x + c.r * Math.cos((k * Math.PI) / 4), y = k < 0 ? c.y : c.y + c.r * Math.sin((k * Math.PI) / 4);
      expect(onAxis(x, y), `${c.x},${c.y} k ${k}`).toBe(false);
    }
  });

  it("every recipe builds inside its parcel polygon", () => {
    for (const q of onParcels) {
      const p = q.placed.parcel!, lot = q.placed.lot;
      const pts = [...q.piece.ground, ...q.piece.solids.filter((s) => solidBounds(s).min.z < lot.z + 1)].flatMap((s) => {
        if (s.kind === "poly") return s.footprint;
        if (s.kind === "ground") return s.tris.flatMap((t) => t.pts.map((v) => ({ x: v.x, y: v.y })));
        const b = solidBounds(s);
        return [{ x: b.min.x, y: b.min.y }, { x: b.max.x, y: b.min.y }, { x: b.max.x, y: b.max.y }, { x: b.min.x, y: b.max.y }];
      });
      expect(outsideConvex(pts, p.poly, 0.8), `${cellKey(p)} ${q.placed.recipe}`).toEqual([]);
    }
  });

  it("classic and transition parcels are chamfered", () => {
    const unit = (a: { x: number; y: number }, b: { x: number; y: number }) => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
    let checked = 0;
    for (const q of onParcels) {
      const p = q.placed.parcel!, n = q.placed.neighborhood, lot = q.placed.lot;
      if ((n !== "clasico" && n !== "transicion") || isFixed(p) || q.piece.solids.length === 0) continue;
      const P = p.poly, tris = P.flatMap((v, i) => {
        const e1 = unit(v, P[(i + P.length - 1) % P.length]!), e2 = unit(v, P[(i + 1) % P.length]!);
        if (Math.abs(e1.x * e2.x + e1.y * e2.y) > 1e-6) return [];
        const Q = { x: v.x + SIDEWALK * (e1.x + e2.x), y: v.y + SIDEWALK * (e1.y + e2.y) };
        return [[Q, { x: Q.x + 2 * e1.x, y: Q.y + 2 * e1.y }, { x: Q.x + 2 * e2.x, y: Q.y + 2 * e2.y }] as [typeof Q, typeof Q, typeof Q]];
      });
      if (!tris.length) continue;
      const plans = [...q.piece.ground, ...q.piece.solids.filter((s) => solidBounds(s).min.z <= lot.z + 1e-6)].flatMap((s) => {
        if (s.kind === "poly") return [s.footprint];
        if (s.kind === "ground") return s.tris.map((t) => t.pts.map((v) => ({ x: v.x, y: v.y })));
        const b = solidBounds(s);
        return [[{ x: b.min.x, y: b.min.y }, { x: b.max.x, y: b.min.y }, { x: b.max.x, y: b.max.y }, { x: b.min.x, y: b.max.y }]];
      });
      checked++;
      expect(tris.some((t) => plans.reduce((a, pl) => a + triangleOverlap(pl, t), 0) <= 1e-6), `${cellKey(p)} ${q.placed.recipe}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("parcelLot: inset polygon on oblique parcels, ochava in clasico and transicion, rect fallback", () => {
    const rect = square(0, 0, "transicion");
    const t = parcelLot(rect, "transicion", "courtyardO", false, [], 16);
    expect(t).toMatchObject({ x: SIDEWALK, y: SIDEWALK, w: 24 - 2 * SIDEWALK, d: 24 - 2 * SIDEWALK, maxH: 16 });
    expect(t.poly).toEqual(ochava([{ x: 1.5, y: 1.5 }, { x: 22.5, y: 1.5 }, { x: 22.5, y: 22.5 }, { x: 1.5, y: 22.5 }], 2));
    expect(t.poly).toHaveLength(8);
    expect(parcelLot(square(0, 0, "moderno"), "moderno", "glassTower", false, [], 50).poly).toBeUndefined();
    expect(OCHAVA).toEqual({ clasico: 2.4, transicion: 2 });
    expect(ochava([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6.5 }, { x: 0, y: 6.5 }], 2.4)).toEqual(chamferPoly(chamferPoly([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6.5 }, { x: 0, y: 6.5 }], 2.4), 2));

    const wedges = builtParcels().filter((p) => p.poly.some((a, i) => { const b = p.poly[(i + 1) % p.poly.length]!; return Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6; }));
    const w = wedges.find((p) => p.cell.col === 73 && p.cell.row === 201)!; // #493: the wedge (73, 291) is now inside the hotel lot; (73, 201), clasico, is cut by the Diagonal Norte
    const inset = insetPoly(w.poly, SIDEWALK)!, box = { x: Math.min(...inset.map((v) => v.x)), y: Math.min(...inset.map((v) => v.y)) };
    const c = parcelLot(w, "clasico", "classic", false, [], 8.5);
    expect(c.poly).toEqual(ochava(inset, 2.4));
    expect(c.x).toBeCloseTo(box.x, 9);
    expect(c.y).toBeCloseTo(box.y, 9);
    const cut = inset.find((v) => Math.abs(v.x - 95.5) < 1e-6 && v.y < 207)!; // #493: the inset corner of the diagonal edge and x 95.5
    expect(c.poly!.some((v) => Math.hypot(v.x - cut.x, v.y - cut.y) < 1e-6)).toBe(false); // the short-edged right corner is cut by the second pass
    const shop = parcelLot(w, "bars", "shopRow", false, [], 18);
    expect(shop).toMatchObject({ x: w.rect.x + SIDEWALK, y: w.rect.y + SIDEWALK, w: w.rect.w - 2 * SIDEWALK, d: w.rect.d - 2 * SIDEWALK });
    expect(shop.poly).toBeUndefined();
    const plain = parcelLot(w, "bajo", "rowHouses", false, [], 6);
    expect(plain.poly).toEqual(inset);

    const sliver: Parcel = { poly: [{ x: 0, y: 0 }, { x: 40, y: 10 }, { x: 40, y: 12.8 }, { x: 0, y: 2.8 }], c: { x: 20, y: 6.4 }, area: 112, d: 150, barrio: "bajo", cell: { col: 0, row: 0 }, rect: { x: 0, y: 2.8, w: 10, d: 2.5 } };
    expect(insetPoly(sliver.poly, SIDEWALK)).toBeNull();
    const fb = parcelLot(sliver, "bajo", "rowHouses", false, [], 6);
    expect(fb.poly).toBeUndefined();
    expect(fb).toMatchObject({ x: SIDEWALK, y: 2.8 + SIDEWALK });

    const fixed = parcelLot(rect, "transicion", "patioResidential", true, [], 21);
    expect(fixed.poly).toBeUndefined(); // the singular pieces get no ochava
  });

  it("Lot.poly only for oblique parcels or ochavas", () => {
    for (const q of onParcels) {
      const p = q.placed.parcel!, obl = p.poly.some((a, i) => { const b = p.poly[(i + 1) % p.poly.length]!; return Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6; });
      if (q.placed.lot.poly) expect(obl || ["clasico", "transicion"].includes(q.placed.neighborhood), cellKey(p)).toBe(true);
    }
  });

  it("every fixed parcel is built, on a lot the kit can use", () => {
    expect(FIXED_PARCELS.map((f) => `${f.recipe} ${f.cell.col},${f.cell.row}${f.civic ? " civic" : ""}`)).toEqual([
      "civicPalace 163,321 civic", "theatre 133,321 civic", `library ${LIBRARY_CELL.col},${LIBRARY_CELL.row} civic`, "constructionSite 43,261", `patioResidential ${WATER_TOWER_CELL.col},${WATER_TOWER_CELL.row}`, `telecom ${TELECOM_CELL.col},${TELECOM_CELL.row}`,
    ]);
    expect(WATER_TOWER_CELL).toEqual({ col: 13, row: 291 });
    for (const f of FIXED_PARCELS) {
      const hits = onParcels.filter((q) => fixedParcel(q.placed.parcel!) === f);
      expect(hits, `${f.recipe}`).toHaveLength(1);
      expect(hits[0]!.placed.recipe).toBe(f.recipe);
      expect(tooSmall(hits[0]!.placed.lot), f.recipe).toBe(false);
      expect(hits[0]!.placed.neighborhood).toBe(f.civic ? "civic" : f.recipe === "telecom" ? "moderno" : "transicion"); // the TELECOM parcel is in the moderno barrio (#479); #493: the plaza centre moved 15 u south, so the construction site (centroid ~ (55, 273)) is 104.5 u from it: clasico, and since #495 (clasico < 80) transicion
    }
  });

  it("civic palace, theatre and library front the plaza or the axis", () => {
    const band = axisBand(axis("plaza"));
    // #493: the plaza ends at y 320 (114 deep) and the grid row of the palace and theatre starts at 321: the plaza is probed 1.1 out, the band 0.5 (as before)
    const fronts = (p: Parcel, open: Side[]) => {
      const b = polyBox(p.poly);
      const at = (s: Side, t: number, G: number) => ({ x: s === "w" ? b.x - G : s === "e" ? b.x + b.w + G : b.x + b.w * t, y: s === "n" ? b.y - G : s === "s" ? b.y + b.d + G : b.y + b.d * t });
      return open.some((s) => [0.25, 0.5, 0.75].some((t) => { const q = at(s, t, 1.1), r = at(s, t, 0.5); return inPlazaMayor(q.x, q.y) || pointInPoly(r.x, r.y, band); }));
    };
    for (const name of ["civicPalace", "theatre", "library"]) {
      const q = onParcels.find((r) => r.placed.recipe === name)!;
      expect(q, name).toBeDefined();
      expect(fronts(q.placed.parcel!, q.placed.lot.open), name).toBe(true);
    }
    expect(PLAZA_MAYOR).toEqual({ x: 132, y: 206, w: 54, d: 114 }); // #493: 30 u longer
  });

  it("the library falls back from (103, 201) to the nearest parcel that fronts the plaza or the axis", () => {
    const wedge = builtParcels().find((p) => p.cell.col === 103 && p.cell.row === 201)!;
    expect(wedge).toBeDefined();
    expect(tooSmall({ x: wedge.rect.x + SIDEWALK, y: wedge.rect.y + SIDEWALK, w: wedge.rect.w - 2 * SIDEWALK, d: wedge.rect.d - 2 * SIDEWALK, z: 0, open: [], maxH: 24 })).toBe(true);
    const band = axisBand(axis("plaza"));
    const fronting = builtParcels().filter((p) => p !== wedge && parcelOpenSides(p).some((s) => {
      const b = polyBox(p.poly);
      return [0.25, 0.5, 0.75].some((t) => {
        const x = s === "w" ? b.x - 0.5 : s === "e" ? b.x + b.w + 0.5 : b.x + b.w * t, y = s === "n" ? b.y - 0.5 : s === "s" ? b.y + b.d + 0.5 : b.y + b.d * t;
        return inPlazaMayor(x, y) || pointInPoly(x, y, band);
      });
    }));
    const nearest = fronting.sort((a, b) => Math.hypot(a.c.x - wedge.c.x, a.c.y - wedge.c.y) - Math.hypot(b.c.x - wedge.c.x, b.c.y - wedge.c.y))[0]!;
    expect(LIBRARY_CELL).toEqual(nearest.cell);
    expect(LIBRARY_CELL).toEqual({ col: 73, row: 201 });
  });
});

describe("the west does not move the east (#479)", () => {
  // #495: re-recorded once: moderno draws towers only (campus left its catalogue), so the picks of its parcels and the retries after them redealt (Task 1 had already moved moderno parcels to districtRng): lines whose barrio did not change moved too, through the shared rng.
  it("the east parcels keep their pre-#479 recipe, neighborhood and tone", () => {
    const east = assign(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1)).filter((p) => p.parcel && p.parcel.c.x >= -54)
      .map((p) => `${p.parcel!.cell.col},${p.parcel!.cell.row} ${p.parcel!.rect.x},${p.parcel!.rect.y} ${p.neighborhood} ${p.recipe} ${p.tone}`);
    expect(east).toMatchSnapshot();
  });

  it("row 171 parcels respect the train rule: every lot south of the track is capped so y - 1.4 z >= 134.5", () => {
    const south = worldAssign().filter((p) => p.parcel && p.parcel.rect.y > 134.2);
    expect(south.length).toBeGreaterThan(0);
    for (const p of south) expect(p.lot.maxH, `${p.parcel!.cell.col},${p.parcel!.cell.row}`).toBeLessThanOrEqual((p.parcel!.rect.y - 134.5) / 1.4 - PLINTH_H);
  });

  it("the west comes after the east and its parcels are all west of WEST_DISTRICT_X", () => {
    const ps = builtParcels(), first = ps.findIndex((p) => p.c.x < WEST_DISTRICT_X);
    expect(first).toBeGreaterThan(0);
    for (const [i, p] of ps.entries()) expect(p.c.x < WEST_DISTRICT_X, `${i}`).toBe(i >= first);
  });

  it("builtParcels(west) cuts by centroid and TELECOM_CELL is a fixed parcel", () => {
    expect(builtParcels(-60).every((p) => p.c.x > -60)).toBe(true);
    expect(builtParcels(-60).length).toBeLessThan(builtParcels().length);
    expect(builtParcels()).toBe(builtParcels());
    expect(TELECOM_CELL).toEqual({ col: -107, row: 231 });
    expect(() => assign(createRng(1), createRng(2), -60)).not.toThrow();
  });
});

describe("the strip does not move the core (#496)", () => {
  it("the core keeps its pre-#496 parcels, neighborhoods, recipes and tones", () => {
    const core = worldAssign().filter((p) => p.parcel && inCoverQuad(p.parcel.c.x, p.parcel.c.y, 16 / 9, COVER_MARGIN))
      .map((p) => `${p.parcel!.cell.col},${p.parcel!.cell.row} ${p.parcel!.rect.x},${p.parcel!.rect.y} ${p.parcel!.barrio} ${p.neighborhood} ${p.recipe} ${p.tone} ${p.lot.maxH.toFixed(3)}`);
    expect(core.length).toBeGreaterThan(50);
    expect(core).toMatchSnapshot();
  });
});
