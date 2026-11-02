import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { buildRenderList } from "../iso/render-list";
import { overlaps, screenBounds, sortByDepth } from "../iso/depth";
import { bounds, isFlat, tessellateAll, type Bounds, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { BAYS, boilerHouse, gableEnd, inclineBelt, metalStacks, HALL, hallBody, STAIR_TOWER, stairTower } from "./boiler-house";
import { WATER_TOWER, maltings, waterTower } from "./maltings";
import { PLANT_SHIFT } from "./plant-frame";
import { COOLING, MALT, PLANT, RAIL_YARD_X, STACKS, STACK_BASE_H, chimney, factory, type FactoryScene, type Stack } from "./factory";
import { towerCrane } from "./pieces";
import { FIREWALL, PHASES_Y, SUBSTATION, SUBSTATION_SHIFT, TRANSFORMERS_Y, currentTransformer, disconnector, droppers, powerTransformer, substation } from "./substation";
import { fingerprint, r6 } from "../iso/fingerprint";
import { translate } from "../iso/translate";
import { EXCAVATOR, excavator, excavatorBox, excavatorWheel, local } from "./excavator";
import { terrainAt } from "./terrain";

const scene = (): FactoryScene => factory(createRng(7));
const PORTFOLIO_MATS: readonly Material[] = ["slab", "concrete", "rust", "steel", "road", "rail", "sand", "brick", "leaf", "leafDark", "whitewash", "glass", "office", "signal", "stockbrick", "safety"];
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 4) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1)) || s.kind === "beam"; // chimneys, masts, beams and railings
const tallOk = (s: Solid) => bounds(s).max.z <= 26 || slender(s);
const build = (f: (out: Solid[]) => void): Solid[] => { const out: Solid[] = []; f(out); return out; };

/** Boxes to compare neighbors: a diagonal beam is split into 16 sections (its whole box covers a lot of air). */
function slices(s: Solid): Bounds[] {
  if (s.kind !== "beam") return [bounds(s)];
  const at = (t: number) => ({ x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t, z: s.from.z + (s.to.z - s.from.z) * t });
  return Array.from({ length: 16 }, (_, i) => bounds({ ...s, from: at(i / 16), to: at((i + 1) / 16) }));
}
const boxApart = (a: Bounds, b: Bounds): boolean =>
  a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.y <= b.min.y || b.max.y <= a.min.y || a.max.z <= b.min.z || b.max.z <= a.min.z;
/** Separated in x, in y or in z (contact counts), section by section. */
const apartSliced = (a: Solid, b: Solid): boolean => slices(a).every((p) => slices(b).every((q) => boxApart(p, q)));
const expectApart = (as: readonly Solid[], bs: readonly Solid[]) => {
  expect(as.length).toBeGreaterThan(0); expect(bs.length).toBeGreaterThan(0);
  for (const a of as) for (const b of bs) expect(apartSliced(a, b), `${JSON.stringify(a).slice(0, 90)} × ${JSON.stringify(b).slice(0, 90)}`).toBe(true);
};
const isTruck = (x: Solid) => x.kind === "prism" && x.d === 2.4 && ((x.w === 6 && x.h === 2.8) || (x.w === 2 && x.h === 2.2));
const PALLET_Y = PLANT.y + PLANT.d + 13; // row of pallets: 13 u south of the plant's south wall
const isPallet = (x: Solid): x is Solid & { kind: "prism" } => x.kind === "prism" && x.mat === "steel" && x.w === 3 && x.d === 2 && x.at.y === PALLET_Y;
const isLamp = (x: Solid): x is Solid & { kind: "prism" } => x.kind === "prism" && x.mat === "steel" && x.w === 0.6 && x.d === 0.6 && x.h === 5;
const crane = build((out) => towerCrane(out, [], { at: { x: 60, y: -12 }, mastH: 20, jibLen: 30, dir: "e", light: "cyan" }));

