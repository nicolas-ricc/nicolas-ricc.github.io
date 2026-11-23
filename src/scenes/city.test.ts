import { readFileSync } from "node:fs";
import type { Accent } from "../iso/accent";
import { hides, hullsOverlap, isBehind, screenBounds, screenHull } from "../iso/depth";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { lightBox, type FixedLight } from "../city/lights";
import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, type Solid } from "../iso/solids";
import { BLEED, ESTUARY_Y0, QUAY_X, STATION_LAND, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import { AVENUE, BOULEVARD, BRIDGE, CITY_EDGE, COLLAPSED, FREIGHT_ROW, ROWS, CRATERS, DISTRICT_BANK_Y, EAST_RING, FALLEN_BLOCK, PROMENADE, WEST_QUAY, blocks, estuaryEast, inBlock, inCrater } from "./city-grid";
import { PLINTH_H, city, type CityScene } from "./city";
import { CAR } from "../kit/props";
import { FIXED, FIXED_PARCELS, FOOTBRIDGE_LOT, MAX_BUILDING_H, WATER_TOWER_CELL, assign, builtParcels, tooSmall, neighborhoodOfParcel } from "../city/zoning";
import { zoneRng } from "./world";
import { MARKET_SCALE } from "../city/harbor";
import { fingerprint } from "../iso/fingerprint";
import { BRIDGE_LANDING, CITY_BOUNDS, HOTEL_LOT, PLAZA_MAYOR, inCrossingPlaza, inParcel, inPlazaMayor, onAxis, parcels, polyBox } from "./city-plan";
import { RESUME_SIGN, SIGN_PANEL, SIGN_SITE, hotel } from "./sign-hotel";
import { signBox } from "../world/sign-box";
import { zoneView } from "../world/view";

/** The hosts of `src/world/view.test.ts` ZONE_SIZES but 50×900, narrower than the word (≈ 86 screen u) at any zone scale. */
const ZONE_SIZES: [number, number][] = [[1600, 900], [1200, 900], [390, 693], [2100, 900], [640, 900], [390, 338], [390, 750], [820, 1180], [900, 900], [1280, 900], [768, 955], [390, 300], [1920, 955]];

const scene = (): CityScene => city(createRng(7), createRng(8), createRng(9));
const all = (s: CityScene): Solid[] => [...s.ground, ...s.solids];
const inRect = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, r: { x: number; y: number; w: number; d: number }) =>
  b.min.x >= r.x - 1e-6 && b.max.x <= r.x + r.w + 1e-6 && b.min.y >= r.y - 1e-6 && b.max.y <= r.y + r.d + 1e-6;
/** Strict interior of the Plaza Mayor: a crosswalk that ends exactly on the edge does not step on it. */
const inPlaza = (x: number, y: number) => x > PLAZA_MAYOR.x && x < PLAZA_MAYOR.x + PLAZA_MAYOR.w && y > PLAZA_MAYOR.y && y < PLAZA_MAYOR.y + PLAZA_MAYOR.d;
/** The parcels of the modern belt (the landmark cap): none inside CITY_BOUNDS today, the modern area lies west of x -54. */
const DISTRICT = builtParcels().filter((p) => neighborhoodOfParcel(p) === "moderno").map((p) => p.rect);
const inDistrict = (s: Solid) => DISTRICT.some((b) => inRect(bounds(s), b)); // #477: "moderno" replaces "district"; none is built until #479
/** The fixed blocks (landmarks): they can reach 24 above the plinth, with a finial. */
const FIXED_BLOCKS = blocks().filter((b) => FIXED.some((f) => f.x === b.x && f.y === b.y));
const inFixed = (s: Solid) => FIXED_BLOCKS.some((b) => inRect(bounds(s), b));
/** The parcels of the singular pieces (#477): a piece lifted onto the plinth reaches its cap (21 above its lot, A3) 0.3 above street level. */
const FIXED_RECTS = builtParcels().filter((p) => FIXED_PARCELS.some((f) => f.cell.col === p.cell.col && f.cell.row === p.cell.row)).map((p) => p.rect);
/** The hotel with its sign (#474), built alone: its solids are matched by value in the city. */
const HOTEL_OWN: Solid[] = [];
hotel(HOTEL_OWN, [], []);
const HOTEL_KEYS = new Set(HOTEL_OWN.map((s) => JSON.stringify(s)));
/** The pieces that can exceed 21: the hotel's own solids (slab, machine room, sign panel). */
const isHotelPiece = (s: Solid) => HOTEL_KEYS.has(JSON.stringify(s));

const CITY_MATS: readonly Material[] = ["office", "officeDark", "glass", "asphalt", "paving", "plaza", "curtain", "stone", "copper", "leaf", "leafDark", "water", "steel", "rust", "plaster", "terracotta", "marble", "awning", "deck", "rail",
  "brick", "sheetTeal", "concrete", "hull", "whitewash", "rock", // dock inlet (#326)
  // warehouses and freight yard (#325): reconversion kit, containers and the dock
  "sheetGreen", "boxRust", "boxBlue", "boxGrey", "boxGreen", "boxOrange"];

