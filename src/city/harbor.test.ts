import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { hides, screenHull } from "../iso/depth";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { RECIPES, recipe } from "../kit/index";
import { CAR, dockCrane } from "../kit/props";
import { STYLES } from "../kit/styles";
import type { Lot } from "../kit/types";
import { eastBank, worldZoneAt } from "../map/geo";
import { createRng, SEED } from "../map/seed";
import { city, type CityScene } from "../scenes/city";
import { DARSENA } from "../scenes/city-grid";
import { PLINTH_H } from "../scenes/city-pieces";
import { clearOfWater, isWaterAt, terrainAt } from "../scenes/terrain-classify";
import { zoneRng } from "../scenes/world";
import { BOATS, harbor } from "./harbor";

/** Inlet and dock basin of the Resume east bank (#326). */
const CITY_LOT: Lot = { x: 281.5, y: 117.5, w: 21, d: 15, z: 0.3, open: ["n", "w"], maxH: 24 };
const LAB_LOT: Lot = { x: 0, y: 0, w: 24, d: 18, z: 0.3, open: ["s", "e"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-9;
const SCENES: readonly [string, () => CityScene][] = [
  ["seed 7,8,9", () => city(createRng(7), createRng(8), createRng(9))],
  ["site seed", () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3))],
];
const works = (seed: number): { solids: Solid[]; accents: Accent[] } => {
  const solids: Solid[] = [], accents: Accent[] = [];
  harbor(solids, accents, createRng(seed));
  return { solids, accents };
};
/** Plan overlap with positive area (touching edges do not count). */
const planCut = (a: Bounds, b: Bounds): boolean => a.min.x < b.max.x - EPS && b.min.x < a.max.x - EPS && a.min.y < b.max.y - EPS && b.min.y < a.max.y - EPS;
const isPrism = (s: Solid, mat: string, w: number, d: number, h: number): boolean =>
  s.kind === "prism" && s.mat === mat && Math.abs(s.w - w) < EPS && Math.abs(s.d - d) < EPS && Math.abs(s.h - h) < EPS;
const plates = (s: Solid) => ("plates" in s && s.plates) || [];