describe("factory", () => {
  it("is deterministic and brings more than 90 raised solids inside Portfolio", () => {
    expect(JSON.stringify(factory(createRng(7)))).toBe(JSON.stringify(factory(createRng(7))));
    const s = scene();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeGreaterThan(90); // the belt's jungle discards the cones that would cover the west tracks
    for (const x of [...s.ground, ...s.solids, ...s.excavator]) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 1); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1); expect(b.max.y).toBeLessThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
      expect(PORTFOLIO_MATS).toContain(x.mat);
    }
  });

  it("nothing rests on water and everything above z 26 is slender (cylinder r ≤ 4, thin prism or beam)", () => {
    const sc = scene();
    for (const x of [...sc.solids, ...sc.excavator]) {
      const b = bounds(x);
      if (x.kind !== "cone") expect(terrainAt(b.min.x, b.min.y)).not.toBe("water");
      expect(tallOk(x)).toBe(true);
    }
  });

  it("the height rule rejects a wide solid above z 26 and accepts beams and thin cylinders", () => {
    const at = { x: 0, y: 0, z: 0 };
    expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 27, mat: "brick" })).toBe(false);
    expect(tallOk({ kind: "cylinder", at, r: 4.5, h: 27, mat: "brick" })).toBe(false);
    expect(tallOk({ kind: "cylinder", at, r: 4, h: 30, mat: "brick" })).toBe(true);
    expect(tallOk({ kind: "beam", from: at, to: { x: 0, y: 0, z: 30 }, w: 1, h: 1, mat: "steel" })).toBe(true);
    expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 26, mat: "brick" })).toBe(true);
    expect(tallOk({ kind: "prism", at, w: 3, d: 3, h: 30, mat: "steel" })).toBe(true);
    expect(tallOk({ kind: "prism", at: { x: 0, y: 0, z: 27 }, w: 30, d: 1, h: 1, mat: "steel" })).toBe(true);
  });

  it("the plant: five-story 24 × 30 × 18 maltings, water tower and hall of two stacked brick prisms, no sawtooth roofs; three chimneys without a rust band, cooling tower and crane", () => {
    const s = scene();
    expect(MALT).toEqual({ x: 5, y: 44, w: 24, d: 30, h: 18 });
    expect(PLANT).toEqual({ x: MALT.x, y: MALT.y, w: MALT.w + HALL.w, d: 30, h: 14 }); // maltings + hall
    expect(PLANT).toEqual({ x: 5, y: 44, w: 87, d: 30, h: 14 });
    expect(PLANT.x).toBe(20 + PLANT_SHIFT.x); expect(PLANT.y).toBe(-46 + PLANT_SHIFT.y);
    expect(PLANT.w).toBe(87);
    expect(PLANT.x + PLANT.w).toBe(HALL.x + HALL.w); // the gate sits against the gable end
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === MALT.x && x.at.y === MALT.y && x.w === 24 && x.d === 30 && x.h === 18 && x.facade?.floors === 5)).toHaveLength(1);
    for (const x of [...build(maltings), ...build(waterTower)]) expect(s.solids).toContainEqual(x);
    expect(s.solids.filter((x) => x.kind === "ramp" && x.mat === "steel" && x.w === 6 && x.at.z === 18)).toHaveLength(4); // pitches of the maltings
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === HALL.x && x.at.y === HALL.y && x.w === HALL.w && x.d === HALL.d && x.h === 7)).toHaveLength(2);
    expect(s.solids.filter((x) => x.kind === "ramp" && x.mat === "brick")).toHaveLength(0);
    for (const x of build(boilerHouse)) expect(s.solids).toContainEqual(x);
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "brick");
    expect(stacks).toHaveLength(21); // 7 per chimney: stepped base, shaft and crown
    expect(s.stacks).toHaveLength(3);
    STACKS.forEach((st, i) => expect(s.stacks[i]).toEqual({ x: st.x, y: st.y, z: STACK_BASE_H + st.h }));
    expect(s.stacks).toEqual([{ x: 58, y: 32, z: 25 }, { x: 72, y: 26, z: 29 }, { x: 86, y: 32, z: 27 }]); // mouths behind the hall's new spot (#245)
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "rust" && x.r > 1)).toBe(false); // the old rust band is gone (the metal chimneys and the hall's tubes are thin)
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r >= 7)).toHaveLength(4); // cooling tower
    expect(s.solids.some((x) => x.kind === "prism" && x.h === 20 && x.w === 1.2)).toBe(true); // crane mast
  });

  it("the east gate goes on the gable end: x 91.8..92.3, y 67..73", () => {
    const gates = scene().solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && x.h === 8);
    expect(gates).toHaveLength(1);
    const b = bounds(gates[0]!);
    expect(b.min.x).toBeCloseTo(PLANT.x + PLANT.w - 0.2, 9); expect(b.max.x).toBeCloseTo(PLANT.x + PLANT.w + 0.3, 9);
    expect(b.min.x).toBeCloseTo(91.8, 9); expect(b.max.x).toBeCloseTo(92.3, 9);
    expect(b.min.y).toBeCloseTo(PLANT.y + 23, 9); expect(b.max.y).toBeCloseTo(PLANT.y + 29, 9);
    expect(b.min.y).toBeCloseTo(67, 9); expect(b.max.y).toBeCloseTo(73, 9); expect(b.min.z).toBe(0); expect(b.max.z).toBe(8);
  });

  it("no solid of the hall exceeds z 20 except the metal chimneys and their guys (≤ 22.6)", () => {
    const stacks = build(metalStacks);
    for (const x of stacks) expect(bounds(x).max.z).toBeLessThanOrEqual(22.6 + 1e-9);
    for (const x of [...build(hallBody), ...build(gableEnd), ...build(stairTower), ...build(inclineBelt)]) expect(bounds(x).max.z).toBeLessThanOrEqual(20);
  });

  it("the metal chimneys and their guys stay inside the hall footprint in plan", () => {
    for (const x of build(metalStacks)) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(HALL.x); expect(b.max.x).toBeLessThanOrEqual(HALL.x + HALL.w);
      expect(b.min.y).toBeGreaterThanOrEqual(HALL.y); expect(b.max.y).toBeLessThanOrEqual(HALL.y + HALL.d);
    }
  });

  it("the stair tower touches no chimney", () => {
    const tower = build(stairTower).flatMap(slices), pieces = STACKS.flatMap((st) => one(st).out);
    expect(tower.length).toBeGreaterThan(0); expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.filter((p) => slices(p).some((a) => tower.some((b) => !boxApart(a, b)))).map((p) => JSON.stringify(p).slice(0, 90))).toEqual([]); // precomputed sections: expectApart takes 1.4 s
  });

  it("the inclined belt and its hopper touch no trucks, pallets or lamps", () => {
    const s = scene();
    expect(s.solids.filter(isTruck)).toHaveLength(6);
    expect(s.solids.filter(isPallet)).toHaveLength(6);
    expect(s.solids.filter(isLamp)).toHaveLength(7);
    expectApart(build(inclineBelt), [...s.solids.filter(isTruck), ...s.solids.filter(isPallet), ...s.solids.filter(isLamp)]);
  });

  it("the tower crane and the siding stay: the crane at (60, −12), far from the plant", () => {
    const s = scene();
    for (const c of crane) expect(s.solids).toContainEqual(c);
    for (const c of crane) expect(bounds(c).max.y).toBeLessThan(PLANT.y);
  });

  it("the plinth touches no trucks, pallets or lamps", () => {
    const s = scene();
    const plinth = build(hallBody).filter((x) => (x.kind === "prism" && x.mat === "whitewash" && x.h === 3.5) || (x.kind === "cylinder" && x.r === 0.3 && x.h === 0.8));
    expect(plinth).toHaveLength(2 * BAYS + 1);
    expectApart(plinth, [...s.solids.filter(isTruck), ...s.solids.filter(isPallet), ...s.solids.filter(isLamp)]);
  });

  it("the pilaster brackets do not touch the south trim of the eave", () => {
    const body = build(hallBody);
    expectApart(body.filter((x) => x.kind === "beam" && x.w === 0.3), body.filter((x) => x.kind === "prism" && x.mat === "whitewash" && Math.abs(x.at.y - (HALL.y + HALL.d + 0.6)) < 1e-9));
  });

  it("in the scene, the tall wall is painted before each section of the north and south pitch (no cycles that cut those relations)", () => {
    const near = scene().solids.filter((x) => { const b = bounds(x); return b.max.x >= PLANT.x - 3 && b.min.x <= STAIR_TOWER.x1 + 0.4 && b.max.y >= PLANT.y - 3 && b.min.y <= PLANT.y + PLANT.d + 2; });
    const order = sortByDepth(near);
    const wall = order.findIndex((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === HALL.x && x.at.z === 7);
    const roof = order.flatMap((x, i) => (x.kind === "ramp" && x.mat === "steel" && x.at.x >= HALL.x ? [i] : []));
    expect(roof).toHaveLength(6);
    for (const i of roof) expect(i).toBeGreaterThan(wall);
  });

  it("the water tower, north of the maltings (y < MALT.y), touches no maltings, cooling tower or chimneys", () => {
    const s = scene(), tank = build(waterTower);
    expect(tank.some((x) => x.kind === "cylinder" && x.at.x === WATER_TOWER.x && x.at.y === WATER_TOWER.y)).toBe(true);
    for (const x of tank) expect(s.solids).toContainEqual(x);
    for (const x of tank) expect(bounds(x).max.y).toBeLessThan(MALT.y);
    for (const x of tank) for (const st of STACKS) expect(bounds(x).max.x).toBeLessThan(st.x - 3.5); // west of the pedestals
    const near = [...build(maltings), ...coolingTower(s.solids), ...STACKS.flatMap((st) => one(st).out)].flatMap(slices); // precomputed sections: expectApart takes over 3 s
    expect(near.length).toBeGreaterThan(0);
    expect(tank.filter((a) => slices(a).some((p) => near.some((q) => !boxApart(p, q)))).map((a) => JSON.stringify(a).slice(0, 90))).toEqual([]);
  });

  it("chimneys and cooling tower touch neither hall nor maltings, and every chimney piece stays north of the pitch (max.y < HALL.y − 0.6)", () => {
    const s = scene(), stacks = STACKS.flatMap((st) => one(st).out);
    for (const x of stacks) expect(bounds(x).max.y, JSON.stringify(x).slice(0, 90)).toBeLessThan(HALL.y - 0.6);
    const plant = [...build(boilerHouse), ...build(maltings)].flatMap(slices); // precomputed sections: expectApart takes over 5 s
    expect(stacks.length).toBeGreaterThan(0); expect(plant.length).toBeGreaterThan(0);
    const touching = [...stacks, ...coolingTower(s.solids)].filter((a) => slices(a).some((p) => plant.some((q) => !boxApart(p, q))));
    expect(touching.map((a) => JSON.stringify(a).slice(0, 90))).toEqual([]);
  });

  it("the plant (maltings, water tower, hall and gate) does not touch the substation", () => {
    const s = scene();
    const gate = s.solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && x.h === 8);
    const plantSolids = [...build(maltings), ...build(waterTower), ...build(boilerHouse), ...gate];
    expect(gate).toHaveLength(1);
    expect(union(plantSolids).min.y).toBeGreaterThan(union(raised()).max.y); // the whole plant south of every substation solid
    for (const x of plantSolids) expect(apartBox(bounds(x), FENCE_BOX)).toBe(true);
  });

  it("the maltings does not cover the hall (x ≤ HALL.x) or the pallets (y ≤ MALT.y + MALT.d)", () => {
    const s = scene(), malt = build(maltings);
    for (const x of malt) { const b = bounds(x); expect(b.max.x).toBeLessThanOrEqual(HALL.x + 1e-9); expect(b.max.y).toBeLessThanOrEqual(MALT.y + MALT.d + 1e-9); }
    expectApart(malt, [...build(hallBody), ...s.solids.filter(isPallet)]);
  });

  it("truck yard moved by PLANT_SHIFT: trucks at (25, 78), (55, 84), (80, 78) and pallets at x 7..30, y 87..89", () => {
    const s = scene();
    const boxes = s.solids.filter((x): x is Solid & { kind: "prism" } => isTruck(x) && x.kind === "prism" && x.w === 6).map((x) => [x.at.x, x.at.y]);
    expect(boxes).toEqual([[25, 78], [55, 84], [80, 78]]);
    expect(boxes).toEqual([[40, -12], [70, -6], [95, -12]].map(([x, y]) => [x! + PLANT_SHIFT.x, y! + PLANT_SHIFT.y]));
    const cabs = s.solids.filter((x): x is Solid & { kind: "prism" } => isTruck(x) && x.kind === "prism" && x.w === 2).map((x) => [x.at.x, x.at.y]);
    expect(cabs).toEqual([[31, 78], [61, 84], [86, 78]]);
    const pallets = s.solids.filter(isPallet);
    expect(pallets).toHaveLength(6);
    const u = union(pallets);
    expect([u.min.x, u.max.x, u.min.y, u.max.y]).toEqual([7, 30, 87, 89]);
  });

  it("7 lamps: the plant's five moved, the substation's and the one at (−30, 20); each with its cyan accent on top", () => {
    const s = scene();
    const at = s.solids.filter(isLamp).map((l) => [l.at.x, l.at.y]);
    expect([...at].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)).toEqual([[-30, 20], [5, 76], [9, 77], [35, 76.5], [49, 77], [53, 12], [95, 87]]);
    for (const [x, y] of at) expect(s.accents.filter((a) => a.kind === "dot" && a.color === "cyan" && Math.abs(a.at.x - (x! + 0.3)) < 1e-9 && Math.abs(a.at.y - (y! + 0.3)) < 1e-9 && a.at.z === 5)).toHaveLength(1); // the move shifts x by an ε
  });

  it("every solid of the factory outside the west column and the siding with the crane falls in x 4..98.7, y −4..99", () => {
    const sc = scene();
    const west = (b: Bounds) => b.max.x <= 0;
    const sidingAndCrane = (b: Bounds) => b.min.y >= -13.1 && b.max.y <= -6.7;
    const region = (b: Bounds) => b.min.x >= 4 - 1e-9 && b.max.x <= 98.7 + 1e-9 && b.min.y >= -4 - 1e-9 && b.max.y <= 99 + 1e-9;
    const out = sc.solids.filter((x) => { const b = bounds(x); return !west(b) && !sidingAndCrane(b) && !region(b); });
    expect(out.map((x) => JSON.stringify(x).slice(0, 90))).toEqual([]);
  });

  it("no solid of the maltings or water tower exceeds z 26", () => {
    for (const x of [...build(maltings), ...build(waterTower)]) expect(bounds(x).max.z).toBeLessThanOrEqual(26 + 1e-9);
  });

  it("the lamp at (58, −16) goes to (50, −13.5), and with the move to (35, 76.5)", () => {
    const at = scene().solids.filter(isLamp).map((l) => [l.at.x, l.at.y]);
    expect(at).toContainEqual([50 + PLANT_SHIFT.x, -13.5 + PLANT_SHIFT.y]);
    expect(at).toContainEqual([35, 76.5]);
    expect(at).not.toContainEqual([58 + PLANT_SHIFT.x, -16 + PLANT_SHIFT.y]);
  });

  it("siding with six wagons and locomotive, no long belt, substation, trucks and rail yard with piles", () => {
    const s = scene();
    const wagons = s.solids.filter((x) => x.kind === "prism" && x.w === 8 && x.d === 2.4 && x.h === 3);
    expect(wagons).toHaveLength(6);
    for (let i = 0; i < wagons.length; i++) for (let j = i + 1; j < wagons.length; j++) {
      const a = bounds(wagons[i]!), b = bounds(wagons[j]!);
      expect(a.max.x <= b.min.x || b.max.x <= a.min.x).toBe(true);
    }
    expect(s.solids.filter((x) => x.kind === "prism" && x.at.z === 6 && x.h === 0.6)).toEqual([]);           // sections of the long belt
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 0.8 && x.d === 0.8 && x.h === 6)).toEqual([]); // its trestles
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 6 && x.d === 2.4 && x.h === 2.8)).toHaveLength(3); // trucks
    const rails = s.ground.filter((x) => x.kind === "strip" && x.mat === "steel");
    expect(rails.length).toBeGreaterThanOrEqual(RAIL_YARD_X.length * 2 + 2);
    const piles = s.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "rust" || x.mat === "sand"));
    expect(piles).toHaveLength(6);
    for (const p of piles) expect(p.at.x - p.r).toBeGreaterThanOrEqual(Math.max(...RAIL_YARD_X) + 1); // no pile covers the tracks
  });

  it("dot accents (cyan, magenta or amber) at height and the whole render uses atlas colors", () => {
    const s = scene();
    expect(s.accents.length).toBeGreaterThanOrEqual(7);
    expect(s.accents.every((a) => a.kind === "dot" && ["cyan", "magenta", "amber"].includes(a.color) && a.at.z > 0)).toBe(true);
    const colors = allIsoColors();
    for (const i of buildRenderList([...s.ground, ...s.solids, ...s.excavator])) expect(colors.has(i.color)).toBe(true);
  });
});

