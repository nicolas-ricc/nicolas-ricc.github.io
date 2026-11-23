import { readFileSync } from "node:fs";
import type { Accent } from "../iso/accent";
import { hides, screenHull } from "../iso/depth";
import { lightBox, type FixedLight } from "../city/lights";
import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, type Solid } from "../iso/solids";
import { ESTUARY_Y0, QUAY_X, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import { AVENUE, BOULEVARD, DARSENA, BRIDGE, CITY_EDGE, COLLAPSED, FREIGHT_ROW, ROWS, CRATERS, DISTRICT_BANK_Y, EAST_RING, FALLEN_BLOCK, PROMENADE, TOWER, WEST_QUAY, blocks, estuaryEast, inBlock, inCrater } from "./city-grid";
import { PLINTH_H, TOWER_H, city, type CityScene } from "./city";
import { CAR } from "../kit/props";
import { FIXED, FOOTBRIDGE_LOT, MAX_BUILDING_H, assign, builtParcels, tooSmall, neighborhoodOfParcel } from "../city/zoning";
import { zoneRng } from "./world";
import { MARKET_SCALE } from "../city/harbor";
import { fingerprint } from "../iso/fingerprint";
import { BRIDGE_LANDING, CITY_BOUNDS, HOTEL_LOT, PLAZA_MAYOR, TOWER_ISLAND, inCrossingPlaza, inParcel, inPlazaMayor, onAxis, parcels } from "./city-plan";
import { CROWN_SITE, towerCrown } from "./sign-crown";

const scene = (): CityScene => city(createRng(7), createRng(8), createRng(9));
const all = (s: CityScene): Solid[] => [...s.ground, ...s.solids];
const inRect = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, r: { x: number; y: number; w: number; d: number }) =>
  b.min.x >= r.x - 1e-6 && b.max.x <= r.x + r.w + 1e-6 && b.min.y >= r.y - 1e-6 && b.max.y <= r.y + r.d + 1e-6;
/** Strict interior of the Plaza Mayor: a crosswalk that ends exactly on the edge does not step on it. */
const inPlaza = (x: number, y: number) => x > PLAZA_MAYOR.x && x < PLAZA_MAYOR.x + PLAZA_MAYOR.w && y > PLAZA_MAYOR.y && y < PLAZA_MAYOR.y + PLAZA_MAYOR.d;
/** The parcels of the modern belt (the landmark cap): none inside CITY_BOUNDS today, the modern area lies west of x -54. */
const DISTRICT = builtParcels().filter((p) => neighborhoodOfParcel(p) === "district").map((p) => p.rect);
const inDistrict = (s: Solid) => DISTRICT.some((b) => inRect(bounds(s), b));
const inBlockXY = (x: number, y: number) => blocks().some((b) => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.d + 1);
/** The fixed blocks (landmarks): they can reach 24 above the plinth, with a finial. */
const FIXED_BLOCKS = blocks().filter((b) => FIXED.some((f) => f.x === b.x && f.y === b.y));
const inFixed = (s: Solid) => FIXED_BLOCKS.some((b) => inRect(bounds(s), b));
const inFootbridge = (x: number, y: number) => x >= FOOTBRIDGE_LOT.x && x <= FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w && y >= FOOTBRIDGE_LOT.y && y <= FOOTBRIDGE_LOT.y + FOOTBRIDGE_LOT.d;
/** The Resume crown on the tower roof (#391), built alone: its solids are matched by value in the city. */
const CROWN: Solid[] = [], CROWN_ACCENTS: Accent[] = [];
towerCrown(CROWN, CROWN_ACCENTS, CROWN_SITE);
const CROWN_KEYS = new Set(CROWN.map((s) => JSON.stringify(s)));
const isCrownPiece = (s: Solid) => CROWN_KEYS.has(JSON.stringify(s));
/** The pieces that can exceed 21: the tower prism, its cornice, the machine room and the Resume crown (#391). The cones and the vines at the base are not exempt. */
const isTowerPiece = (s: Solid) => {
  const b = bounds(s);
  return isCrownPiece(s) || (s.kind !== "cone" && b.min.x >= TOWER.x - 0.6 && b.max.x <= TOWER.x + TOWER.w + 0.6 && b.min.y >= TOWER.y - 0.6 && b.max.y <= TOWER.y + TOWER.d + 0.6);
};