describe("harbor family", () => {
  it("registers fishMarket and foodHall in the harbor family, with the harbor style", () => {
    expect(RECIPES.filter((r) => r.family === "harbor").map((r) => r.name)).toEqual(["fishMarket", "foodHall"]);
    expect(STYLES.harbor).toEqual({ id: "harbor", mat: "brick", trim: "copper", roof: "sheetTeal", tone: 0, floorH: 3, window: "windowWarm" });
  });

  it("fishMarket: brick body 21×15×4 with a 1×6 facade that publishes windows, a sheetTeal vault along x on top and the awning to the north", () => {
    for (const lot of [CITY_LOT, LAB_LOT]) {
      const p = recipe("fishMarket")(lot, createRng(1), STYLES.harbor);
      const body = p.solids.find((s) => s.kind === "prism" && !!s.facade);
      if (!body || body.kind !== "prism") throw new Error("no body");
      expect(body).toMatchObject({ w: 21, d: 15, h: 4, mat: "brick", facade: { floors: 1, cols: 6 } });
      expect(body.at.z).toBeCloseTo(lot.z, 9);
      expect(p.windows.length).toBeGreaterThan(0);
      const vault = p.solids.find((s) => s.kind === "vault");
      expect(vault).toMatchObject({ axis: "x", len: 21, w: 15, h: 3, mat: "sheetTeal" });
      expect(vault?.kind === "vault" && Math.abs(vault.at.z - (lot.z + 4)) < EPS).toBe(true);
      const awning = p.solids.find((s) => s.kind === "ramp" && s.mat === "awning");
      expect(awning).toMatchObject({ dir: "n", w: 12 });
      expect(bounds(awning!).max.y).toBeCloseTo(body.at.y, 9); // hangs north of the north wall
      const glass = plates(body).filter((q) => q.mat === "glass");
      expect(glass).toHaveLength(6);
      for (const g of glass) {
        expect(g).toMatchObject({ wall: 0, shape: "rect" });
        expect(g.z0).toBeCloseTo(lot.z + 1, 9);
        expect(g.z1).toBeCloseTo(lot.z + 3.5, 9);
        expect(g.u1 - g.u0).toBeCloseTo(2 / 21, 9);
      }
      expect(p.slots).toEqual([]);
    }
  });

  it("foodHall: twin brick sheds 8×15×4 five apart with vaults along y, a covered patio with a garland and three tables", () => {
    for (const lot of [CITY_LOT, LAB_LOT]) {
      const p = recipe("foodHall")(lot, createRng(1), STYLES.harbor);
      const sheds = p.solids.filter((s) => s.kind === "prism" && !!s.facade);
      expect(sheds).toHaveLength(2);
      for (const s of sheds) expect(s).toMatchObject({ w: 8, d: 15, h: 4, mat: "brick", facade: { floors: 1, cols: 3 } });
      const [a, b] = sheds.map((s) => (s.kind === "prism" ? s.at.x : NaN)).sort((m, n) => m - n);
      expect(b! - a!).toBeCloseTo(13, 9);
      const vaults = p.solids.filter((s) => s.kind === "vault");
      expect(vaults).toHaveLength(2);
      for (const v of vaults) expect(v).toMatchObject({ axis: "y", len: 15, w: 8, h: 2.5, mat: "sheetTeal" });
      const patio = { x0: a! + 8, x1: a! + 13 };
      const slab = p.solids.find((s) => isPrism(s, "steel", 5, 15, 0.3));
      expect(slab?.kind === "prism" && Math.abs(slab.at.x - patio.x0) < EPS && Math.abs(slab.at.z - (lot.z + 4)) < EPS).toBe(true);
      expect(p.solids.filter((s) => isPrism(s, "steel", 0.3, 0.3, 4))).toHaveLength(4);
      const bulbs = p.accents.filter((q) => q.kind === "dot" && q.color === "amber");
      expect(bulbs.length).toBeGreaterThan(4);
      for (const q of bulbs) {
        if (q.kind !== "dot") continue;
        expect(q.at.z).toBeCloseTo(lot.z + 3.4, 9);
        expect(q.at.x).toBeGreaterThanOrEqual(patio.x0 - EPS); expect(q.at.x).toBeLessThanOrEqual(patio.x1 + EPS);
      }
      const inPatio = (s: Solid) => { const bb = bounds(s); return bb.min.x >= patio.x0 - EPS && bb.max.x <= patio.x1 + EPS; };
      expect(p.solids.filter((s) => isPrism(s, "paving", 1, 1, 0.7) && inPatio(s))).toHaveLength(3);
      expect(p.solids.filter((s) => isPrism(s, "paving", 0.5, 0.5, 0.5) && inPatio(s))).toHaveLength(6);
      expect(p.slots).toEqual([]);
    }
  });
});