type Cyl = Solid & { kind: "cylinder" };
type Box = Solid & { kind: "prism" };
const EPS = 1e-6;
const one = (st: Stack) => { const out: Solid[] = [], acc: Accent[] = []; const mouth = chimney(st, out, acc); return { out, acc, mouth }; };
const cyls = (out: Solid[], ...mats: Material[]) => out.filter((x): x is Cyl => x.kind === "cylinder" && mats.includes(x.mat)).sort((a, b) => a.at.z - b.at.z);
const boxes = (out: Solid[], w: number, d: number, h: number) => out.filter((x): x is Box => x.kind === "prism" && Math.abs(x.w - w) < EPS && Math.abs(x.d - d) < EPS && Math.abs(x.h - h) < EPS);
const apart = (a: Solid, b: Solid) => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x || q.max.x <= p.min.x || p.max.y <= q.min.y || q.max.y <= p.min.y || p.max.z <= q.min.z || q.max.z <= p.min.z;
};
const APO = Math.cos(Math.PI / 8); // apothem of an 8-sided cylinder with radius 1

const isRung = (x: Solid): x is Solid & { kind: "beam" } => x.kind === "beam" && x.from.y === x.to.y && Math.abs(Math.abs(x.to.x - x.from.x) - 0.7) < 1e-9; // rung: 0.7 wide and E-W; the railing joins posts at k·π/4, no chord runs E-W

