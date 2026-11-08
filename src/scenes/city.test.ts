import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, type Solid } from "../iso/solids";
import { ESTUARY_Y0, QUAY_X, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import { AVENUE, BOULEVARD, DARSENA, BRIDGE, CITY_EDGE, COLLAPSED, FREIGHT_ROW, ROWS, CRATERS, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_RING, FALLEN_BLOCK, PROMENADE, PLAZA, TOWER, WEST_QUAY, blocks, estuaryEast, inBlock, inCrater } from "./city-grid";
import { PLINTH_H, TOWER_H, city, type CityScene } from "./city";
import { CAR } from "../kit/props";
import { FIXED, FOOTBRIDGE_LOT, MAX_BUILDING_H, WATER_TOWER_BLOCK, assign } from "../city/zoning";
import { zoneRng } from "./world";

const scene = (): CityScene => city(createRng(7), createRng(8), createRng(9));
const all = (s: CityScene): Solid[] => [...s.ground, ...s.solids];
const inRect = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, r: { x: number; y: number; w: number; d: number }) =>
  b.min.x >= r.x - 1e-6 && b.max.x <= r.x + r.w + 1e-6 && b.min.y >= r.y - 1e-6 && b.max.y <= r.y + r.d + 1e-6;
/** Strict interior of the plaza: a crosswalk that ends exactly on the edge (y = PLAZA.y) does not step on it. */
const inPlaza = (x: number, y: number) => x > PLAZA.x && x < PLAZA.x + PLAZA.w && y > PLAZA.y && y < PLAZA.y + PLAZA.d;
const DISTRICT = blocks().filter((b) => b.kind === "district" || b.kind === "site");
const inDistrict = (s: Solid) => DISTRICT.some((b) => inRect(bounds(s), b));
const inBlockXY = (x: number, y: number) => blocks().some((b) => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.d + 1);
/** The fixed blocks (landmarks): they can reach 24 above the plinth, with a finial. */
const FIXED_BLOCKS = blocks().filter((b) => b.kind !== "plaza" && FIXED.some((f) => f.x === b.x && f.y === b.y));
const inFixed = (s: Solid) => FIXED_BLOCKS.some((b) => inRect(bounds(s), b));
const inFootbridge = (x: number, y: number) => x >= FOOTBRIDGE_LOT.x && x <= FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w && y >= FOOTBRIDGE_LOT.y && y <= FOOTBRIDGE_LOT.y + FOOTBRIDGE_LOT.d;
/** The four pieces that can exceed 21: the tower prism, its cornice, the machine room and the mast. The cones and the vines at the base are not exempt. */
const isTowerPiece = (s: Solid) => {
  const b = bounds(s);
  return s.kind !== "cone" && b.min.x >= TOWER.x - 0.6 && b.max.x <= TOWER.x + TOWER.w + 0.6 && b.min.y >= TOWER.y - 0.6 && b.max.y <= TOWER.y + TOWER.d + 0.6;
};

// the south row in front of the tower: PLAZA.x - 6 .. PLAZA.x + PLAZA.w + 6, the band that the controller's ruling caps at 10
const ROW_SOUTH = ROWS[4], FRONT_X0 = PLAZA.x - 6, FRONT_X1 = PLAZA.x + PLAZA.w + 6;