describe("inlet works", () => {
  it("walls: three concrete prisms 1 wide at z -1, h 1.5, framing the inlet on the north, south and east", () => {
    const { solids } = works(1);
    const walls = solids.filter((s) => s.kind === "prism" && s.mat === "concrete");
    const at = (x: number, y: number, w: number, d: number) => walls.some((s) => s.kind === "prism" && s.at.x === x && s.at.y === y && s.at.z === -1 && s.w === w && s.d === d && s.h === 1.5);
    expect(walls).toHaveLength(3);
    expect(at(282, 95, 18, 1)).toBe(true);
    expect(at(282, 114, 18, 1)).toBe(true);
    expect(at(300, 95, 1, 20)).toBe(true);
  });

  it("bollards every 6 on the north and south walls", () => {
    const bollards = works(1).solids.filter((s) => s.kind === "cylinder" && s.mat === "rust" && s.r === 0.4);
    const key = (s: Solid) => (s.kind === "cylinder" ? `${s.at.x},${s.at.y},${s.at.z}` : "");
    expect(bollards.map(key).sort()).toEqual(["285,114.5,0.5", "285,95.5,0.5", "291,114.5,0.5", "291,95.5,0.5", "297,114.5,0.5", "297,95.5,0.5"]);
  });

  it("three fishing boats inside DARSENA at z -1, not touching each other or the walls, centre on water", () => {
    const box = { min: v3(DARSENA.x0, DARSENA.y0, -2), max: v3(DARSENA.x1, DARSENA.y1, 2) };
    for (const seed of SEEDS) {
      const { solids } = works(seed);
      const boats = solids.filter((s) => s.kind === "hull");
      const walls = solids.filter((s) => s.kind === "prism" && s.mat === "concrete").map(bounds);
      expect(boats).toHaveLength(3);
      expect(BOATS).toMatchObject({ xs: [285, 291, 297], y: 98, len: 5, beam: 2, h: 0.8 }); // moored off the north wall: the market hides the south one
      const bs = boats.map(bounds);
      boats.forEach((s, i) => {
        if (s.kind !== "hull") return;
        expect(s).toMatchObject({ mat: "hull", topMat: "whitewash", len: 5, beam: 2, h: 0.8 });
        expect(s.at.z).toBe(-1);
        const h = (((s.heading ?? 0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        expect(Math.min(h, Math.abs(h - Math.PI), 2 * Math.PI - h)).toBeLessThanOrEqual(0.15 + EPS);
        const b = bs[i]!;
        expect(b.min.x).toBeGreaterThanOrEqual(box.min.x); expect(b.max.x).toBeLessThanOrEqual(box.max.x);
        expect(b.min.y).toBeGreaterThanOrEqual(box.min.y); expect(b.max.y).toBeLessThanOrEqual(box.max.y);
        expect(terrainAt((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2)).toBe("water");
        for (const w of walls) expect(planCut(b, w)).toBe(false);
        bs.forEach((o, j) => { if (j !== i) expect(planCut(b, o), `seed ${seed} boats ${i}/${j}`).toBe(false); });
      });
    }
  });

  it("three rust nets and crates on the south wall, the old crane on the north-east corner, two lamps", () => {
    const { solids, accents } = works(1);
    const onSouthWall = (s: Solid) => s.kind === "prism" && s.at.y >= 114 - EPS && s.at.y + s.d <= 115 + EPS && Math.abs(s.at.z - 0.5) < EPS;
    expect(solids.filter((s) => isPrism(s, "rust", 2, 1, 0.4) && onSouthWall(s))).toHaveLength(3);
    expect(solids.filter((s) => isPrism(s, "deck", 1, 1, 0.8) && onSouthWall(s)).length).toBeGreaterThanOrEqual(2);
    const crane = JSON.stringify(dockCrane(v3(298, 95, 0.5), "w"));
    for (const c of JSON.parse(crane) as Solid[]) expect(solids.map((s) => JSON.stringify(s))).toContain(JSON.stringify(c));
    const posts = solids.filter((s) => isPrism(s, "steel", 0.6, 0.6, 5)).map((s) => (s.kind === "prism" ? `${s.at.x},${s.at.y},${s.at.z}` : ""));
    expect(posts.sort()).toEqual(["283,115.2,0", "299,94,0"]);
    expect(accents.filter((a) => a.kind === "dot" && a.color === "amber")).toHaveLength(2);
  });

  it("fish market frontage: four crates and a scale on the north sidewalk of block 280,116", () => {
    const { solids } = works(1);
    const onSidewalk = (s: Solid) => { const b = bounds(s); return b.min.y >= 116 - EPS && b.max.y <= 117.5 + EPS && Math.abs(b.min.z - PLINTH_H) < EPS; };
    expect(solids.filter((s) => isPrism(s, "deck", 1, 1, 0.8) && onSidewalk(s))).toHaveLength(4);
    expect(solids.filter((s) => isPrism(s, "steel", 0.6, 0.6, 1.2) && onSidewalk(s))).toHaveLength(1);
  });

  it("every non-cone solid of the inlet works falls in Resume and from y 89", () => {
    for (const seed of SEEDS.slice(0, 5)) for (const s of works(seed).solids) {
      if (s.kind === "cone") continue;
      const b = bounds(s);
      expect(worldZoneAt(b.min.x, b.min.y), JSON.stringify(s).slice(0, 90)).toBe("cv");
      expect(b.min.y).toBeGreaterThanOrEqual(89);
    }
  });

  it("riprap: at least 12 rock cones r 1.6 h 1.2 along the east bank in y 90..146, centre on land, none in the inlet mouth", () => {
    for (const seed of [1, 7, 8]) {
      const rocks = works(seed).solids.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.mat === "rock");
      expect(rocks.length).toBeGreaterThanOrEqual(12);
      for (const r of rocks) {
        expect(r).toMatchObject({ r: 1.6, h: 1.2 });
        expect(r.at.y).toBeGreaterThanOrEqual(90); expect(r.at.y).toBeLessThan(146);
        expect(r.at.x).toBeGreaterThanOrEqual(eastBank(r.at.y) + 1.5 - EPS); // on the bank line, or pushed east off a cell drawn as water
        expect(isWaterAt(r.at.x, r.at.y)).toBe(false);
        expect(clearOfWater(r.at.x, r.at.y, r.at.x, r.at.y, 0)).toBe(true); // the terrain cell under the centre is land: no rock floats over water
        expect(r.at.y >= DARSENA.y0 && r.at.y < DARSENA.y1).toBe(false);
      }
    }
  });

  it("jungle to the point: at least 10 cones in x 306..330, none within 3 u of the water", () => {
    for (const [name, make] of SCENES) {
      const s = make();
      const cones = s.solids.filter((c): c is Solid & { kind: "cone" } => c.kind === "cone" && (c.mat === "leaf" || c.mat === "leafDark") && c.at.y >= 90 && c.at.y <= 146);
      expect(cones.filter((c) => c.at.x >= 306 && c.at.x <= 330).length, name).toBeGreaterThanOrEqual(10);
    }
    for (const seed of SEEDS) for (const c of works(seed).solids) {
      if (c.kind !== "cone" || c.mat === "rock") continue;
      const b = bounds(c);
      expect(clearOfWater(b.min.x, b.min.y, b.max.x, b.max.y, 3)).toBe(true);
    }
  });
});

describe("the inlet in the city", () => {
  for (const [name, make] of SCENES) {
    it(`the two fixed pieces stand on their blocks (${name})`, () => {
      const placed = make().placed.map((p) => `${p.placed.recipe}@${p.placed.block.x},${p.placed.block.y}`);
      expect(placed).toContain("fishMarket@280,116");
      expect(placed).toContain("foodHall@280,140");
    });

    it(`no solid of the city hides a boat from the camera (${name})`, () => {
      const s = make(), boats = s.solids.filter((x) => x.kind === "hull" && x.mat === "hull").map(bounds);
      expect(boats).toHaveLength(3);
      for (const b of boats) for (const o of s.solids) {
        const ob = bounds(o);
        if (o.kind === "hull" || isFlat(o) || (o.kind === "prism" && o.mat === "concrete" && o.at.z === -1)) continue; // the inlet's own walls rise 0.5 over the water, by design
        expect(hides(b, ob, { back: screenHull(b), front: screenHull(ob) }), JSON.stringify(o).slice(0, 90)).toBe(false);
      }
    });

    it(`no car parks on the inlet's walls (${name})`, () => {
      const area = { min: v3(280, 94, 0), max: v3(302, 116, 0) };
      for (const s of make().solids) if (isPrism(s, "rust", CAR.w, CAR.d, 1.2) || isPrism(s, "steel", CAR.w, CAR.d, 1.2)) expect(planCut(bounds(s), area), JSON.stringify(bounds(s))).toBe(false);
    });
  }
});