describe.each(STACKS.map((st, i) => [i, st] as const))("chimney %i", (_i, st) => {
  const B = STACK_BASE_H, M = B + st.h, z0 = B + 3;

  it("returns today's mouth", () => expect(one(st).mouth).toEqual({ x: st.x, y: st.y, z: M }));

  it("seven brick cylinders: stepped base, tapering shaft and crown", () => {
    const b = cyls(one(st).out, "brick");
    expect(b).toHaveLength(7);
    const [s1, s2, ...rest] = b, crown = rest.pop()!, shaft = rest;
    expect(s1!.r).toBeCloseTo(st.r + 1, 6); expect(s1!.at.z).toBeCloseTo(B, 6); expect(s1!.h).toBeCloseTo(1.5, 6);
    expect(s2!.r).toBeCloseTo(st.r + 0.6, 6); expect(s2!.at.z).toBeCloseTo(B + 1.5, 6); expect(s2!.h).toBeCloseTo(1.5, 6);
    expect(shaft).toHaveLength(4);
    expect(shaft[0]!.at.z).toBeCloseTo(z0, 6);
    expect(shaft[0]!.r).toBeCloseTo(st.r + 0.5, 6); expect(shaft[3]!.r).toBeCloseTo(st.r, 6);
    for (let k = 1; k < 4; k++) {
      expect(shaft[k]!.r).toBeLessThan(shaft[k - 1]!.r);
      expect(Math.abs(shaft[k]!.at.z - (shaft[k - 1]!.at.z + shaft[k - 1]!.h))).toBeLessThan(EPS);
    }
    expect(crown.r).toBeCloseTo(st.r + 0.4, 6); expect(crown.at.z + crown.h).toBeCloseTo(M, 6); expect(crown.at.z).toBeCloseTo(M - 0.6, 6);
  });

  it("seven equal red and white bands, red at top and bottom", () => {
    const { out } = one(st);
    const bands = cyls(out, "signal", "whitewash"), shaft = cyls(out, "brick").slice(2, 6);
    expect(bands).toHaveLength(7);
    bands.forEach((b, k) => {
      expect(b.mat).toBe(k % 2 === 0 ? "signal" : "whitewash");
      expect(b.r).toBeCloseTo(st.r, 6);
      expect(b.h).toBeCloseTo(bands[0]!.h, 6);
      if (k > 0) expect(Math.abs(b.at.z - (bands[k - 1]!.at.z + bands[k - 1]!.h) - (k === 6 ? 0.3 : 0))).toBeLessThan(EPS); // 0.3 gap between 6th and 7th: the platform fills it
    });
    expect(bands.filter((b) => b.mat === "signal")).toHaveLength(4);
    const last = shaft[3]!;
    expect(Math.abs(bands[0]!.at.z - (last.at.z + last.h))).toBeLessThan(EPS);
    expect(bands[6]!.at.z + bands[6]!.h).toBeCloseTo(M - 0.6, 6);
    expect(bands[0]!.at.z).toBeCloseTo(z0 + (M - 0.6 - z0) / 2, 6); // they start at the middle of the shaft
  });

  it("no rust band", () => expect(one(st).out.some((x) => x.mat === "rust")).toBe(false));

  it("steel hoops that stick out of the brick", () => {
    const { out } = one(st);
    const hoops = cyls(out, "steel").filter((c) => Math.abs(c.h - 0.2) < EPS), shaft = cyls(out, "brick").slice(2, 6);
    expect(hoops.length).toBeGreaterThanOrEqual(3);
    const order = sortByDepth(out);
    for (const h of hoops) {
      const seg = shaft.find((s) => h.at.z >= s.at.z - EPS && h.at.z + h.h <= s.at.z + s.h + EPS);
      expect(seg).toBeDefined();
      expect(h.r).toBeCloseTo(seg!.r + 0.1, 6);
      expect(order.indexOf(seg!)).toBeLessThan(order.indexOf(h)); // the section it wraps ties on all three axes: it has to go first or it covers it
    }
  });

  it("door on the south face of the pedestal", () => {
    const door = boxes(one(st).out, 0.9, 0.3, 1.4).filter((d) => d.mat === "steel");
    expect(door).toHaveLength(1);
    expect(door[0]!.at.x).toBeCloseTo(st.x - 0.45, 6); expect(door[0]!.at.y).toBeCloseTo(st.y + 3.5, 6); expect(door[0]!.at.z).toBe(0);
  });

  it("platform with eight posts and railing", () => {
    const { out } = one(st);
    const deck = cyls(out, "concrete");
    expect(deck).toHaveLength(1);
    expect(deck[0]!.r).toBeCloseTo(st.r + 1.2, 6); expect(deck[0]!.h).toBeCloseTo(0.3, 6);
    const bands = cyls(out, "signal", "whitewash");
    expect(deck[0]!.at.z).toBeCloseTo(bands[5]!.at.z + bands[5]!.h, 6); expect(deck[0]!.at.z + deck[0]!.h).toBeCloseTo(bands[6]!.at.z, 6); // fills the joint between 6th and 7th band
    const posts = boxes(out, 0.15, 0.15, 1.1).filter((p) => p.mat === "steel");
    expect(posts).toHaveLength(8);
    const lim = (st.r + 1.2) * APO;
    for (const p of posts) {
      expect(p.at.z).toBeCloseTo(deck[0]!.at.z + deck[0]!.h, 6);
      const b = bounds(p);
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) expect(Math.hypot(x - st.x, y - st.y)).toBeLessThanOrEqual(lim + EPS);
    }
    const rail = out.filter((x): x is Solid & { kind: "beam" } => x.kind === "beam" && !isRung(x));
    expect(rail).toHaveLength(8);
  });

  it("four lightning rods over the mouth", () => {
    const rods = boxes(one(st).out, 0.15, 0.15, 1.5).filter((p) => p.mat === "steel");
    expect(rods).toHaveLength(4);
    for (const r of rods) {
      expect(r.at.z).toBeCloseTo(M, 6);
      expect(Math.hypot(r.at.x + 0.075 - st.x, r.at.y + 0.075 - st.y)).toBeCloseTo(st.r + 0.1, 6);
    }
  });

  it("ladder on the south face, outside the platform, up to the height of the railing", () => {
    const { out } = one(st);
    const rails = out.filter((x): x is Box => x.kind === "prism" && x.mat === "steel" && Math.abs(x.w - 0.15) < EPS && Math.abs(x.d - 0.15) < EPS && Math.abs(x.at.z - z0) < EPS);
    expect(rails).toHaveLength(2);
    const deck = cyls(out, "concrete")[0]!, top = deck.at.z + deck.h + 1.1;
    for (const r of rails) {
      expect(r.at.z + r.h).toBeCloseTo(top, 6);
      expect(bounds(r).min.y).toBeGreaterThan(st.y + deck.r * APO); // outside the slab's south face: also of the whole shaft
    }
    const rungs = out.filter((x): x is Solid & { kind: "beam" } => isRung(x)).sort((a, b) => a.from.z - b.from.z);
    expect(rungs.length).toBeGreaterThanOrEqual(5);
    for (const g of rungs) expect(g.from.z).toBeLessThan(top);
    for (let k = 1; k < rungs.length; k++) expect(rungs[k]!.from.z - rungs[k - 1]!.from.z).toBeCloseTo(2, 6);
  });

  it("painter order: the platform goes before the top band, the crown and the posts and railing on the camera side, and the ladder after the platform", () => {
    const { out } = one(st);
    const order = sortByDepth(out), at = (x: Solid) => order.indexOf(x);
    const meet = (a: Solid, b: Solid) => overlaps(screenBounds(bounds(a)), screenBounds(bounds(b))); // the order only matters if they cross on screen
    const deck = cyls(out, "concrete")[0]!, bands = cyls(out, "signal", "whitewash"), crown = cyls(out, "brick").at(-1)!;
    const posts = boxes(out, 0.15, 0.15, 1.1).filter((p) => p.mat === "steel");
    const rail = out.filter((x) => x.kind === "beam" && !isRung(x));
    // on the far side (N/W) the slab edge may cover the foot of a post: it stays behind the shaft and is not seen
    const near = (x: Solid) => { const b = bounds(x); return b.min.x + b.max.x - 2 * st.x + b.min.y + b.max.y - 2 * st.y > EPS; };
    for (const x of [bands[6]!, crown, ...[...posts, ...rail].filter(near)]) if (meet(deck, x)) expect(at(deck)).toBeLessThan(at(x));
    const ladder = [
      ...out.filter((x): x is Box => x.kind === "prism" && x.mat === "steel" && Math.abs(x.at.z - z0) < EPS && Math.abs(x.w - 0.15) < EPS),
      ...out.filter(isRung),
    ];
    expect(ladder.length).toBeGreaterThanOrEqual(7);
    for (const l of ladder) if (meet(l, deck)) expect(at(l)).toBeGreaterThan(at(deck));
  });

  it("two magenta lights just below the mouth", () => {
    const { acc } = one(st);
    expect(acc).toHaveLength(2);
    for (const a of acc) { expect(a.kind).toBe("dot"); expect(a.color).toBe("magenta"); if (a.kind === "dot") { expect(a.r).toBe(0.5); expect(a.at.z).toBeCloseTo(M - 1, 6); } }
  });

  it("no piece measures less than 0.15", () => {
    for (const x of one(st).out) {
      const b = bounds(x);
      for (const d of [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]) expect(d).toBeGreaterThanOrEqual(0.15 - 1e-9);
    }
  });

  it("no piece touches the cooling tower", () => {
    const tower = scene().solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r >= 7);
    expect(tower).toHaveLength(4);
    for (const p of one(st).out) for (const t of tower) expect(apart(p, t)).toBe(true);
  });

  it("no piece enters the substation fence (in plan)", () => {
    const fence = { min: { ...FENCE_BOX.min, z: -Infinity }, max: { ...FENCE_BOX.max, z: Infinity } };
    for (const p of one(st).out) expect(apartBox(bounds(p), fence)).toBe(true);
  });
});