const CITY_MATS: readonly Material[] = ["office", "officeDark", "glass", "asphalt", "paving", "plaza", "curtain", "stone", "copper", "leaf", "leafDark", "water", "steel", "rust", "plaster", "terracotta", "marble", "awning", "deck", "rail",
  "brick", "sheetTeal", "concrete", "hull", "whitewash", "rock", // dock inlet (#326)
  // warehouses and freight yard (#325): reconversion kit, containers and the dock
  "sheetGreen", "boxRust", "boxBlue", "boxGrey", "boxGreen", "boxOrange"];

describe("city", () => {
  it("is deterministic per seed", () => {
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).toBe(JSON.stringify(city(createRng(7), createRng(8), createRng(9))));
    expect(JSON.stringify(city(createRng(7), createRng(8), createRng(9)))).not.toBe(JSON.stringify(city(createRng(8), createRng(8), createRng(9))));
  });

  it("everything falls in the Resume zone except the cones, and uses only city materials", () => {
    for (const s of all(scene())) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 3); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X + 1); // the district grows up to the west edge of the world
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
    const rects = parcels(CITY_BOUNDS).map((p) => p.rect);
    for (const b of buildings) {
      if (isTowerPiece(b)) continue;
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

  it("the tower is 30 tall over the plaza, has an 8×4 facade with floor 5 lit, and nothing else exceeds 21", () => {
    const s = scene();
    const tower = s.solids.find((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.h === TOWER_H)!;
    expect(tower).toBeDefined();
    expect(tower.mat).toBe("officeDark");
    expect(tower.facade).toMatchObject({ floors: 8, cols: 4, litFloor: 5, base: "portico" });
    expect(inRect(bounds(tower), TOWER_ISLAND)).toBe(true); // the tower stands on its island
    expect(s.tower.litWindows.length).toBe(8); // 4 columns × 2 visible walls
    expect(s.tower.litWindows.every((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
    expect(s.tower).not.toHaveProperty("antenna"); // the Resume crown tops the tower (#391)
    expect(s.tower.paperWindow.x).toBeCloseTo(TOWER.x + TOWER.w, 6); // east wall
    for (const x of s.solids) if (!isTowerPiece(x)) expect(bounds(x).max.z).toBeLessThanOrEqual(inDistrict(x) || inFixed(x) ? 25 : 21); // the district and the landmarks reach 24 above the plinth, with a finial
    expect(s.solids.filter(isCrownPiece)).toHaveLength(CROWN.length); // the crown exemption matches the crown and nothing else
  });

  it("city() builds the Resume crown at CROWN_SITE: its solids and accents are towerCrown's (#391)", () => {
    const s = scene();
    for (const x of CROWN) expect(s.solids).toContainEqual(x);
    for (const a of CROWN_ACCENTS) expect(s.accents).toContainEqual(a);
  });

  // the old "in front of the tower no building exceeds 10" pinned the row south of the old plaza (y 242): that row is now Plaza Mayor tiles and the zoning's parcels (#472)

  it("the plaza has broken tiles and the devoured blocks have jungle over their ground", () => {
    const s = scene();
    const plaza = s.ground.filter((g) => g.kind === "ground" && g.mat === "plaza");
    expect(plaza).toHaveLength(3); // the Plaza Mayor minus the island and the landing: three strips
    const tris = plaza.flatMap((g) => (g.kind === "ground" ? g.tris : []));
    expect(tris.length).toBe(2 * (9 * 1 + 8 * 3 + 9 * 10)); // 6 u tiles: 54 × 2, 48 × 16 and 54 × 56
    expect(tris.some((t) => (t.toneOffset ?? 0) !== 0)).toBe(true);
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "leafDark").length).toBeGreaterThanOrEqual(3);
  });

  it("no cone steps on asphalt outside craters, blocks and the riverbank; the accents are amber, windows or neons with their Bleed", () => {
    const s = scene();
    for (const c of s.solids) {
      if (c.kind !== "cone" || (c.mat === "stone" && c.at.x >= BRIDGE.x0 && c.at.x <= BRIDGE.x1 && c.at.y >= BRIDGE.y0 && c.at.y <= BRIDGE.y1)) continue; // the finials of the bridge obelisks are stone, not trees
      // south of the district the east bank is jungle with no grid (there are no blocks on the east side anymore)
      const onCity = c.at.x >= CITY_EDGE.west && c.at.x < PROMENADE.x0 && c.at.y >= ESTUARY_Y0 + 12 && c.at.y < CITY_EDGE.south && !(c.at.x > QUAY_X && c.at.x < EAST_RING.x0) && !(c.at.x > EAST_RING.x0 && c.at.y >= DISTRICT_BANK_Y);
      if (onCity) expect(inBlock(c.at.x, c.at.y) || inParcel(c.at.x, c.at.y) || (c.at.x >= TOWER.x - 4.5 && c.at.x <= TOWER.x + TOWER.w + 4.5 && c.at.y >= TOWER.y - 4.5 && c.at.y <= TOWER.y + TOWER.d + 4.5) /* the tower's corner cones */ || inCrater(c.at.x, c.at.y) || (c.at.y >= BOULEVARD.y0 && c.at.y <= BOULEVARD.y1), `cone ${c.at.x},${c.at.y} ${c.mat}`).toBe(true);
    }
    expect(s.accents.length).toBeGreaterThan(6);
    const NEON = ["magenta", "magentaBleed", "cyan", "cyanBleed"];
    // greenMid: RESUME letters and helipad edge lights of the crown (#391)
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

  it("avenue: boulevard, lanes, crosswalks and traffic lights; street lamps only on avenue, bridge, plaza and promenade", () => {
    const s = scene();
    const strips = s.ground.filter((g) => g.kind === "strip" && g.mat !== "rail"); // the main line (#319) is counted apart
    expect(strips.length).toBeGreaterThan(60);
    expect(strips.length).toBeLessThanOrEqual(150);
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
    // the two light puddles do fall entirely inside the plaza (alpha 0.25: the clock and the district sign are also amberBleed, with another alpha; the amber bar neons also leave a puddle, in front of their wall)
    const neonAccents = new Set(s.lights.neons.flatMap((n) => n.accents));
    const spills = s.accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.25 && !neonAccents.has(a));
    expect(spills.length).toBeGreaterThanOrEqual(2);
    for (const sp of spills) if (sp.kind === "poly") for (const p of sp.pts) expect(inPlaza(p.x, p.y)).toBe(true);
    const boulevard = s.solids.filter((x) => x.kind === "prism" && x.mat === "leafDark" && x.at.z === 0); // not the green terrace of a glass tower of the district
    expect(boulevard.length).toBeGreaterThanOrEqual(2); // #472: only the east stretch of the avenue keeps its boulevard (the two east blocks)
    expect(boulevard.every((x) => bounds(x).min.y >= BOULEVARD.y0 && bounds(x).max.y <= BOULEVARD.y1)).toBe(true);
    const lamps = s.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.r === 0.6); // street lamps (props.lamp), not the garlands
    expect(lamps.length).toBeGreaterThanOrEqual(20);
    for (const l of lamps) {
      if (l.kind !== "dot") continue;
      const onAvenue = l.at.y >= AVENUE.y0 - 3 && l.at.y <= AVENUE.y1 + 3, onPromenade = l.at.x >= PROMENADE.x0, onPlaza = inRect({ min: l.at, max: l.at }, PLAZA_MAYOR), onInlet = l.at.x >= DARSENA.x0 - 2 && l.at.x <= DARSENA.x1 + 2 && l.at.y >= DARSENA.y0 - 2 && l.at.y <= DARSENA.y1 + 2; // the two lamps of the inlet walls (#326)
      const onYard = l.at.y === 150.3 && [-39.7, 0.3, 40.3, 80.3].includes(l.at.x); // the four lamps of the freight yard (#325)
      expect(onAvenue || onPromenade || onPlaza || onInlet || onYard || inFootbridge(l.at.x, l.at.y) || inBlockXY(l.at.x, l.at.y)).toBe(true); // the kit recipes bring their own lights (construction site, helipad, beacon, station lamps)
    }
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

  it("jungle: east bank and craters, more than 60 cones (the west and south edges belong to the tech district)", () => {
    const s = scene();
    const cones = s.solids.filter((x) => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark"));
    expect(cones.length).toBeGreaterThan(60);
    for (const c of cones) if (c.kind === "cone" && c.at.y < ROWS[1]! && c.at.x < QUAY_X) expect(inBlock(c.at.x, c.at.y), `${c.at.x},${c.at.y}`).toBe(true); // no seam belt since #319: in the new strip only the courtyard trees of its blocks (#320)
    expect(cones.some((c) => c.kind === "cone" && c.at.x < CITY_EDGE.west)).toBe(false);        // west edge: asphalt of the tech district
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
    // no district parcel in CITY_BOUNDS since #472 (the modern belt is west of −54, tech's until #479): the district signs come back with it
    expect(c.neon.signs).toHaveLength(0);
    expect(worldCity.neon.signs).toHaveLength(0);
    for (const s of [...c.neon.signs, ...worldCity.neon.signs]) { // kept for when they return
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
  // That lifting equals running the recipe PLINTH_H higher is checked per recipe in piece.test.
  it("pieces without ground are identical to the pinned plinth pieces (860a582; re-recorded at #143, #56, #152 and #165)", () => {
    const MAIN = ["5e1121c0", "d8dfd64c", "a1841b17", "9635b05d", "d0ae663d"];
    for (let s = 1; s <= 5; s++) {
      const c = city(createRng(s), createRng(s + 1), createRng(s + 2));
      const plain = c.placed.filter((q) => q.piece.ground.length === 0).map((q) => q.piece);
      expect(fingerprint(plain as unknown as Solid[]), `seed ${s}`).toBe(MAIN[s - 1]);
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

  it("tower puddles, fountain and plaza lamps stay", () => {
    const inPlazaRect = (a: Accent) => a.kind === "poly" && a.pts.every((q) => q.x >= PLAZA_MAYOR.x && q.x <= PLAZA_MAYOR.x + PLAZA_MAYOR.w && q.y >= PLAZA_MAYOR.y && q.y <= PLAZA_MAYOR.y + PLAZA_MAYOR.d);
    expect(s.accents.filter((a) => inPlazaRect(a) && a.color === "amberBleed" && a.kind === "poly" && a.alpha === 0.25)).toHaveLength(6);
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
  const entersRect = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, r: { x: number; y: number; w: number; d: number }) =>
    b.min.x < r.x + r.w - 1e-6 && b.max.x > r.x + 1e-6 && b.min.y < r.y + r.d - 1e-6 && b.max.y > r.y + 1e-6;
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
    // nothing stands on the lot itself (the crown's beams overhang it at z 30, and the tower's corner cone grazes its north edge)
    for (const x of s.solids) if (!isTowerPiece(x) && x !== plinths.find((p) => samePoly(p.footprint, hotel.poly))) {
      expect(within(bounds(x), HOTEL_LOT, 0), `${x.kind} ${x.mat} on the hotel lot`).toBe(false);
    }
  });

  it("sliver parcels (lot side < 7, R5) keep their plinth and build nothing; there are 8 in the world seed", () => {
    // measured at #472: cells (−17,171) ×2, (13,171), (43,171), (103,201), (43,291), (73,291), (103,291); #476 brings polygon lots for them
    const world = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3));
    const bare = world.placed.filter((pp) => pp.placed.parcel && tooSmall(pp.placed.lot));
    expect(bare).toHaveLength(8);
    for (const pp of bare) {
      expect(pp.piece.solids).toEqual([]);
      expect(world.solids.filter((x) => x.kind === "poly" && x.mat === "paving" && x.h === PLINTH_H && samePoly(x.footprint, pp.placed.parcel!.poly))).toHaveLength(1);
    }
  });

  it("no solid of a parcel piece leaves rect ± 0.8", () => {
    for (const pp of s.placed) {
      const parcel = pp.placed.parcel;
      if (!parcel) continue;
      for (const x of [...pp.piece.solids, ...pp.piece.ground]) expect(within(bounds(x), parcel.rect, 0.8), `${parcel.cell.col},${parcel.cell.row} ${pp.placed.recipe} ${x.kind}`).toBe(true);
    }
  });

  it("no solid but the tower's and the crown's enters TOWER_ISLAND", () => {
    const towerOwn = (x: Solid) => isTowerPiece(x) || (x.kind === "cone" && x.mat === "leaf" && within(bounds(x), TOWER, 4.5)) || (x.mat === "leaf" && within(bounds(x), TOWER, 0.7));
    // R3: the HOTEL_LOT plinth overlaps TOWER_ISLAND by a 7 u² strip (x 120..127, y 234..235); both rectangles are literal in the issue and the island is temporary until #474
    const hotelPlinth = (x: Solid) => x.kind === "poly" && x.mat === "paving" && x.h === PLINTH_H && x.z === 0 && samePoly(x.footprint, [{ x: HOTEL_LOT.x, y: HOTEL_LOT.y }, { x: HOTEL_LOT.x + HOTEL_LOT.w, y: HOTEL_LOT.y }, { x: HOTEL_LOT.x + HOTEL_LOT.w, y: HOTEL_LOT.y + HOTEL_LOT.d }, { x: HOTEL_LOT.x, y: HOTEL_LOT.y + HOTEL_LOT.d }]);
    for (const x of [...s.solids, ...s.ground]) {
      if (towerOwn(x) || hotelPlinth(x)) continue;
      if (x.kind === "ground") { for (const t of x.tris) { const cx = (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, cy = (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3; expect(inR(TOWER_ISLAND, cx, cy), `${x.mat} tile in the island`).toBe(false); } continue; }
      if (x.kind === "strip") { for (const p of x.path) expect(inR(TOWER_ISLAND, p.x, p.y) && p.x > TOWER_ISLAND.x && p.y > TOWER_ISLAND.y, "strip in the island").toBe(false); continue; }
      expect(entersRect(bounds(x), TOWER_ISLAND), `${x.kind} ${x.mat} in the island`).toBe(false);
    }
  });

  it("the tower and the crown stay as they were: the tower prism on TOWER, towerCrown at CROWN_SITE", () => {
    const tower = s.solids.find((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.h === TOWER_H)!;
    expect({ x: tower.at.x, y: tower.at.y, w: tower.w, d: tower.d }).toEqual({ x: TOWER.x, y: TOWER.y, w: TOWER.w, d: TOWER.d });
    for (const x of CROWN) expect(s.solids).toContainEqual(x);
    for (const a of CROWN_ACCENTS) expect(s.accents).toContainEqual(a);
  });

  it("the plaza tiles step on neither TOWER_ISLAND nor BRIDGE_LANDING, and the landing is paving", () => {
    const tris = s.ground.flatMap((g) => (g.kind === "ground" && g.mat === "plaza" ? g.tris : []));
    expect(tris.length).toBeGreaterThan(0);
    let area = 0;
    for (const t of tris) {
      const [a, b, c] = t.pts, cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
      expect(inR(PLAZA_MAYOR, cx, cy)).toBe(true);
      expect(inR(TOWER_ISLAND, cx, cy)).toBe(false);
      expect(inR(BRIDGE_LANDING, cx, cy)).toBe(false);
      area += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    }
    // 54 × 85, minus the landing (54 × 10), the island inside the plaza (6 × 16) and the 1 u curb strip north of the landing
    expect(area).toBeCloseTo(54 * 85 - 54 * 10 - 6 * 16 - 54, 6);
    const landing = s.ground.flatMap((g) => (g.kind === "ground" && g.mat === "paving" ? g.tris : [])).filter((t) => inR(BRIDGE_LANDING, (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3));
    expect(landing.length).toBeGreaterThan(0);
  });

  it("no car falls on an axis band, a plaza, a crater, the hotel lot, the island, a parcel nor on another car", () => {
    const cars = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && (x.mat === "steel" || x.mat === "rust") && x.h === 1.2 && x.w === CAR.w && x.d === CAR.d);
    expect(cars.length).toBeGreaterThanOrEqual(20);
    for (const c of cars) {
      const corners = [[c.at.x, c.at.y], [c.at.x + c.w, c.at.y], [c.at.x + c.w, c.at.y + c.d], [c.at.x, c.at.y + c.d]] as const;
      const mx = c.at.x + c.w / 2, my = c.at.y + c.d / 2, tag = `car ${c.at.x},${c.at.y}`;
      for (const [x, y] of corners) {
        expect(onAxis(x, y), `${tag} on an axis`).toBe(false);
        expect(inPlazaMayor(x, y) || inCrossingPlaza(x, y), `${tag} on a plaza`).toBe(false);
        expect(inR(HOTEL_LOT, x, y), `${tag} on the hotel lot`).toBe(false);
        expect(inR(TOWER_ISLAND, x, y), `${tag} on the island`).toBe(false);
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