const plazaMayorTiles = (g: Solid): boolean => g.kind === "ground" && g.mat === "plaza" && g.tris.every((t) => inPlazaMayor((t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3)); // not the crossing plazas' tiles (#473)
describe("city", () => {
  it("is deterministic per seed", () => {
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).toBe(JSON.stringify(city(createRng(7), createRng(8), createRng(9))));
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).not.toBe(JSON.stringify(city(createRng(8), createRng(8), createRng(9))));
  });

  it("everything falls in the Resume zone except the cones, and uses only city materials", () => {
    for (const s of all(scene())) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X + 1); // the west of the city (#479) reaches the edge of the view, over the bleed
      expect(b.max.y).toBeLessThanOrEqual(WORLD.y1 + 1);
      if (s.kind !== "cone") expect(b.min.y).toBeGreaterThanOrEqual(ZONE_SPLIT_Y - 1);
      expect(CITY_MATS).toContain(s.mat);
      if (s.mat === "steel" || s.mat === "rust") expect(["prism", "cylinder", "vault", "beam"]).toContain(s.kind); // only furniture, cars, the quay sheds and the derelict hall's trusses
    }
    const mats = new Set(all(scene()).map((s) => s.mat));
    for (const m of ["plaster", "terracotta", "marble", "awning"] as const) expect(mats.has(m)).toBe(true);
  });

  it("the plinths are parcel polygons (#472) and the buildings with a facade fall in a block or a parcel", () => {
    const s = scene();
    const plinths = s.solids.filter((x) => x.kind === "poly" && x.mat === "paving" && x.h === PLINTH_H && x.z === 0);
    expect(plinths.length).toBeGreaterThanOrEqual(25);
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.h === PLINTH_H && x.at.z === 0 && x.w === 24 && x.d === 18)).toHaveLength(13); // measured: the strip and the east bank keep their 24 × 18 plinths
    const buildings = s.solids.filter((x) => (x.kind === "prism" || x.kind === "poly" || x.kind === "cylinder") && x.facade !== undefined);
    expect(buildings.length).toBeGreaterThanOrEqual(30);
    const rects = parcels(CITY_BOUNDS).map((p) => polyBox(p.poly)); // the bounding box holds the inset polygon lots (#477)
    for (const b of buildings) {
      if (isHotelPiece(b)) continue;
      if (b.kind === "prism" && b.mat === "paving" && b.at.z === -1) continue; // the promenade walls carry an arcade, they are not buildings
      expect(b.kind !== "prism" || b.h <= (inDistrict(b) || inFixed(b) ? 24 : MAX_BUILDING_H)).toBe(true);
      expect(blocks().some((blk) => inRect(bounds(b), blk)) || rects.some((r) => inRect(bounds(b), { x: r.x - 0.8, y: r.y - 0.8, w: r.w + 1.6, d: r.d + 1.6 }))).toBe(true); // inside a block or a parcel
    }
  });

  it("freight lots (#325): a freightShed or openDock each, each on a 24 × 13 paving plinth (#142: neither brings ground)", () => {
    const s = scene(), lots = blocks().filter((b) => b.kind === "freight");
    const plinths = s.solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.h === PLINTH_H && x.at.z === 0 && x.w === 24 && x.d === FREIGHT_ROW.d);
    const placed = lots.map((b) => s.placed.find((p) => p.placed.block.x === b.x && p.placed.block.y === b.y)!);
    for (const p of placed) expect(["freightShed", "openDock"]).toContain(p.placed.recipe);
    expect(placed.every((p) => p.piece.ground.length === 0)).toBe(true);
    expect(plinths.map((x) => x.kind === "prism" && `${x.at.x},${x.at.y}`)).toEqual(lots.map((b) => `${b.x},${b.y}`));
  });

  it("the covered market stands on (72, 92): steel 0.4² pillars, stalls inside, everything within its lot (+0.8 awnings) (#325)", () => {
    const s = scene(), m = s.placed.find((p) => p.placed.block.x === 72 && p.placed.block.y === ROWS[0])!;
    expect(m.placed.recipe).toBe("coveredMarket");
    const own = s.solids.slice(m.solidOffset, m.solidOffset + m.piece.solids.length);
    expect(own.filter((q) => q.kind === "prism" && q.mat === "steel" && q.w === 0.4 && q.d === 0.4).length).toBeGreaterThanOrEqual(4);
    expect(own.filter((q) => q.kind === "prism" && q.h === 1.8).length).toBeGreaterThanOrEqual(6);
    const lot = m.placed.lot;
    expect(lot).toMatchObject({ x: 73.5, y: 93.5, w: 21, d: 15 });
    for (const q of own) expect(inRect(bounds(q), { x: lot.x - 0.8, y: lot.y - 0.8, w: lot.w + 1.6, d: lot.d + 1.6 }), JSON.stringify(q).slice(0, 100)).toBe(true);
  });

  it("no car on the railyards or the freight lots (#320)", () => {
    for (const x of scene().solids) {
      if (!(x.kind === "prism" && x.w === CAR.w && x.d === CAR.d && x.h === 1.2)) continue;
      const b = bounds(x);
      if (b.max.x > 96) continue;
      expect(b.min.y >= ROWS[0] && (b.max.y <= ROWS[0] + 20 || b.min.y >= 158), `${b.min.x},${b.min.y}`).toBe(true); // row 92 parks only on its south curb (y 110.4..111.9): its north side is the seam fence
    }
  });

  it("nothing but the hotel's own solids exceeds 21", () => {
    const s = scene();
    expect(s.solids.filter(isHotelPiece)).toHaveLength(HOTEL_OWN.length); // the exemption matches the hotel and nothing else
    for (const x of s.solids) if (!isHotelPiece(x)) expect(bounds(x).max.z).toBeLessThanOrEqual(inDistrict(x) || inFixed(x) ? 25 : FIXED_RECTS.some((r) => inRect(bounds(x), r)) ? 21 + PLINTH_H : 21); // the singular pieces on a plinth reach 21 above their lot (A3); the district and the landmarks reach 24 above the plinth, with a finial
  });

  // the old "in front of the tower no building exceeds 10" pinned the row south of the old plaza (y 242): that row is now Plaza Mayor tiles and the zoning's parcels (#472)

  it("the plaza has broken tiles and the devoured blocks have jungle over their ground", () => {
    const s = scene();
    const plaza = s.ground.filter(plazaMayorTiles);
    expect(plaza).toHaveLength(1); // the Plaza Mayor minus the landing: one strip
    const tris = plaza.flatMap((g) => (g.kind === "ground" ? g.tris : []));
    expect(tris.length).toBe(2 * 9 * 13); // 6 u tiles: 54 × 74 (9 columns, 13 rows, the last partial)
    expect(tris.some((t) => (t.toneOffset ?? 0) !== 0)).toBe(true);
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "leafDark").length).toBeGreaterThanOrEqual(1); // measured 1 at #477: the west bank no longer deals eatenRuin (it was residential's), the east bank keeps one (was 3 or more)
  });

  it("no cone steps on asphalt outside craters, blocks and the riverbank; the accents are amber, windows or neons with their Bleed", () => {
    const s = scene();
    for (const c of s.solids) {
      if (c.kind !== "cone" || (c.mat === "stone" && c.at.x >= BRIDGE.x0 && c.at.x <= BRIDGE.x1 && c.at.y >= BRIDGE.y0 && c.at.y <= BRIDGE.y1)) continue; // the finials of the bridge obelisks are stone, not trees
      // south of the district the east bank is jungle with no grid (there are no blocks on the east side anymore)
      const onCity = c.at.x >= CITY_EDGE.west && c.at.x < PROMENADE.x0 && c.at.y >= ESTUARY_Y0 + 12 && c.at.y < CITY_EDGE.south && !(c.at.x > QUAY_X && c.at.x < EAST_RING.x0) && !(c.at.x > EAST_RING.x0 && c.at.y >= DISTRICT_BANK_Y);
      if (onCity) expect(inBlock(c.at.x, c.at.y) || inParcel(c.at.x, c.at.y) || inCrater(c.at.x, c.at.y) || (c.at.y >= BOULEVARD.y0 && c.at.y <= BOULEVARD.y1) || (c.at.x === 10 && c.mat === "leaf") /* the boulevard's median trees (#473) */, `cone ${c.at.x},${c.at.y} ${c.mat}`).toBe(true);
    }
    expect(s.accents.length).toBeGreaterThan(6);
    const NEON = ["magenta", "magentaBleed", "cyan", "cyanBleed"];
    // greenMid: RESUME letters of the hotel sign (#474)
    expect(s.accents.every((a) => a.color.startsWith("amber") || a.color === "windowWarm" || a.color === "windowCool" || a.color === "greenMid" || NEON.includes(a.color))).toBe(true);
    expect(s.accents.filter((a) => a.color === "windowWarm" || a.color === "windowCool").length).toBeGreaterThanOrEqual(100);
  });

  it("scene.accents does not carry the animatable windows or the flickering neon; it does carry the other lit ones and the other neons", () => {
    const s = scene(), l = s.lights;
    const polys = new Set(s.accents.flatMap((a) => (a.kind === "poly" ? [a.pts] : [])));
    expect(l.windows.some((w) => w.animable)).toBe(true);
    expect(l.flicker).not.toBeNull();
    for (const w of l.windows.filter((x) => x.animable)) expect(polys.has(w.window.pts)).toBe(false);
    for (const w of l.windows.filter((x) => x.on && !x.animable)) expect(polys.has(w.window.pts)).toBe(true);
    l.neons.forEach((n, i) => { for (const a of n.accents) expect(s.accents.includes(a)).toBe(i !== l.flicker); });
  });

  it("the lights rng does not change the city, only its lights", () => {
    const a = city(createRng(7), createRng(8), createRng(9)), b = city(createRng(7), createRng(8), createRng(10));
    expect(JSON.stringify(b.solids)).toBe(JSON.stringify(a.solids));
    expect(JSON.stringify(b.ground)).toBe(JSON.stringify(a.ground));
    expect(JSON.stringify(b.lights)).not.toBe(JSON.stringify(a.lights));
  });

  it("the whole render uses colors from the atlas", () => {
    const s = scene();
    const colors = allIsoColors();
    for (const i of buildRenderList(all(s))) expect(colors.has(i.color)).toBe(true);
  });

  it("avenue: boulevard, lanes, crosswalks and traffic lights", () => {
    const s = scene();
    const strips = s.ground.filter((g) => g.kind === "strip" && g.mat !== "rail"); // the main line (#319) is counted apart
    expect(strips.length).toBeGreaterThan(60);
    expect(strips.length).toBeLessThanOrEqual(370); // measured (#473): 340 strips (rails apart), ×1.1 rounded to the ten
    expect(strips.every((g) => g.kind === "strip" && g.mat === "paving" && g.z > 0 && g.z < 0.1)).toBe(true);
    // no stripe steps on the estuary (the ground is drawn on top of the water): the east ring is cut where the water comes in
    for (const g of strips) if (g.kind === "strip") for (const p of g.path) expect(p.x <= QUAY_X || p.x > estuaryEast(p.y)).toBe(true);
    // no stripe falls on the plaza: the ground is drawn in insertion order and would cover it
    for (const g of strips) if (g.kind === "strip") for (const p of g.path) expect(inPlaza(p.x, p.y)).toBe(false);
    // no stripe of the east ring reaches the jungle strip of the bank (except the avenue crossing)
    for (const g of strips) {
      if (g.kind !== "strip" || g.mat !== "paving" || g.width !== 0.4) continue;
      if (!g.path.some((p) => p.x > EAST_RING.x0)) continue;
      for (const p of g.path) expect(p.y <= DISTRICT_BANK_Y || (p.y >= AVENUE.y0 && p.y <= AVENUE.y1)).toBe(true);
    }
    const boulevard = s.solids.filter((x) => x.kind === "prism" && x.mat === "leafDark" && x.at.z === 0); // not the green terrace of a glass tower of the district
    expect(boulevard.length).toBeGreaterThanOrEqual(2); // #472: only the east stretch of the avenue keeps its boulevard (the two east blocks)
    expect(boulevard.every((x) => (bounds(x).min.y >= BOULEVARD.y0 && bounds(x).max.y <= BOULEVARD.y1) || (bounds(x).min.x >= 8 && bounds(x).max.x <= 12))).toBe(true); // or the median of the Bulevar Central (#473)
    // street lamps (only on axes, plaza, crossing plazas, costanera, bridge, promenade, the hotel portal) are checked in city-streets.test.ts (#473)
  });

  it("bridge: deck over the water from quay to ring, stone piers down to the bottom, ramps at the heads", () => {
    const s = scene();
    const deck = s.solids.find((x) => x.kind === "prism" && x.mat === "asphalt" && x.w > 60)!;
    expect(deck.kind === "prism" && deck.at.x).toBe(WEST_QUAY.x0);
    expect(deck.kind === "prism" && deck.at.x + deck.w).toBe(EAST_RING.x1);
    expect(deck.kind === "prism" && deck.at.z).toBe(1.2);
    const piers = s.solids.filter((x) => x.kind === "poly" && x.mat === "stone" && x.z === -1 && bounds(x).min.y >= BRIDGE.y0 - 1 && bounds(x).max.y <= BRIDGE.y1 + 1);
    expect(piers.length).toBeGreaterThanOrEqual(4);
    const ramps = s.solids.filter((x) => x.kind === "ramp" && x.mat === "asphalt" && x.at.y === BRIDGE.y0);
    expect(ramps.map((r) => r.kind === "ramp" && r.dir).sort()).toEqual(["e", "w"]);
  });

  it("west quay and promenade: walls from the water, parapet, stairs inside the zone", () => {
    const s = scene();
    const walls = s.solids.filter((x) => x.kind === "prism" && x.at.z === -1 && x.d > 30);
    expect(walls.length).toBeGreaterThanOrEqual(4); // two sections per side
    expect(walls.some((x) => x.kind === "prism" && x.mat === "plaza" && x.at.x === WEST_QUAY.x0)).toBe(true);
    expect(walls.some((x) => x.kind === "prism" && x.mat === "paving" && x.at.x === PROMENADE.x0)).toBe(true);
    const parapet = s.solids.filter((x) => x.kind === "prism" && x.at.x >= PROMENADE.x1 - 2 && x.h === 0.8);
    expect(parapet.length).toBeGreaterThanOrEqual(2);
    const stairs = s.solids.filter((x) => x.kind === "ramp" && x.at.z === -1);
    expect(stairs.length).toBeGreaterThanOrEqual(2);
    for (const st of stairs) expect(bounds(st).max.x).toBeLessThanOrEqual(ZONE_SPLIT_X);
  });

  it("collapse: ramp to the water, sunken blocks and the fourth fallen in the street in front of the promenade", () => {
    const s = scene();
    const sunk = s.solids.filter((x) => x.kind === "prism" && x.mat === "officeDark" && x.at.z < 0);
    expect(sunk.length).toBeGreaterThanOrEqual(3);
    for (const b of sunk) expect(b.kind === "prism" && b.at.y).toBeGreaterThanOrEqual(240);
    // the fourth block, fallen in the street in front of the promenade (the spec asks for it; the sea in front of the promenade is already the Blog zone)
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "officeDark" && x.at.z === 0 && x.h <= 1 && x.at.x === FALLEN_BLOCK.x && x.at.y === FALLEN_BLOCK.y && x.w === FALLEN_BLOCK.w && x.d === FALLEN_BLOCK.d)).toBe(true);
    expect(s.solids.some((x) => x.kind === "ramp" && x.mat === "asphalt" && x.dir === "w" && x.at.y === COLLAPSED.y)).toBe(true);
  });

  it("cars: a single size, they do not fall on a block or a crater, and none overlaps another", () => {
    const s = scene();
    const cars = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && (x.mat === "steel" || x.mat === "rust") && x.h === 1.2 && !(x.at.x === MARKET_SCALE.x && x.at.y === MARKET_SCALE.y && x.w === MARKET_SCALE.w) && !(x.w === 1.5 && x.d === 3)); // not the fish market scale (#326) nor the buffer stop of the siding (#325)
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

  it("the main line crosses the strip: two rails and a ballast bed from WORLD.x0 to the station land (#319)", () => {
    const rails = scene().ground.filter((g) => g.kind === "strip" && g.mat === "rail");
    expect(rails.filter((g) => g.kind === "strip" && g.width === 0.5 && g.path[0]!.x === WORLD.x0).map((g) => g.kind === "strip" && g.path[0]!.y).sort()).toEqual([131, 134]);
    expect(rails.some((g) => g.kind === "strip" && g.width === 5)).toBe(true);
  });

  it("jungle: east bank and craters, more than 60 cones (the south edge belongs to the tech district; the west has only kit trees, #479)", () => {
    const s = scene();
    const cones = s.solids.filter((x) => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark"));
    expect(cones.length).toBeGreaterThan(60);
    for (const c of cones) if (c.kind === "cone" && c.at.y < ROWS[1]! && c.at.x < QUAY_X) expect(inBlock(c.at.x, c.at.y), `${c.at.x},${c.at.y}`).toBe(true); // no seam belt since #319: in the new strip only the courtyard trees of its blocks (#320)
    for (const c of cones) if (c.kind === "cone" && c.at.x < CITY_EDGE.west) expect(inParcel(c.at.x, c.at.y), `${c.at.x},${c.at.y}`).toBe(true); // west of x −54 (#479): only the trees of the kit pieces, inside their parcels
    expect(cones.some((c) => c.kind === "cone" && c.at.x > QUAY_X && c.at.x < EAST_RING.x0)).toBe(true); // east bank
    for (const cr of CRATERS) expect(cones.some((c) => c.kind === "cone" && inCrater(c.at.x, c.at.y) && Math.hypot(c.at.x - cr.x, c.at.y - cr.y) <= cr.r)).toBe(true);
  });

  it("the avenue keeps only its east stretch (#472) and the promenade goes down to 326", () => {
    const s = scene();
    const carriageways = [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2];
    const dashes = s.ground.filter((g) => g.kind === "strip" && g.mat === "paving" && g.width === 0.4 && carriageways.includes(g.path[0]!.y));
    expect(dashes.length).toBeGreaterThan(0);
    expect(dashes.every((g) => g.kind === "strip" && g.path[0]!.x >= EAST_RING.x1)).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "paving" && x.at.x === PROMENADE.x0 && x.at.y + x.d >= PROMENADE.y1)).toBe(true);
  });

  // the district signs left with the district blocks (#472: no "district" neighborhood in the plan; they come back with #476), so no sign count is pinned
  it("neon: the signs that exist are coplanar in y, and a light over each street lamp of the promenade", () => {
    const worldCity = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)); // the real seed of the world
    const c = scene();
    // the district signs are back with the west (#479): the moderno parcels west of −54 carry them (measured on agent/479: 18 with seeds 7/8/9, 17 with the world seed)
    expect(c.neon.signs.length).toBeGreaterThan(0);
    expect(worldCity.neon.signs.length).toBeGreaterThan(0);
    for (const s of [...c.neon.signs, ...worldCity.neon.signs]) {
      if (s.kind !== "poly") throw new Error("sign not poly");
      expect(s.pts).toHaveLength(4);
      expect(new Set(s.pts.map((p) => p.y)).size).toBe(1);
    }
    const bulbs = c.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.at.x === PROMENADE.x1 - 3 + 0.3);
    expect(c.neon.promenade).toHaveLength(8);
    for (const p of c.neon.promenade) expect(bulbs.some((b) => b.kind === "dot" && b.at.x === p.x && b.at.y === p.y && b.at.z + 0.4 === p.z)).toBe(true);
  });

  it("the props come from the kit: city.ts and streets.ts do not assemble bollards, cars, traffic lights, tanks or puddles by hand", () => {
    for (const f of ["src/scenes/city.ts", "src/city/streets.ts", "src/city/fixed.ts"]) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
      expect(src).not.toMatch(/r: 0\.4, h: 0\.8/);          // bollard
      expect(src).not.toMatch(/3, 1\.5, 1\.2/);             // car
      expect(src).not.toMatch(/0\.3, 0\.3, 4, "steel"/);    // traffic light
      expect(src).not.toMatch(/PUDDLE_RADII/);              // puddle
      expect(src).not.toMatch(/r: 1\.2, h: 2, mat: "rust"/); // water tank
    }
  });

  it("placed: one piece per assigned block, with the neighborhood, the recipe and the first solid of the piece", () => {
    const s = scene(), expected = assign(createRng(7), createRng(8));
    expect(s.placed.map((p) => [p.placed.block.x, p.placed.block.y, p.placed.neighborhood, p.placed.recipe])).toEqual(expected.map((p) => [p.block.x, p.block.y, p.neighborhood, p.recipe]));
    for (const { piece, solidOffset } of s.placed) {
      if (piece.solids.length === 0) continue; // a sliver parcel (lot side < MIN_LOT_SIDE): plinth and an empty piece (#472)
      expect(s.solids[solidOffset]).toBe(piece.solids[0]);
      expect(s.solids.slice(solidOffset, solidOffset + piece.solids.length)).toEqual(piece.solids);
    }
  });

  it("plinth by ground presence, seeds 1..5: no ground piece on a plinth, eatenRuin and campus without one, placed.lot.z is the resolved z", () => {
    const seen = { courtyardO: 0, library: 0 };
    for (let s = 1; s <= 5; s++) {
      const c = city(createRng(s), createRng(s + 1), createRng(s + 2));
      for (const q of c.placed) {
        if (q.placed.parcel && q.piece.solids.length === 0) continue; // a sliver parcel: plinth, empty piece, lot.z 0, whatever recipe it was dealt (#472)
        const b = q.placed.block, ground = q.piece.ground.length > 0;
        const parcel = q.placed.parcel;
        const onPlinth = c.solids.some((x) => parcel ? x.kind === "poly" && x.mat === "paving" && x.z === 0 && x.h === PLINTH_H && x.footprint.length === parcel.poly.length && x.footprint.every((pt, k) => Math.abs(pt.x - parcel.poly[k]!.x) < 1e-9 && Math.abs(pt.y - parcel.poly[k]!.y) < 1e-9)
          : x.kind === "prism" && x.mat === "paving" && x.at.x === b.x && x.at.y === b.y && x.at.z === 0 && x.w === b.w && x.d === b.d && x.h === PLINTH_H);
        const id = `seed ${s} ${q.placed.recipe}@${b.x},${b.y}`;
        expect(onPlinth, id).toBe(!ground);
        expect(q.placed.lot.z, id).toBe(onPlinth ? PLINTH_H : 0);
        if (q.placed.recipe === "eatenRuin" || q.placed.recipe === "campus") expect(onPlinth, id).toBe(false);
        if ((q.placed.recipe === "courtyardO" || q.placed.recipe === "library") && ground) seen[q.placed.recipe]++;
      }
    }
    expect(seen.courtyardO).toBeGreaterThan(0);
    // the library recipe is not dealt in the new layout (seeds 1..5): only courtyardO is pinned (#472)
  });

  // Fingerprints measured on 860a582, before #142: lifting must reproduce the plinth pieces of then.
  // A deliberate change to a recipe without ground moves them; re-record then, as with world-baseline.
  // #143: a recipe with ground drawing more rng (courtyardO's 2×2 patio tiles) moves the pieces after it too;
  // seeds 1, 2 and 4 (the ones with a paved courtyardO) re-recorded once.
  // #56: the seam at y 90 adds rows, neighbourhoods and recipes (and openDock goes onto a plinth); all five re-recorded once.
  // #152: the interlocks mark enters the JSON; shopRow, tankGroup, constructionSite and derelictHall change geometry; all five re-recorded once.
  // #165: gallery, courtyardO and patioResidential now publish neon slots (no rng): seeds 2..5 re-recorded once.
  // #472: the west bank is dealt on the parcels of the city plan: all five re-recorded once.
  // #477: the barrio neighbourhoods deal other recipes and rng streams: all five re-recorded once (Task 2; later tasks re-record again).
  // #477 Task 3: the parcel lots carry the inset polygon and the ochavas: all five re-recorded again.
  // #477 Task 4: the civic palace, theatre, library, obra and tank host stand on their named parcels: all five re-recorded again.
  // #479: the west adds its pieces (and the telecom): all five re-recorded once with the whole city; the east alone (`opts.west = -54`) keeps the old fingerprints (EAST).
  // That lifting equals running the recipe PLINTH_H higher is checked per recipe in piece.test.
  it("pieces without ground are identical to the pinned plinth pieces (860a582; re-recorded at #143, #56, #152 and #165)", () => {
    const EAST = ["463dcb4d", "c540539a", "e9c5b4f5", "4dd4c753", "d0ee13e9"], MAIN = ["ac4094bd", "037bf2d3", "ebae98df", "4fb3f9eb", "f851b786"];
    for (let s = 1; s <= 5; s++) {
      for (const [west, pinned] of [[-54, EAST], [-Infinity, MAIN]] as const) {
        const c = city(createRng(s), createRng(s + 1), createRng(s + 2), { west });
        const plain = c.placed.filter((q) => q.piece.ground.length === 0).map((q) => q.piece);
        expect(fingerprint(plain as unknown as Solid[]), `seed ${s} west ${west}`).toBe(pinned[s - 1]);
      }
    }
  });

  // the water tower left with its host block (#472); it comes back in #477
  it("stone footbridge over the estuary", () => {
    const s = scene();
    const deck = s.solids.find((x) => x.kind === "prism" && x.mat === "stone" && x.at.x === FOOTBRIDGE_LOT.x && x.w === FOOTBRIDGE_LOT.w);
    expect(deck).toBeDefined();
    const b = bounds(deck!);
    expect(b.min.y).toBeGreaterThanOrEqual(174);
    expect(b.max.y).toBeLessThanOrEqual(178);
    expect(b.min.x).toBe(WEST_QUAY.x1);
    expect(b.max.x).toBeGreaterThan(estuaryEast(178));
  });

  it("district signs: opaque cyan or magenta, 1.6 tall, 0.4 in front of the south face of a district building", () => {
    const s = scene();
    for (const sign of s.neon.signs) {
      if (sign.kind !== "poly") throw new Error("sign not poly");
      expect(["cyan", "magenta"]).toContain(sign.color);
      expect(sign.alpha).toBe(1);
      const zs = sign.pts.map((p) => p.z), y = sign.pts[0]!.y;
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1.6, 6);
      const wall = s.solids.find((w) => w.kind === "prism" && !!w.facade && inDistrict(w) && Math.abs(w.at.y + w.d + 0.4 - y) < 1e-6);
      expect(wall).toBeDefined();
    }
  });
});