describe("neighboring chimneys", () => {
  it("the pieces of one chimney do not touch those of another", () => {
    const all = STACKS.map((st) => one(st).out);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      for (const a of all[i]!) for (const b of all[j]!) expect(apart(a, b)).toBe(true);
  });
});

const coolingTower = (solids: readonly Solid[]) => solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder" && x.mat === "concrete" && x.r >= 7);
const inBox = (b: Bounds, x0: number, x1: number, y0: number, y1: number): boolean =>
  b.min.x >= x0 - 1e-9 && b.max.x <= x1 + 1e-9 && b.min.y >= y0 - 1e-9 && b.max.y <= y1 + 1e-9;

describe("chimneys and cooling tower behind the hall's new spot (#245)", () => {
  it("STACKS at (58, 32), (72, 26), (86, 32) with the same r and h; COOLING exported at (40, 14) r 9", () => {
    expect(STACKS).toEqual([{ x: 58, y: 32, r: 2.8, h: 22 }, { x: 72, y: 26, r: 2.6, h: 26 }, { x: 86, y: 32, r: 2.4, h: 24 }]);
    expect(COOLING).toEqual({ x: 40, y: 14, r: 9 });
  });

  it("every chimney solid falls in x 54..90, y 22..36.1", () => {
    for (const st of STACKS) for (const x of one(st).out) expect(inBox(bounds(x), 54, 90, 22, 36.1), JSON.stringify(x).slice(0, 90)).toBe(true);
  });

  it("the cooling tower: 4 cylinders at x 31..49, y 5..23, the bottom one of r COOLING.r centered on COOLING", () => {
    const tower = coolingTower(scene().solids);
    expect(tower).toHaveLength(4);
    for (const t of tower) { expect(inBox(bounds(t), 31, 49, 5, 23)).toBe(true); expect(t.at).toMatchObject({ x: COOLING.x, y: COOLING.y }); }
    expect(tower.find((t) => t.at.z === 0)!.r).toBe(COOLING.r);
  });

  it("chimneys and cooling tower touch no other non-flat solid of the factory: substation, lamp (53, 12), pallets, trucks, siding, crane, plant and water tower", () => {
    const s = scene();
    const mine = [...STACKS.flatMap((st) => one(st).out), ...coolingTower(s.solids)];
    const keys = new Set(mine.map((x) => JSON.stringify(x)));
    expect(s.solids.filter((x) => keys.has(JSON.stringify(x)))).toHaveLength(mine.length);
    const others = s.solids.filter((x) => !isFlat(x) && !keys.has(JSON.stringify(x)));
    expect(others.length).toBeGreaterThan(0);
    expect(others.filter(isLamp).some((l) => l.at.x === 53 && l.at.y === 12)).toBe(true);
    const u = union(mine);
    const near = others.flatMap(slices).filter((b) => b.max.x >= u.min.x - 1 && b.min.x <= u.max.x + 1 && b.max.y >= u.min.y - 1 && b.min.y <= u.max.y + 1); // the rest cannot touch
    expect(near.length).toBeGreaterThan(0); // the lamp (53, 12), at least
    const touching = mine.filter((a) => slices(a).some((p) => near.some((q) => !apartBox(p, q)))); // one expect per pair takes 10 s
    expect(touching.map((a) => JSON.stringify(a).slice(0, 90))).toEqual([]);
  });
});

const sub = (): Solid[] => build(substation);
/** Substation fence in the world, from z 0 to the masts (z 12). */
const FENCE_BOX: Bounds = { min: { x: SUBSTATION.x0, y: SUBSTATION.y0, z: 0 }, max: { x: SUBSTATION.x1, y: SUBSTATION.y1, z: 12 } };
/** Gate of the south fence: from 19.5 to 22.5 from the west corner. */
const GATE = { x0: SUBSTATION.x0 + 19.5, x1: SUBSTATION.x0 + 22.5 } as const;
/** Footprint of today's substation in its local frame (x 149..190, y −60..−47), taken before the move (#244). */
const LOCAL_FINGERPRINT = "ef04a1c8";
const raised = (): Solid[] => sub().filter((x) => !isFlat(x));
function union(solids: readonly Solid[]): Bounds {
  const bs = solids.map(bounds);
  return {
    min: { x: Math.min(...bs.map((b) => b.min.x)), y: Math.min(...bs.map((b) => b.min.y)), z: Math.min(...bs.map((b) => b.min.z)) },
    max: { x: Math.max(...bs.map((b) => b.max.x)), y: Math.max(...bs.map((b) => b.max.y)), z: Math.max(...bs.map((b) => b.max.z)) },
  };
}
/** Disjoint in x, in y or in z (touching on a face is not overlap). */
const apartBox = (a: Bounds, b: Bounds): boolean =>
  a.max.x <= b.min.x + 1e-9 || b.max.x <= a.min.x + 1e-9 || a.max.y <= b.min.y + 1e-9 || b.max.y <= a.min.y + 1e-9 || a.max.z <= b.min.z + 1e-9 || b.max.z <= a.min.z + 1e-9;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
const isPrism = (x: Solid, w: number, d: number, h: number, mat?: string): x is Solid & { kind: "prism" } =>
  x.kind === "prism" && near(x.w, w) && near(x.d, d) && near(x.h, h) && (mat === undefined || x.mat === mat);
type Beam = Solid & { kind: "beam" };
const beams = (solids: readonly Solid[]): Beam[] => solids.filter((x): x is Beam => x.kind === "beam");
const beamLen = (b: Beam): number => Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y, b.to.z - b.from.z);
const cylinders = (solids: readonly Solid[]) => solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
const T1 = (): Solid[] => build((o) => powerTransformer(o, TRANSFORMERS_Y[0], false));
const T2 = (): Solid[] => build((o) => powerTransformer(o, TRANSFORMERS_Y[1], true));
const fins = (solids: readonly Solid[]) => solids.filter((x) => x.mat === "steel" && (isPrism(x, 0.15, 1.6, 3) || isPrism(x, 1.6, 0.15, 3)));