const CITY_MATS: readonly Material[] = ["office", "officeDark", "glass", "asphalt", "paving", "plaza", "curtain", "stone", "copper", "leaf", "leafDark", "water", "steel", "rust", "plaster", "terracotta", "marble", "awning", "deck", "rail", "brick", "sheetTeal", "concrete", "hull", "whitewash"];

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
      if (s.mat === "steel" || s.mat === "rust") expect(["prism", "cylinder", "vault"]).toContain(s.kind); // only furniture, cars and the quay sheds
    }
    const mats = new Set(all(scene()).map((s) => s.mat));
    for (const m of ["plaster", "terracotta", "marble", "awning"] as const) expect(mats.has(m)).toBe(true);
  });

  it("there is one plinth per built block and the buildings with a facade fall in their block", () => {
    const s = scene();
    const plinths = s.solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.h === PLINTH_H && x.at.z === 0 && x.w === 24 && x.d === 18);
    expect(plinths.length).toBeGreaterThanOrEqual(45); // 40 old ones plus row 92 and the two new east blocks (#320), minus the recipes with their own plinth
    const buildings = s.solids.filter((x) => (x.kind === "prism" || x.kind === "poly" || x.kind === "cylinder") && x.facade !== undefined);
    expect(buildings.length).toBeGreaterThanOrEqual(90);
    for (const b of buildings) {
      if (isTowerPiece(b)) continue;
      if (b.kind === "prism" && b.mat === "paving" && b.at.z === -1) continue; // the promenade walls carry an arcade, they are not buildings
      expect(b.kind !== "prism" || b.h <= (inDistrict(b) || inFixed(b) ? 24 : MAX_BUILDING_H)).toBe(true);
      expect(blocks().some((blk) => inRect(bounds(b), blk))).toBe(true); // inside a block
    }
  });

  it("freight lots (#320): one 24 × 13 paving plinth each and nothing else on them but the level-crossing posts", () => {
    const s = scene(), lots = blocks().filter((b) => b.kind === "freight");
    const plinths = s.solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.h === PLINTH_H && x.at.z === 0 && x.w === 24 && x.d === FREIGHT_ROW.d);
    expect(plinths.map((x) => x.kind === "prism" && `${x.at.x},${x.at.y}`)).toEqual(lots.map((b) => `${b.x},${b.y}`));
    for (const x of s.solids) {
      const b = bounds(x), lot = lots.find((l) => inRect(b, l));
      if (!lot || plinths.includes(x)) continue;
      expect(x.kind === "prism" && x.mat === "steel" && x.w === 0.3 && x.d === 0.3, JSON.stringify(x).slice(0, 120)).toBe(true); // north post of a level crossing
    }
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
    expect(inRect(bounds(tower), PLAZA)).toBe(true);
    expect(s.tower.litWindows.length).toBe(8); // 4 columns × 2 visible walls
    expect(s.tower.litWindows.every((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
    expect(s.tower.antenna.z).toBeGreaterThan(TOWER_H + 5);
    expect(s.tower.paperWindow.x).toBeCloseTo(TOWER.x + TOWER.w, 6); // east wall
    for (const x of s.solids) if (!isTowerPiece(x)) expect(bounds(x).max.z).toBeLessThanOrEqual(inDistrict(x) || inFixed(x) ? 25 : 21); // the district and the landmarks reach 24 above the plinth, with a finial
  });

  it("in front of the tower no building exceeds 10 and nothing reaches 15 (the lit windows are painted on top of everything)", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (!(b.min.y >= ROW_SOUTH && b.min.y < DISTRICT_ROWS[0] && b.min.x >= FRONT_X0 && b.max.x <= FRONT_X1)) continue; // only the old row in front of the tower, not the district
      if (x.kind === "prism" && x.facade) expect(x.h).toBeLessThanOrEqual(10);
      expect(b.max.z).toBeLessThanOrEqual(15);
    }
  });

  it("the plaza has broken tiles and the devoured blocks have jungle over their ground", () => {
    const s = scene();
    const plaza = s.ground.filter((g) => g.kind === "ground" && g.mat === "plaza");
    expect(plaza).toHaveLength(1);
    const tris = plaza[0]!.kind === "ground" ? plaza[0]!.tris : [];
    expect(tris.length).toBe((PLAZA.w / 6) * (PLAZA.d / 6) * 2);
    expect(tris.some((t) => (t.toneOffset ?? 0) !== 0)).toBe(true);
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "leafDark").length).toBeGreaterThanOrEqual(3);
  });

  it("no cone steps on asphalt outside craters, blocks and the riverbank; the accents are amber, windows or neons with their Bleed", () => {
    const s = scene();
    for (const c of s.solids) {
      if (c.kind !== "cone" || (c.mat === "stone" && c.at.x >= BRIDGE.x0 && c.at.x <= BRIDGE.x1 && c.at.y >= BRIDGE.y0 && c.at.y <= BRIDGE.y1)) continue; // the finials of the bridge obelisks are stone, not trees
      // south of the district the east bank is jungle with no grid (there are no blocks on the east side anymore)
      const onCity = c.at.x >= CITY_EDGE.west && c.at.x < PROMENADE.x0 && c.at.y >= ESTUARY_Y0 + 12 && c.at.y < CITY_EDGE.south && !(c.at.x > QUAY_X && c.at.x < EAST_RING.x0) && !(c.at.x > EAST_RING.x0 && c.at.y >= DISTRICT_BANK_Y);
      if (onCity) expect(inBlock(c.at.x, c.at.y) || inCrater(c.at.x, c.at.y) || (c.at.y >= BOULEVARD.y0 && c.at.y <= BOULEVARD.y1)).toBe(true);
    }
    expect(s.accents.length).toBeGreaterThan(6);
    const NEON = ["magenta", "magentaBleed", "cyan", "cyanBleed"];
    expect(s.accents.every((a) => a.color.startsWith("amber") || a.color === "windowWarm" || a.color === "windowCool" || NEON.includes(a.color))).toBe(true);
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
    expect(boulevard.length).toBeGreaterThanOrEqual(8);
    expect(boulevard.every((x) => bounds(x).min.y >= BOULEVARD.y0 && bounds(x).max.y <= BOULEVARD.y1)).toBe(true);
    const lamps = s.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.r === 0.6); // street lamps (props.lamp), not the garlands
    expect(lamps.length).toBeGreaterThanOrEqual(20);
    for (const l of lamps) {
      if (l.kind !== "dot") continue;
      const onAvenue = l.at.y >= AVENUE.y0 - 3 && l.at.y <= AVENUE.y1 + 3, onPromenade = l.at.x >= PROMENADE.x0, onPlaza = inRect({ min: l.at, max: l.at }, PLAZA), onInlet = l.at.x >= DARSENA.x0 - 2 && l.at.x <= DARSENA.x1 + 2 && l.at.y >= DARSENA.y0 - 2 && l.at.y <= DARSENA.y1 + 2; // the two lamps of the inlet walls (#326)
      expect(onAvenue || onPromenade || onPlaza || onInlet || inFootbridge(l.at.x, l.at.y) || inBlockXY(l.at.x, l.at.y)).toBe(true); // the kit recipes bring their own lights (construction site, helipad, beacon, station lamps)
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
    const cars = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && (x.mat === "steel" || x.mat === "rust") && x.h === 1.2 && x.w !== 0.6); // not the fish market scale (#326)
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
    expect(rails.filter((g) => g.kind === "strip" && g.width === 0.5).map((g) => g.kind === "strip" && g.path[0]!.y).sort()).toEqual([131, 134]);
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

  it("the avenue reaches the new west edge and the promenade goes down to 326", () => {
    const s = scene();
    const carriageways = [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2];
    expect(s.ground.some((g) => g.kind === "strip" && g.mat === "paving" && g.width === 0.4 && g.path[0]!.x <= CITY_EDGE.west + 4 && carriageways.includes(g.path[0]!.y))).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "paving" && x.at.x === PROMENADE.x0 && x.at.y + x.d >= PROMENADE.y1)).toBe(true);
  });

  it("neon: ≥ 6 signs coplanar in y and a light over each street lamp of the promenade", () => {
    const worldCity = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)); // the real seed of the world
    expect(worldCity.neon.signs.length).toBeGreaterThanOrEqual(6);
    const c = scene();
    expect(c.neon.signs.length).toBeGreaterThanOrEqual(6);
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
      expect(piece.solids.length).toBeGreaterThan(0);
      expect(s.solids[solidOffset]).toBe(piece.solids[0]);
      expect(s.solids.slice(solidOffset, solidOffset + piece.solids.length)).toEqual(piece.solids);
    }
  });

  it("water tower in the courtyard of (12, 164) and stone footbridge over the estuary", () => {
    const s = scene();
    const host = s.placed.find((p) => p.placed.block.x === WATER_TOWER_BLOCK.x && p.placed.block.y === WATER_TOWER_BLOCK.y)!;
    expect(host.placed.recipe).toBe("patioResidential");
    const court = host.piece.courtyard!;
    const tank = s.solids.find((x) => x.kind === "dome" && x.mat === "copper" && x.r === 2.2);
    expect(tank).toBeDefined();
    if (tank?.kind !== "dome") throw new Error("no dome of the water tower");
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