describe("fixed lights (world seed, #171)", () => {
  const s = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));
  const bs = s.solids.map(bounds), hs = bs.map(screenHull), published = new Set(s.accents);
  const hiddenLight = (f: FixedLight): boolean => {
    const box = lightBox([f.at]), back = screenHull(box);
    return bs.some((b, i) => (i < f.own[0] || i >= f.own[1]) && hides(box, b, { back, front: hs[i]! }));
  };

  it("no fixed light left in the accents is hidden, and each is published whole or not at all (brute-force oracle)", () => {
    expect(s.fixedLights.length).toBeGreaterThan(50);
    for (const f of s.fixedLights) {
      const n = f.accents.filter((a) => published.has(a)).length;
      expect([0, f.accents.length]).toContain(n);
      expect(n === f.accents.length).toBe(!hiddenLight(f));
    }
  });

  // the old "obelisk point behind the block is gone" pinned an east block (y 272) that hid the bridge obelisk: those blocks left (#472), the brute-force oracle above covers hiding

  it("fountain and plaza lamps stay, with no puddles", () => {
    const inPlazaRect = (a: Accent) => a.kind === "poly" && a.pts.every((q) => q.x >= PLAZA_MAYOR.x && q.x <= PLAZA_MAYOR.x + PLAZA_MAYOR.w && q.y >= PLAZA_MAYOR.y && q.y <= PLAZA_MAYOR.y + PLAZA_MAYOR.d);
    expect(s.accents.filter((a) => inPlazaRect(a) && a.color === "amberBleed" && a.kind === "poly" && a.alpha === 0.25)).toHaveLength(0);
    expect(s.accents.filter((a) => inPlazaRect(a) && a.color === "amberBleed" && a.kind === "poly" && a.alpha === 0.35)).toHaveLength(3);
    for (const x of [PLAZA_MAYOR.x + 2.3, PLAZA_MAYOR.x + PLAZA_MAYOR.w - 2.3]) {
      expect(s.accents.some((a) => a.kind === "dot" && Math.hypot(a.at.x - x, a.at.y - 248.8, a.at.z - 5.05) < 1e-6)).toBe(true);
    }
  });

  it("kit accents unchanged", () => {
    for (const p of s.placed) for (const a of p.piece.accents) expect(published.has(a)).toBe(true);
  });
});