describe("outdoor substation (#215)", () => {
  it("today's 3 × 3 × 3 cubes and post portals are removed", () => {
    const s = scene();
    expect(s.solids.filter((x) => isPrism(x, 3, 3, 3, "steel"))).toHaveLength(0);
    expect(s.solids.filter((x) => isPrism(x, 0.6, 0.6, 7, "steel"))).toHaveLength(0);
    expect(s.solids.filter((x) => isPrism(x, 0.6, 10.6, 0.6, "steel"))).toHaveLength(0);
  });

  it("sand gravel yard before the concrete curb, and both on the factory ground", () => {
    const flat = sub().filter(isFlat);
    const yard = flat.findIndex((x) => x.kind === "strip" && x.mat === "sand"), curb = flat.findIndex((x) => x.kind === "strip" && x.mat === "concrete");
    expect(yard).toBeGreaterThanOrEqual(0); expect(curb).toBeGreaterThan(yard);
    const g = flat[yard]!;
    expect(g).toMatchObject({ kind: "strip", width: SUBSTATION.y1 - SUBSTATION.y0, z: 0.03, path: [{ x: SUBSTATION.x0, y: (SUBSTATION.y0 + SUBSTATION.y1) / 2 }, { x: SUBSTATION.x1, y: (SUBSTATION.y0 + SUBSTATION.y1) / 2 }] });
    const b = bounds(g);
    expect(b.min.x).toBeGreaterThanOrEqual(SUBSTATION.x0); expect(b.max.x).toBeLessThanOrEqual(SUBSTATION.x1);
    expect(b.min.y).toBeGreaterThanOrEqual(SUBSTATION.y0 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(SUBSTATION.y1 + 1e-9);
    const ground = scene().ground;
    const gi = ground.findIndex((x) => x.kind === "strip" && x.mat === "sand" && x.width === 13);
    const ci = ground.findIndex((x) => x.kind === "strip" && x.mat === "concrete" && x.path.length === 5 && x.path[0]!.x === SUBSTATION.x0);
    expect(gi).toBeGreaterThanOrEqual(0); expect(ci).toBeGreaterThan(gi);
  });

  it("the fence is against the siding at x 54..95, y −2..11: SUBSTATION_SHIFT (−95, +58) from x 149..190, y −60..−47", () => {
    expect(SUBSTATION_SHIFT).toEqual({ x: -95, y: 58 });
    expect(SUBSTATION).toEqual({ x0: 54, x1: 95, y0: -2, y1: 11 });
    expect(PHASES_Y).toEqual([1, 4.5, 8]);
    expect(TRANSFORMERS_Y).toEqual([-1, 5]);
    expect(FIREWALL).toMatchObject({ w: 7, d: 0.6, h: 5.5 });
    expect(FIREWALL.x).toBeCloseTo(76.5, 9); expect(FIREWALL.y).toBeCloseTo(3.7, 9);
  });

  it("it is today's substation moved: same solids, in the same order, shifted by SUBSTATION_SHIFT", () => {
    const world = sub();
    expect(world).toHaveLength(357);
    expect(raised()).toHaveLength(355);
    const local = world.map((x) => translate(x, -SUBSTATION_SHIFT.x, -SUBSTATION_SHIFT.y));
    expect(fingerprint(local)).toBe(LOCAL_FINGERPRINT);
    // anchors in today's frame, plus the shift: hut, tanks, firewall and gate pillars
    const at = (x: number, y: number) => ({ x: x + SUBSTATION_SHIFT.x, y: y + SUBSTATION_SHIFT.y });
    const hut = world.find((x): x is Solid & { kind: "prism" } => isPrism(x, 4, 3, 2.8, "whitewash"))!;
    expect(hut.at).toMatchObject(at(182, -52));
    const tanks = world.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 6, 4, 4, "steel"));
    expect(tanks.map((t) => ({ x: t.at.x, y: t.at.y }))).toEqual([at(172, -59), at(172, -53)]);
    const wall = world.find((x): x is Solid & { kind: "prism" } => isPrism(x, FIREWALL.w, FIREWALL.d, FIREWALL.h, "concrete"))!;
    expect(r6(wall.at.x)).toBe(r6(at(171.5, -54.3).x)); expect(r6(wall.at.y)).toBe(r6(at(171.5, -54.3).y));
    const pillars = world.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.6, 0.6, 2.6, "concrete"));
    expect(pillars.map((p) => r6(p.at.x))).toEqual([r6(at(168.5, 0).x), r6(at(170.9, 0).x)]);
  });

  it("every substation solid falls inside the SUBSTATION fence, and none exceeds z 12", () => {
    const solids = raised();
    expect(solids.length).toBeGreaterThan(300);
    for (const x of solids) {
      const b = bounds(x);
      expect(b.min.x, x.kind).toBeGreaterThanOrEqual(SUBSTATION.x0 - 1e-9); expect(b.max.x, x.kind).toBeLessThanOrEqual(SUBSTATION.x1 + 1e-9);
      expect(b.min.y, x.kind).toBeGreaterThanOrEqual(SUBSTATION.y0 - 1e-9); expect(b.max.y, x.kind).toBeLessThanOrEqual(SUBSTATION.y1 + 1e-9);
      expect(b.min.z, x.kind).toBeGreaterThanOrEqual(0); expect(b.max.z, x.kind).toBeLessThanOrEqual(12 + 1e-9);
    }
    expect(union(solids).max.z).toBeCloseTo(12); // the ground-wire masts
  });

  it("no piece thinner than 0.15 u", () => {
    const min = 0.15 - 1e-9;
    for (const x of raised()) {
      if (x.kind === "prism") for (const v of [x.w, x.d, x.h]) expect(v).toBeGreaterThanOrEqual(min);
      if (x.kind === "cylinder" || x.kind === "cone") { expect(2 * x.r).toBeGreaterThanOrEqual(min); expect(x.h).toBeGreaterThanOrEqual(min); }
      if (x.kind === "beam") for (const v of [x.w, x.h, beamLen(x)]) expect(v).toBeGreaterThanOrEqual(min);
    }
  });

  it("it stays in the new region: y ≥ −4 and x ≤ 98.7", () => {
    for (const x of raised()) { const b = bounds(x); expect(b.min.y).toBeGreaterThanOrEqual(-4); expect(b.max.x).toBeLessThanOrEqual(98.7); }
  });

  it("substation lamp at the SW corner of the fence, (53, 12)", () => {
    const lamp = scene().solids.filter((x): x is Solid & { kind: "prism" } => isLamp(x) && x.at.x === SUBSTATION.x0 - 1 && x.at.y === SUBSTATION.y1 + 1);
    expect(lamp).toHaveLength(1);
    expect(lamp[0]!.at).toMatchObject({ x: 53, y: 12 });
    expect(scene().solids.filter((x) => isLamp(x) && x.at.x === 148 && x.at.y === -46)).toHaveLength(0);
  });

  it("it touches no other solid of the factory: wagons, locomotive, tower crane, pallets, trucks, lamps, tower and chimneys", () => {
    const s = scene(), mine = raised();
    const keys = new Set(mine.map((x) => JSON.stringify(x)));
    expect(s.solids.filter((x) => keys.has(JSON.stringify(x)))).toHaveLength(mine.length);
    const others = s.solids.filter((x) => !keys.has(JSON.stringify(x)));
    expect(others.length).toBeGreaterThan(0);
    const near12 = others.flatMap(slices).filter((b) => b.max.x >= SUBSTATION.x0 - 2 && b.min.x <= SUBSTATION.x1 + 2 && b.max.y >= SUBSTATION.y0 - 2 && b.min.y <= SUBSTATION.y1 + 2);
    expect(near12.length).toBeGreaterThan(0); // its own lamp, at least
    for (const a of mine) for (const p of slices(a)) for (const q of near12) expect(apartBox(p, q), JSON.stringify(a).slice(0, 90)).toBe(true);
  });

  it("fence: 13 posts, none at the gate, and diamond mesh of 26 diagonals", () => {
    const solids = raised();
    const posts = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.15, 0.15, 2.2, "steel"));
    expect(posts).toHaveLength(13);
    for (const p of posts) expect(p.at.x + 0.15 <= GATE.x0 + 1e-9 || p.at.x >= GATE.x1 - 1e-9).toBe(true);
    expect(posts.filter((p) => near(p.at.y, SUBSTATION.y1 - 0.15))).toHaveLength(10); // south side
    expect(posts.filter((p) => near(p.at.x, SUBSTATION.x1 - 0.15))).toHaveLength(4);  // east side, with the corner
    const mesh = beams(solids).filter((b) => b.mat === "steel" && near(b.w, 0.15) && near(Math.min(b.from.z, b.to.z), 0.1) && near(Math.max(b.from.z, b.to.z), 2.1));
    expect(mesh).toHaveLength(26);
  });

  it("two-leaf gate: pillars with safety bolt and signal danger signs, 8 bars and 2 rails", () => {
    const solids = raised();
    const pillars = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.6, 0.6, 2.6, "concrete"));
    expect(pillars.map((p) => r6(p.at.x)).sort((a, b) => a - b)).toEqual([r6(GATE.x0), r6(GATE.x1 - 0.6)]);
    const plates = pillars.flatMap((p) => p.plates ?? []);
    expect(plates).toEqual(expect.arrayContaining([expect.objectContaining({ wall: 2, shape: "tri", mat: "safety" }), expect.objectContaining({ wall: 2, shape: "rect", mat: "signal" })]));
    const bars = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.15, 0.15, 2, "steel") && x.at.z === 0); // the masts (z 10) measure the same
    expect(bars).toHaveLength(8);
    for (const b of bars) { expect(b.at.x).toBeGreaterThanOrEqual(GATE.x0 + 0.6 - 1e-9); expect(b.at.x + 0.15).toBeLessThanOrEqual(GATE.x1 - 0.6 + 1e-9); }
    expect(beams(solids).filter((b) => near(b.from.z, 1.85) && near(b.to.z, 1.85) && near(b.from.y, SUBSTATION.y1 - 0.3))).toHaveLength(2);
  });

  it("whitewash control hut with facade and door", () => {
    const hut = raised().filter((x): x is Solid & { kind: "prism" } => isPrism(x, 4, 3, 2.8, "whitewash"));
    expect(hut).toHaveLength(1);
    expect(hut[0]!.at).toEqual({ x: SUBSTATION.x0 + 33, y: SUBSTATION.y0 + 8, z: 0 });
    expect(hut[0]!.facade).toMatchObject({ floors: 1, cols: 2 });
    expect(hut[0]!.plates).toEqual([expect.objectContaining({ wall: 2, shape: "rect", mat: "steel", toneOffset: -2 })]);
  });

  it("two lattice portals: 16 uprights, 64 X diagonals, 4 chords, 16 zigzag sections, 4 tips and 4 masts", () => {
    const solids = raised();
    expect(solids.filter((x) => isPrism(x, 0.2, 0.2, 9, "steel"))).toHaveLength(16);
    const thin = beams(solids).filter((b) => b.mat === "steel" && near(b.w, 0.15));
    const diag = thin.filter((b) => { const dz = Math.abs(b.to.z - b.from.z); return (near(dz, 2.5) || near(dz, 2.4) || near(dz, 1.5)) && near(Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y), 0.8); });
    expect(diag).toHaveLength(64);
    expect(beams(solids).filter((b) => b.mat === "steel" && near(b.w, 0.3) && near(b.h, 0.3))).toHaveLength(4);
    expect(thin.filter((b) => near(Math.abs(b.to.y - b.from.y), 1.125) && near(Math.abs(b.to.z - b.from.z), 1) && near(b.from.x, b.to.x))).toHaveLength(16);
    expect(solids.filter((x) => x.kind === "cone" && x.mat === "steel" && x.sides === 4 && near(x.r, 0.7) && near(x.h, 1))).toHaveLength(4);
    expect(solids.filter((x) => isPrism(x, 0.15, 0.15, 2, "steel") && near(x.at.z, 10))).toHaveLength(4);
  });

  it("three lines from SUBSTATION.x0 + 2.5 to SUBSTATION.x1 − 3.5 at z 9.5: two chains of 9 alternating discs and a conductor between them, disjoint in x", () => {
    const all = beams(raised());
    for (const y of PHASES_Y) {
      const line = all.filter((b) => near(b.from.y, y) && near(b.to.y, y) && near(b.from.z, 9.5) && near(b.to.z, 9.5));
      const discs = line.filter((b) => near(beamLen(b), 0.15));
      expect(discs).toHaveLength(18);
      for (const d of discs) expect((near(d.w, 0.5) && near(d.h, 0.5) && d.mat === "whitewash") || (near(d.w, 0.35) && near(d.h, 0.35) && d.mat === "glass")).toBe(true);
      expect(discs.filter((d) => d.mat === "whitewash")).toHaveLength(10);
      const wires = line.filter((b) => b.mat === "steel" && near(b.w, 0.15) && !near(beamLen(b), 0.15));
      expect(wires).toHaveLength(1);
      const w = bounds(wires[0]!);
      expect(w.min.x).toBeCloseTo(SUBSTATION.x0 + 3.85); expect(w.max.x).toBeCloseTo(SUBSTATION.x1 - 4.85);
      const db = discs.map(bounds);
      expect(Math.min(...db.map((b) => b.min.x))).toBeCloseTo(SUBSTATION.x0 + 2.5); expect(Math.max(...db.map((b) => b.max.x))).toBeCloseTo(SUBSTATION.x1 - 3.5);
      for (const b of db) expect(b.max.x <= w.min.x + 1e-9 || b.min.x >= w.max.x - 1e-9).toBe(true);
    }
  });

  it("three disconnectors: frame, two columns of 6 skirts and a signal arm", () => {
    const solids = raised();
    expect(solids.filter((x) => isPrism(x, 2.4, 0.6, 2.5, "steel"))).toHaveLength(3);
    expect(beams(solids).filter((b) => b.mat === "signal" && near(b.w, 0.2) && near(b.h, 0.2))).toHaveLength(3);
    const one = build((o) => disconnector(o, PHASES_Y[0]));
    const sheds = cylinders(one).filter((c) => c.mat === "whitewash" && near(c.h, 0.3));
    expect(sheds).toHaveLength(12);
    expect(new Set(sheds.map((c) => c.r))).toEqual(new Set([0.3, 0.42]));
    expect(new Set(sheds.map((c) => r6(c.at.x)))).toEqual(new Set([r6(SUBSTATION.x0 + 8.1), r6(SUBSTATION.x0 + 9.9)]));
    for (const c of sheds) { expect(near(c.at.y, PHASES_Y[0])).toBe(true); expect(apartBox(bounds(c), FENCE_BOX)).toBe(false); } // sub-builder in the world: falls inside the fence
  });

  it("three CTs on a stand, with 6 skirts and a rounded head", () => {
    const one = build((o) => currentTransformer(o, PHASES_Y[1]));
    expect(one.filter((x) => isPrism(x, 0.15, 0.15, 2.5, "steel"))).toHaveLength(4);
    expect(one.filter((x) => isPrism(x, 0.8, 0.8, 0.15, "steel"))).toHaveLength(1);
    expect(cylinders(one).filter((c) => c.mat === "whitewash" && near(c.h, 0.3))).toHaveLength(6);
    expect(cylinders(one).filter((c) => c.mat === "whitewash" && near(c.r, 0.6) && near(c.h, 0.8))).toHaveLength(1);
    expect(one.filter((x) => x.kind === "cone" && x.mat === "whitewash" && near(x.r, 0.6) && near(x.h, 0.4))).toHaveLength(1);
    expect(cylinders(raised()).filter((c) => c.mat === "whitewash" && near(c.r, 0.6) && near(c.h, 0.8))).toHaveLength(3);
    expect(cylinders(raised()).filter((c) => c.mat === "whitewash" && near(c.h, 0.3))).toHaveLength(54); // 36 from disconnectors + 18 from CTs
  });

  it("disconnectors, CTs and transformers of different phases do not touch each other", () => {
    const units: { phase: number; b: Bounds }[] = [
      ...PHASES_Y.map((y, i) => ({ phase: i, b: union(build((o) => disconnector(o, y))) })),
      ...PHASES_Y.map((y, i) => ({ phase: i, b: union(build((o) => currentTransformer(o, y))) })),
      { phase: 0, b: union(T1()) }, { phase: 2, b: union(T2()) },
    ];
    for (const a of units) for (const c of units) if (a.phase !== c.phase) expect(apartBox(a.b, c.b)).toBe(true);
    for (const { b } of units) { // the sub-builders take and emit world coordinates: each unit falls inside the fence
      expect(b.min.x).toBeGreaterThanOrEqual(SUBSTATION.x0); expect(b.max.x).toBeLessThanOrEqual(SUBSTATION.x1);
      expect(b.min.y).toBeGreaterThanOrEqual(SUBSTATION.y0 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(SUBSTATION.y1 + 1e-9);
    }
  });

  it("two transformers: 6 × 4 × 4 tank at z 0.5 with plate, 18 fins, conservator with pipe and 3 bushings at 35° toward the south", () => {
    const solids = raised();
    const tanks = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 6, 4, 4, "steel"));
    expect(tanks.map((t) => t.at)).toEqual(TRANSFORMERS_Y.map((y) => ({ x: SUBSTATION.x0 + 23, y, z: 0.5 })));
    for (const t of tanks) expect(t.plates).toEqual([expect.objectContaining({ shape: "rect", mat: "whitewash" })]);
    expect(fins(solids)).toHaveLength(18);
    expect(fins(T1())).toHaveLength(6); expect(fins(T2())).toHaveLength(12);
    for (const unit of [T1(), T2()]) {
      expect(beams(unit).filter((b) => b.mat === "steel" && near(b.w, 1.2) && near(b.h, 1.2))).toHaveLength(1); // conservator
      expect(beams(unit).filter((b) => b.mat === "steel" && near(b.w, 0.15))).toHaveLength(1);                  // pipe
      expect(unit.filter((x) => isPrism(x, 0.3, 0.3, 0.7, "steel"))).toHaveLength(2);                           // conservator posts
      const bushings = beams(unit).filter((b) => b.mat === "whitewash" && near(b.w, 0.4));
      expect(bushings).toHaveLength(3);
      for (const b of bushings) {
        expect(beamLen(b)).toBeCloseTo(2.5);
        expect(near(b.from.z, 4.5)).toBe(true);
        expect((b.to.z - b.from.z) / beamLen(b)).toBeCloseTo(Math.sin((35 * Math.PI) / 180));
        expect(b.to.y).toBeGreaterThan(b.from.y);
      }
    }
  });

  it("the plate of T1 falls south of its east fins and that of T2 east of its south fins", () => {
    const plate = (unit: Solid[]) => tessellateAll(unit.find((x) => isPrism(x, 6, 4, 4, "steel"))!).filter((f) => f.mat === "whitewash");
    const p1 = plate(T1()), p2 = plate(T2());
    expect(p1).toHaveLength(1); expect(p2).toHaveLength(1);
    const f1 = union(fins(T1())), f2 = fins(T2()).filter((x) => isPrism(x, 0.15, 1.6, 3)).map(bounds);
    expect(Math.min(...p1[0]!.pts.map((p) => p.y))).toBeGreaterThanOrEqual(f1.max.y);
    expect(p1[0]!.pts.every((p) => near(p.x, SUBSTATION.x0 + 29))).toBe(true);
    expect(Math.min(...p2[0]!.pts.map((p) => p.x))).toBeGreaterThanOrEqual(Math.max(...f2.map((b) => b.max.x)));
    expect(p2[0]!.pts.every((p) => near(p.y, TRANSFORMERS_Y[1] + 4))).toBe(true);
  });

  it("firewall taller than the tanks and not touching them; 4-frame pits per tank; T1 and T2 do not touch the firewall", () => {
    const solids = raised();
    const wall = solids.filter((x) => isPrism(x, FIREWALL.w, FIREWALL.d, FIREWALL.h, "concrete"));
    expect(wall).toHaveLength(1);
    const wb = bounds(wall[0]!);
    expect(wb.min.x).toBeCloseTo(FIREWALL.x); expect(wb.min.y).toBeCloseTo(FIREWALL.y); expect(wb.min.z).toBe(0);
    expect(wb.max.x).toBeCloseTo(FIREWALL.x + FIREWALL.w); expect(wb.max.z).toBeCloseTo(FIREWALL.h);
    const tanks = solids.filter((x) => isPrism(x, 6, 4, 4, "steel"));
    for (const t of tanks) { expect(apartBox(wb, bounds(t))).toBe(true); expect(wb.max.z).toBeGreaterThan(bounds(t).max.z); }
    expect(solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && near(x.h, 0.3) && near(x.at.z, 0))).toHaveLength(8);
    for (const unit of [T1(), T2()]) expect(apartBox(wb, union(unit))).toBe(true);
    expect(apartBox(union(T1()), union(T2()))).toBe(true);
  });

  it("12 jumpers drop from the conductor's belly to disconnectors, CTs and bushings", () => {
    const d = beams(build(droppers));
    expect(d).toHaveLength(12);
    for (const b of d) { expect(b.mat).toBe("steel"); expect(near(b.w, 0.15)).toBe(true); expect(near(b.from.z, 9.425)).toBe(true); expect(b.to.z).toBeLessThan(9.425); }
    const tip = 4.5 + 2.5 * Math.sin((35 * Math.PI) / 180);
    expect(d.map((b) => Math.round(b.to.z * 1000) / 1000).sort()).toEqual([...Array(3).fill(4.5), ...Array(3).fill(5.65), ...Array(6).fill(Math.round(tip * 1000) / 1000)].sort()); // arm, CT head, bushing tip
    for (const b of d.filter((x) => near(x.to.z, tip))) expect(near(b.from.y, b.to.y > TRANSFORMERS_Y[1] + 1 ? PHASES_Y[2] : PHASES_Y[1])).toBe(true); // T1 → PHASES_Y[1], T2 → PHASES_Y[2]
  });
});