// ---------------------------------------------------------------- #472: the west bank on the new layout

describe("city on the new layout (#472)", () => {
  const s = scene();
  const within = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, r: { x: number; y: number; w: number; d: number }, m: number) =>
    b.min.x >= r.x - m - 1e-6 && b.max.x <= r.x + r.w + m + 1e-6 && b.min.y >= r.y - m - 1e-6 && b.max.y <= r.y + r.d + m + 1e-6;
  const inR = (r: { x: number; y: number; w: number; d: number }, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;
  const samePoly = (a: readonly { x: number; y: number }[], b: readonly { x: number; y: number }[]) =>
    a.length === b.length && a.every((p, i) => Math.abs(p.x - b[i]!.x) < 1e-9 && Math.abs(p.y - b[i]!.y) < 1e-9);
  const plinths = s.solids.filter((x): x is Solid & { kind: "poly" } => x.kind === "poly" && x.mat === "paving" && x.h === PLINTH_H && x.z === 0);

  it("is deterministic", () => {
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).toBe(JSON.stringify(scene()));
  });

  it("one plinth per built parcel, with the parcel's footprint (the hotel lot included, with nothing on it)", () => {
    for (const pp of s.placed) {
      const parcel = pp.placed.parcel;
      if (!parcel || pp.piece.ground.length > 0) continue;
      expect(plinths.filter((x) => samePoly(x.footprint, parcel.poly)).length, `${parcel.cell.col},${parcel.cell.row}`).toBe(1);
    }
    expect(s.placed.filter((pp) => pp.placed.parcel).length).toBeGreaterThan(25);
    const hotel = parcels(CITY_BOUNDS).find((p) => p.rect.x === HOTEL_LOT.x && p.rect.y === HOTEL_LOT.y && p.rect.w === HOTEL_LOT.w && p.rect.d === HOTEL_LOT.d)!;
    expect(plinths.filter((x) => samePoly(x.footprint, hotel.poly))).toHaveLength(1);
    expect(s.placed.some((pp) => pp.placed.parcel === hotel)).toBe(false);
    // nothing stands on the lot itself but the hotel
    for (const x of s.solids) if (!isHotelPiece(x) && x !== plinths.find((p) => samePoly(p.footprint, hotel.poly))) {
      expect(within(bounds(x), HOTEL_LOT, 0), `${x.kind} ${x.mat} on the hotel lot`).toBe(false);
    }
  });

  it("sliver parcels (lot side < 7, R5) keep their plinth and build nothing; there are 3 in the world seed", () => {
    // measured at #472: 8 (the inscribed-rect lots); at #477 the polygon lots (bounding box of the inset) leave cells (−17,171) ×2 and (43,291)
    const world = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));
    const bare = world.placed.filter((pp) => pp.placed.parcel && tooSmall(pp.placed.lot));
    expect(bare).toHaveLength(3);
    for (const pp of bare) {
      expect(pp.piece.solids).toEqual([]);
      expect(world.solids.filter((x) => x.kind === "poly" && x.mat === "paving" && x.h === PLINTH_H && samePoly(x.footprint, pp.placed.parcel!.poly))).toHaveLength(1);
    }
  });

  it("the plaza tiles step off BRIDGE_LANDING, and the landing is paving", () => {
    const tris = s.ground.flatMap((g) => (plazaMayorTiles(g) && g.kind === "ground" ? g.tris : []));
    expect(tris.length).toBeGreaterThan(0);
    let area = 0;
    for (const t of tris) {
      const [a, b, c] = t.pts, cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
      expect(inR(PLAZA_MAYOR, cx, cy)).toBe(true);
      expect(inR(BRIDGE_LANDING, cx, cy)).toBe(false);
      area += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    }
    // 54 × 85, minus the landing (54 × 10) and the 1 u curb strip north of the landing
    expect(area).toBeCloseTo(54 * 85 - 54 * 10 - 54, 6);
    const landing = s.ground.flatMap((g) => (g.kind === "ground" && g.mat === "paving" ? g.tris : [])).filter((t) => inR(BRIDGE_LANDING, (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3));
    expect(landing.length).toBeGreaterThan(0);
  });

  it("no car falls on an axis band, a plaza, a crater, the hotel lot, a parcel nor on another car", () => {
    const cars = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && (x.mat === "steel" || x.mat === "rust") && x.h === 1.2 && x.w === CAR.w && x.d === CAR.d);
    expect(cars.length).toBeGreaterThanOrEqual(20);
    for (const c of cars) {
      const corners = [[c.at.x, c.at.y], [c.at.x + c.w, c.at.y], [c.at.x + c.w, c.at.y + c.d], [c.at.x, c.at.y + c.d]] as const;
      const mx = c.at.x + c.w / 2, my = c.at.y + c.d / 2, tag = `car ${c.at.x},${c.at.y}`;
      for (const [x, y] of corners) {
        expect(onAxis(x, y), `${tag} on an axis`).toBe(false);
        expect(inPlazaMayor(x, y) || inCrossingPlaza(x, y), `${tag} on a plaza`).toBe(false);
        expect(inR(HOTEL_LOT, x, y), `${tag} on the hotel lot`).toBe(false);
        expect(inParcel(x, y), `${tag} on a parcel`).toBe(false);
      }
      expect(CRATERS.some((k) => Math.hypot(mx - k.x, my - k.y) <= k.r + 2), `${tag} by a crater`).toBe(false);
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i]!, b = cars[j]!;
      expect(a.at.x < b.at.x + b.w && a.at.x + a.w > b.at.x && a.at.y < b.at.y + b.d && a.at.y + a.d > b.at.y).toBe(false);
    }
  });
});