describe("excavator in the rail yard", () => {
  const machine = (): Solid[] => { const out: Solid[] = []; excavator(out, []); return out; };
  const withWheel = (): Solid[] => [...machine(), excavatorWheel(0)]; // the wheel also counts against tracks, wagons and lamp
  const axle = local(EXCAVATOR.axleDx, 0);
  const piles = (sc: FactoryScene) => sc.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "rust" || x.mat === "sand"));
  const isFixed = (p: Solid & { kind: "cone" }) => Math.abs(p.at.x - axle.x) < EPS && Math.abs(p.at.y - axle.y) < EPS && p.r === EXCAVATOR.pile.r;

  it("the scene brings the whole machine in scene.excavator and no piece in scene.solids", () => {
    const sc = scene();
    expect(sc.excavator).toEqual(machine());
    expect(sc.excavator.length).toBeGreaterThan(0);
    for (const x of sc.excavator) expect(sc.solids).not.toContain(x);
    const s = JSON.stringify(sc.solids);
    for (const x of machine()) expect(s).not.toContain(JSON.stringify(x));
  });

  it("no solid touches the tracks except from above (z ≥ 2)", () => {
    for (const x of withWheel()) {
      const b = bounds(x);
      for (const rx of RAIL_YARD_X) for (const dx of [-0.8, 0.8]) {
        const x0 = rx + dx - 0.2, x1 = rx + dx + 0.2;
        if (b.max.x > x0 && b.min.x < x1) expect(b.min.z).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("neither the wagons nor the lamp (−30, 20), and the whole machine at y ≤ 108", () => {
    const s = scene();
    const wagons = s.solids.filter((x) => x.kind === "prism" && x.w === 2.2 && x.d === 7 && x.h === 2.8);
    expect(wagons).toHaveLength(8);
    const lamp = s.solids.find((x) => x.kind === "prism" && x.at.x === -30 && x.at.y === 20 && x.w === 0.6)!;
    expect(lamp).toBeDefined();
    for (const x of withWheel()) {
      for (const w of [...wagons, lamp]) expect(apart(x, w)).toBe(true);
      expect(bounds(x).max.y).toBeLessThanOrEqual(108);
    }
  });

  it("no solid exceeds z 20.5", () => {
    for (const x of machine()) expect(bounds(x).max.z).toBeLessThanOrEqual(20.5);
  });

  it("fixed pile under the wheel plus 3 large rust and 2 small sand ones from the rng", () => {
    const ps = piles(scene());
    const fixed = ps.filter(isFixed);
    expect(fixed).toHaveLength(1);
    expect(fixed[0]).toMatchObject({ mat: "rust", r: 6.5, h: 4.5, sides: 7 });
    const rest = ps.filter((p) => !isFixed(p));
    expect(rest.filter((p) => p.mat === "rust")).toHaveLength(3);
    expect(rest.filter((p) => p.mat === "sand")).toHaveLength(2);
  });

  it.each(Array.from({ length: 20 }, (_, i) => i + 1).concat(7))("seed %i: no rng pile touches the machine's box and all stay east of the tracks", (seed) => {
    const box = excavatorBox();
    for (const p of piles(factory(createRng(seed)))) {
      expect(p.at.x - p.r).toBeGreaterThanOrEqual(-39);
      if (isFixed(p)) continue;
      const touches = p.at.x + p.r > box.x0 - 1 && p.at.x - p.r < box.x1 + 1 && p.at.y + p.r > box.y0 - 1 && p.at.y - p.r < box.y1 + 1; // box inflated by 1, like the implementation
      expect(touches).toBe(false);
    }
  });

  it("the machine's box contains all its solids and the wheel at any angle", () => {
    const box = excavatorBox();
    for (const x of machine()) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(box.x0 - EPS); expect(b.max.x).toBeLessThanOrEqual(box.x1 + EPS);
      expect(b.min.y).toBeGreaterThanOrEqual(box.y0 - EPS); expect(b.max.y).toBeLessThanOrEqual(box.y1 + EPS);
    }
  });
});