describe("the hotel and its RESUME sign in the city (#474)", () => {
  const s = scene();
  const own: Solid[] = [], ownAccents: Accent[] = [], ownLights: FixedLight[] = [];
  const lit = hotel(own, ownAccents, ownLights);
  const panel = bounds(SIGN_PANEL), panelScreen = screenBounds(panel);
  /** On screen the panel's bottom edge is horizontal (a diagonal wall): the largest sy of its bottom corners. */
  const bottomSy = Math.max(...SIGN_PANEL.footprint.map((p) => project(v3(p.x, p.y, SIGN_PANEL.z)).y));

  it("city() builds the hotel on HOTEL_LOT: hotel()'s solids, inside HOTEL_LOT ± 0.5, and publishes its lights", () => {
    for (const x of own) expect(s.solids).toContainEqual(x);
    for (const x of own) {
      const b = bounds(x);
      expect(b.min.x >= HOTEL_LOT.x - 0.5 && b.max.x <= HOTEL_LOT.x + HOTEL_LOT.w + 0.5 && b.min.y >= HOTEL_LOT.y - 0.5 && b.max.y <= HOTEL_LOT.y + HOTEL_LOT.d + 0.5, `${x.kind} ${x.mat}`).toBe(true);
    }
    expect(s.hotel).toEqual(lit);
  });

  it("the sign stands at SIGN_SITE: the panel and every letter quad of RESUME_SIGN are in the city", () => {
    expect(s.solids).toContainEqual(SIGN_PANEL);
    const quads = new Set(s.accents.flatMap((a) => (a.kind === "poly" && a.color === "greenMid" ? [JSON.stringify(a.pts)] : [])));
    for (const q of RESUME_SIGN.glyphs.flatMap((g) => g.quads)) expect(quads.has(JSON.stringify(q))).toBe(true);
    const base = RESUME_SIGN.glyphs[0]!.plane.origin;
    expect(base.z).toBeCloseTo(SIGN_SITE.z, 9);
  });

  it("nothing of the tower is left: no officeDark prism 30 high, no concrete cylinder of radius 7", () => {
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "officeDark" && x.h === 30)).toEqual([]);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r === 7)).toEqual([]);
    expect(s).not.toHaveProperty("tower");
  });

  it("no solid in front of the sign rises above its bottom edge on screen", () => {
    for (const x of s.solids) {
      if (isHotelPiece(x)) continue;
      const b = bounds(x), sb = screenBounds(b);
      if (!isBehind(panel, b) || sb.maxX <= panelScreen.minX || sb.minX >= panelScreen.maxX) continue;
      expect(sb.minY, `${x.kind} ${x.mat} ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(bottomSy - 1e-6);
    }
  });

  // STATION_LAND projects to a parallelogram: its screen box over-reaches it by whole triangles (a bars roof north of the plaza, #472, falls
  // in the box and off the land), so the test compares the projected land with each solid's screen hull (screenHull, hullsOverlap)
  it("no Resume solid taller than 10 overlaps STATION_LAND on screen", () => {
    const land = screenHull({ min: v3(STATION_LAND.x0, STATION_LAND.y0, 0), max: v3(STATION_LAND.x1, STATION_LAND.y1, 0) });
    for (const x of s.solids) {
      const b = bounds(x);
      if (b.max.z <= 10) continue;
      expect(hullsOverlap(screenHull(b), land), `${x.kind} ${x.mat} ${JSON.stringify(b)}`).toBe(false);
    }
  });

  it.each(ZONE_SIZES)("%i×%i: zoneView('cv') shows the whole sign", (w, h) => {
    const v = zoneView("cv", w, h), b = signBox(RESUME_SIGN);
    expect(b.minX * v.scale + v.x).toBeGreaterThanOrEqual(0);
    expect(b.maxX * v.scale + v.x).toBeLessThanOrEqual(w);
    expect(b.minY * v.scale + v.y).toBeGreaterThanOrEqual(0);
    expect(b.maxY * v.scale + v.y).toBeLessThanOrEqual(h);
  });
});

describe("singular pieces back on named parcels (#477)", () => {
  const world = () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));
  const s = world();
  const at = (col: number, row: number) => s.placed.find((q) => q.placed.parcel?.cell.col === col && q.placed.parcel.cell.row === row && FIXED_PARCELS.some((f) => f.cell.col === col && f.cell.row === row))!;

  it("the water tower stands on the courtyard of (13, 291)", () => {
    const host = at(WATER_TOWER_CELL.col, WATER_TOWER_CELL.row);
    expect(host.placed.recipe).toBe("patioResidential");
    const court = host.piece.courtyard!;
    expect(court).toBeDefined();
    const tanks = s.solids.filter((x) => x.kind === "cylinder" && x.r === 2.2 && x.sides === 8);
    expect(tanks).toHaveLength(1);
    const t = tanks[0]!;
    if (t.kind !== "cylinder") throw new Error("unreachable");
    expect(t.at.x).toBeGreaterThanOrEqual(court.x);
    expect(t.at.x).toBeLessThanOrEqual(court.x + court.w);
    expect(t.at.y).toBeGreaterThanOrEqual(court.y);
    expect(t.at.y).toBeLessThanOrEqual(court.y + court.d);
    expect(t.at.z).toBeGreaterThanOrEqual(host.placed.lot.z);
  });

  it("the construction site stands on (43, 261)", () => {
    const q = at(43, 261);
    expect(q.placed.recipe).toBe("constructionSite");
    const r = q.placed.parcel!.rect;
    for (const x of q.piece.solids) {
      const b = bounds(x);
      expect(b.min.x >= r.x - 0.8 && b.max.x <= r.x + r.w + 0.8 && b.min.y >= r.y - 0.8 && b.max.y <= r.y + r.d + 0.8).toBe(true);
    }
  });

  it("the three civic pieces are bathed, and only their walls", () => {
    const civic = s.placed.filter((q) => q.placed.neighborhood === "civic");
    expect(civic.map((q) => q.placed.recipe).sort()).toEqual(["civicPalace", "library", "theatre"]);
    expect(s.lights.bathed.length).toBeGreaterThan(0);
    const walls = civic.flatMap((q) => q.piece.walls);
    for (const a of s.lights.bathed) {
      if (a.kind !== "poly") throw new Error("bathed accents are polys");
      const [p0, p1] = a.pts;
      expect(walls.some((w) => Math.hypot(w.pts[0]!.x + w.normal.x * 0.05 - p0!.x, w.pts[0]!.y + w.normal.y * 0.05 - p0!.y) < 1e-6 && Math.hypot(w.pts[1]!.x + w.normal.x * 0.05 - p1!.x, w.pts[1]!.y + w.normal.y * 0.05 - p1!.y) < 1e-6)).toBe(true);
    }
  });

  it("is deterministic with the singular pieces", () => {
    expect(fingerprint(world().solids)).toBe(fingerprint(s.solids));
    expect(JSON.stringify(world().placed.map((q) => [q.placed.recipe, q.placed.neighborhood, q.placed.lot]))).toBe(JSON.stringify(s.placed.map((q) => [q.placed.recipe, q.placed.neighborhood, q.placed.lot])));
  });
});

describe("the city owns the west (#479)", () => {
  const w = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));
  const telecomCell = { col: -107, row: 231 };

  it("city builds every parcel north of y 318 inside the view, west of x −54 included", () => {
    const placedCells = new Set(w.placed.flatMap((q) => (q.placed.parcel ? [`${q.placed.parcel.cell.col},${q.placed.parcel.cell.row}:${q.placed.parcel.rect.x},${q.placed.parcel.rect.y}`] : [])));
    expect(w.placed.some((q) => q.placed.parcel && q.placed.parcel.c.x < -54)).toBe(true);
    for (const p of parcels({ ...CITY_BOUNDS, x0: -Infinity }).filter((q) => q.c.y < 318)) {
      if (p.rect.x === HOTEL_LOT.x && p.rect.y === HOTEL_LOT.y) continue;
      expect(placedCells.has(`${p.cell.col},${p.cell.row}:${p.rect.x},${p.rect.y}`), `${p.cell.col},${p.cell.row}`).toBe(true);
    }
  });

  it("TELECOM sits on a moderno parcel", () => {
    const q = w.placed.find((x) => x.placed.parcel?.cell.col === telecomCell.col && x.placed.parcel.cell.row === telecomCell.row);
    expect(q).toBeDefined();
    expect(neighborhoodOfParcel(q!.placed.parcel!)).toBe("moderno");
    const r = q!.placed.parcel!.rect, inside = (x: Solid) => inRect(bounds(x), r);
    expect(w.solids.filter((x) => x.kind === "prism" && x.mat === "steel" && x.h === 20 && inside(x))).toHaveLength(1);
    expect(w.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h === 0.4 && inside(x))).toHaveLength(3);
  });

  it("the STATION_LAND rule also covers the west: west solids are in the scene and none taller than 10 overlaps it", () => {
    const land = screenHull({ min: v3(STATION_LAND.x0, STATION_LAND.y0, 0), max: v3(STATION_LAND.x1, STATION_LAND.y1, 0) });
    const west = w.solids.filter((x) => bounds(x).max.x < -54 && bounds(x).max.z > 10);
    expect(west.length).toBeGreaterThan(0);
    for (const x of west) expect(hullsOverlap(screenHull(bounds(x)), land), JSON.stringify(bounds(x))).toBe(false);
  });

  it("with opts.west = WORLD.x0 no Placed lies west of x −60 and no solid starts west of it", () => {
    const lab = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3), { west: WORLD.x0 });
    for (const q of lab.placed) if (q.placed.parcel) expect(q.placed.parcel.c.x).toBeGreaterThanOrEqual(WORLD.x0);
    for (const x of [...lab.solids, ...lab.ground]) expect(bounds(x).min.x, `${x.kind} ${x.mat}`).toBeGreaterThanOrEqual(WORLD.x0 - 1e-6);
  });
});
