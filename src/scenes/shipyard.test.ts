import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { WORLD, inStationLand, northCoastY } from "../map/geo";
import { allIsoColors } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { AREA_H, AREA_W, STREET_EDGE, shipyard, type Scene } from "./shipyard";
import { BUFFER_X, ESPLANADE, STATION } from "./station";

const scene = (): Scene => shipyard(createRng(7));
const all = (s: Scene): Solid[] => [...s.ground, ...s.solids, s.trolley];

describe("shipyard", () => {
  it("is deterministic by seed", () => {
    expect(JSON.stringify(shipyard(createRng(7)))).toBe(JSON.stringify(shipyard(createRng(7))));
    expect(JSON.stringify(shipyard(createRng(7)))).not.toBe(JSON.stringify(shipyard(createRng(8))));
  });

  it("everything falls inside the area", () => {
    for (const s of all(scene())) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 1);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1);
      expect(b.max.x).toBeLessThanOrEqual(AREA_W + 1);
      expect(b.max.y).toBeLessThanOrEqual(AREA_H + 1);
    }
  });

  it("there are gable sheds at the fitting-out quay, ramp slipways, a hull, ribs and a gantry", () => {
    const s = scene();
    const kinds = (k: Solid["kind"]) => s.solids.filter((x) => x.kind === k);
    const gables = s.solids.filter((x) => x.kind === "prism" && x.roof === "gable");
    expect(gables.filter((x) => x.kind === "prism" && x.at.x > 300)).toHaveLength(2); // the sheds of the fitting-out quay
    expect(kinds("ramp").filter((r) => r.kind === "ramp" && r.at.z === 0)).toHaveLength(2); // the slipways; the sawtooth roofs go up high
    expect(kinds("hull").length).toBeGreaterThanOrEqual(1);
    expect(s.weldSpots.length).toBeGreaterThan(10);
    const tall = s.solids.filter((x) => bounds(x).max.z >= 24);
    expect(tall.length).toBeGreaterThanOrEqual(3); // two legs and the beam
  });

  it("the trolley is on the beam and its range fits between the slipways", () => {
    const s = scene();
    expect(s.trolley.at.z).toBeGreaterThanOrEqual(24);
    expect(s.trolleyRange[0]).toBeLessThan(s.trolleyRange[1]);
    expect(s.trolley.at.y).toBe(s.trolleyRange[0]);
  });

  it("the shipyard accents outside the station are cyan; those of the station are cyan, cyanMid or magenta", () => {
    const s = scene();
    // poly: the building's windows, lantern and dials (#278), located by their first vertex
    const where = (a: Accent) => (a.kind === "dot" ? a.at : a.pts[0]!);
    const inStation = (a: Accent) => { const p = where(a); return p.x >= 110 && p.x <= STATION.x1 && p.y >= 100 && p.y <= STATION.y1; };
    const outside = s.accents.filter((a) => !inStation(a)), inside = s.accents.filter(inStation);
    expect(outside.length).toBeGreaterThanOrEqual(7); // five street lamps and two quay lamps
    expect(outside.every((a) => a.kind === "dot" && a.color === "cyan" && a.at.z > 0)).toBe(true);
    expect(inside.length).toBeGreaterThanOrEqual(11); // eight canopy lights and three buffer lights
    expect(inside.every((a) => a.kind === "dot" ? ["cyan", "cyanMid", "magenta", "amber"].includes(a.color) && a.at.z > 0 : ["amber", "amberBleed", "cyanBleed"].includes(a.color))).toBe(true);
  });

  it("the whole render uses atlas colors", () => {
    const s = scene();
    const colors = allIsoColors();
    for (const i of buildRenderList(all(s))) expect(colors.has(i.color)).toBe(true);
  });
});

describe("shipyard part 2", () => {
  it("dry dock: pit with walls, gate and a sunken hull", () => {
    const s = scene();
    const sunk = s.solids.filter((x) => bounds(x).min.z <= -5);
    expect(sunk.length).toBeGreaterThanOrEqual(6); // 4 walls + gate + hull
    expect(sunk.some((x) => x.kind === "hull")).toBe(true);
    expect(s.ground.some((g) => g.kind === "ground" && g.tris.length > 0 && g.tris.every((t) => t.pts.every((p) => p.z === -6)))).toBe(true);
  });

  it("jungle: cones in the east strip and the station esplanade, none south of 90 outside the station land", () => {
    const s = scene();
    const cones = s.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark"));
    expect(cones.length).toBeGreaterThanOrEqual(5); // measured 5 (seed 7) after the cuts
    // the palms of the station esplanade (#278) are at x 190..197, outside the shipyard slab
    for (const c of cones) {
      expect(c.at.x > 300 || (c.at.x > ESPLANADE.x0 && c.at.x < ESPLANADE.x1), `cone ${c.at.x},${c.at.y}`).toBe(true);
      expect(c.at.y <= 90 || inStationLand(c.at.x, c.at.y), `cone ${c.at.x},${c.at.y}`).toBe(true);
    }
  });

  it("fitting-out quay: gable sheds east of the river and riprap", () => {
    const s = scene();
    const sheds = s.solids.filter((x) => x.kind === "prism" && x.roof === "gable" && x.at.x > 300);
    expect(sheds).toHaveLength(2);
    const rocks = s.solids.filter((x) => x.kind === "cone" && x.mat === "rock");
    expect(rocks.length).toBeGreaterThan(20); // measured 27 (seed 7) with the riprap only north of 90
  });

  it("the riprap borders the new coast of the north headland", () => {
    const rocks = scene().solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && x.mat === "rock");
    expect(rocks.filter((r) => r.at.y < 30 && r.at.x < 300).length).toBeGreaterThanOrEqual(4);
    for (const r of rocks) expect(r.at.y).toBeGreaterThanOrEqual(northCoastY(r.at.x) - 2);
  });

  it("lamps: steel post with cyan light on top", () => {
    const s = scene();
    const poles = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.w === 0.6 && x.h === 5 && x.at.x > STREET_EDGE && x.at.x < STREET_EDGE + 2);
    expect(poles.length).toBeGreaterThanOrEqual(5);
    for (const p of poles) expect(s.accents.some((a) => a.kind === "dot" && Math.abs(a.at.x - p.at.x) < 1 && Math.abs(a.at.y - p.at.y) < 1 && a.at.z === 5)).toBe(true);
  });
});

describe("shipyard without the new region (#242)", () => {
  const prisms = (s: Scene) => s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism");
  const rails = (s: Scene) => s.ground.filter((x): x is Solid & { kind: "strip" } => x.kind === "strip" && x.mat === "rail");

  it("the new region (x 4..99, y −4..99) stays empty except for jungle cones and the seam fence", () => {
    for (const x of scene().solids) {
      if (x.kind === "cone") continue;
      const b = bounds(x);
      if (b.min.y >= 88.2) continue; // the seam fence and its lamps (#319)
      expect(b.min.x < 99 && b.max.x > 4 && b.min.y < 99 && b.max.y > -4, JSON.stringify(b)).toBe(false);
    }
  });

  it("no hall→slipway rails, spur set into the street or spur to the yard", () => {
    for (const r of rails(scene())) {
      for (const x of [101, 104]) expect(r.path.every((p) => p.x === x), `vertical at x ${x}`).toBe(false);
      for (const y of [40, 47, 60, 67, 30.5, 33.5]) expect(r.path.every((p) => p.y === y), `horizontal at y ${y}`).toBe(false);
    }
  });

  it("the old does not return to its old place: halls, workshops, yard tanks or flatcars (#247)", () => {
    const s = scene();
    const ps = prisms(s);
    expect(ps.filter((x) => x.roof === "gable" && x.w === 90 && x.d === 16 && (x.at.y === 36 || x.at.y === 56))).toEqual([]); // halls at ROW_Y
    expect(ps.filter((x) => x.roof === "step" && x.w === 24 && x.d === 14 && x.at.y === 80)).toEqual([]);                     // old workshops
    expect(ps.filter((x) => x.w === 4.4 && x.d === 8 && x.h === 3)).toEqual([]);                                               // flatcars
    const cyl = s.solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
    expect(cyl.filter((c) => (c.at.x === 80 && c.at.y === 10) || (c.at.x === 92 && c.at.y === 22))).toEqual([]); // tanks of the old yard
  });

  it("no shipyard rail west of 96 and the station draws track 3 from 96 to the buffer; the street truck remains", () => {
    const s = scene();
    for (const r of rails(s)) expect(Math.min(...r.path.map((p) => p.x))).toBeGreaterThanOrEqual(96);
    for (const y of [131, 134]) {
      expect(rails(s).some((r) => r.path.length === 2 && r.path[0]!.x === 96 && r.path[0]!.y === y && r.path[1]!.x === BUFFER_X && r.path[1]!.y === y), `station y ${y}`).toBe(true);
    }
    expect(prisms(s).filter((x) => x.mat === "rust" && x.w === 1 && x.d === 5 && x.h === 0.3 && x.at.y === 130).length).toBe(13); // the station sleepers, x 110..158 (the west ones are the hinterland and Resume)
    expect(prisms(s).some((x) => x.mat === "rust" && x.at.x === 105 && x.at.y === 88 && x.w === 3 && x.d === 7 && x.h === 2.5)).toBe(true);
  });
});

describe("shipyard in the north band (#247)", () => {
  const prisms = (s: Scene) => s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism");
  const cylinders = (s: Scene) => s.solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
  const at = (x: Solid & { kind: "prism" }) => [x.at.x, x.at.y, x.at.z];
  const box = (ss: Solid[]) => {
    const bs = ss.map(bounds);
    return { x0: Math.min(...bs.map((b) => b.min.x)), y0: Math.min(...bs.map((b) => b.min.y)), x1: Math.max(...bs.map((b) => b.max.x)), y1: Math.max(...bs.map((b) => b.max.y)) };
  };
  type Box = ReturnType<typeof box>;
  const apart = (a: Box, b: Box) => a.x1 <= b.x0 + 1e-9 || b.x1 <= a.x0 + 1e-9 || a.y1 <= b.y0 + 1e-9 || b.y1 <= a.y0 + 1e-9;

  const halls = (s: Scene) => prisms(s).filter((x) => x.roof === "gable" && x.w === 90 && x.d === 16 && x.h === 10 && x.mat === "concrete");
  const forklifts = (s: Scene) => prisms(s).filter((x) => x.at.z === 0 && x.h === 2 && ((x.mat === "rust" && x.w === 2 && x.d === 3) || (x.mat === "steel" && x.w === 3 && x.d === 2)) && x.at.y < 0);
  const workshops = (s: Scene) => prisms(s).filter((x) => x.roof === "step" && x.w === 24 && x.d === 14 && x.h === 7 && x.mat === "concrete");
  const units = (s: Scene) => prisms(s).filter((x) => x.mat === "steel" && x.w === 2 && x.d === 2 && x.h === 1 && x.at.z === 7);
  const yard = (s: Scene): Solid[] => [
    ...prisms(s).filter((x) => (x.w === 10 && x.d === 2 && x.h === 0.5) || (x.w === 14 && x.d === 1 && x.h === 1) || (x.roof === "step" && x.w === 9 && x.d === 4 && x.h === 3)),
    ...cylinders(s).filter((c) => (c.r === 1.5 && c.h === 1.5) || (c.mat === "concrete" && ((c.at.x === 174 && c.at.y === -54) || (c.at.x === 186 && c.at.y === -42)))),
  ];
  const band = (s: Scene) => s.solids.filter((x) => x.kind !== "cone" && bounds(x).max.y < 0 && bounds(x).min.x < 198);

  it("gable halls: two 90×16×10 gables at HALL_ROWS_Y with 4 forklifts", () => {
    const s = scene();
    expect(halls(s).map(at)).toEqual([[10, -52, 0], [10, -32, 0]]);
    expect(Math.max(...halls(s).map((h) => bounds(h).max.z))).toBeCloseTo(13.5, 9); // ridge
    const fl = forklifts(s).map((x) => [x.mat, x.at.x, x.at.y]);
    expect(fl).toHaveLength(4);
    expect(fl).toEqual(expect.arrayContaining([["rust", 92, -50], ["rust", 92, -30], ["steel", 12, -41], ["steel", 12, -21]]));
  });

  it("workshops with a stepped roof and equipment on the roof", () => {
    const s = scene();
    const ws = workshops(s);
    expect(ws.map(at)).toEqual([[106, -33, 0], [134, -33, 0]]);
    expect(units(s).map((x) => [x.at.x, x.at.y]).sort((a, b) => a[0]! - b[0]!)).toEqual([[109, -30], [124, -23], [137, -30], [152, -23]]);
  });

  it("material yard: cylindrical tanks and stacked piles, moved (+94, −64)", () => {
    const s = scene();
    expect(cylinders(s).filter((c) => c.r >= 4).length).toBeGreaterThanOrEqual(3); // two in the yard, one at the fitting-out quay
    expect(s.solids.filter((x) => x.kind === "prism" && x.at.z > 0 && x.at.z < 3 && x.h <= 1).length).toBeGreaterThanOrEqual(5); // stacked
    const plates = prisms(s).filter((x) => x.w === 10 && x.d === 2 && x.h === 0.5);
    expect(plates.filter((x) => x.at.z === 0).map(at)).toEqual([[104, -58, 0], [118, -58, 0], [104, -50, 0], [118, -50, 0], [132, -56, 0]]);
    const pipes = prisms(s).filter((x) => x.w === 14 && x.d === 1 && x.h === 1 && x.mat === "rust");
    expect(pipes).toHaveLength(12);
    expect(pipes.filter((x) => x.at.y === -42 || x.at.y === -44).map((x) => [x.at.x, x.at.y])).toEqual([[104, -42], [122, -42], [140, -44]]);
    const coils = cylinders(s).filter((c) => c.r === 1.5 && c.h === 1.5 && c.mat === "rust" && c.sides === 8);
    expect(coils.map((c) => [c.at.x, c.at.y])).toEqual([[149, -57], [154, -57], [159, -57], [149, -52], [154, -52], [159, -52]]);
    const sections = prisms(s).filter((x) => x.roof === "step" && x.w === 9 && x.d === 4 && x.h === 3 && x.mat === "steel");
    expect(sections.map(at)).toEqual([[150, -46, 0], [162, -46, 0], [150, -40, 0], [162, -40, 0]]);
    const tanks = cylinders(s).filter((c) => c.mat === "concrete" && c.at.y < 0).map((c) => [c.at.x, c.at.y, c.r, c.h]);
    expect(tanks).toEqual([[174, -54, 5, 8], [186, -42, 4, 6]]);
    const b = box(yard(s));
    expect(b.x0).toBeGreaterThanOrEqual(104); expect(b.x1).toBeLessThanOrEqual(192);
    expect(b.y0).toBeGreaterThanOrEqual(-59); expect(b.y1).toBeLessThanOrEqual(-35.7);
  });

  it("the rng (seed 7): no prefabricated sections, nothing of the parking lot or the scrap (#319)", () => {
    const ps = prisms(scene());
    expect(ps.filter((x) => x.mat === "steel" && x.w === 9 && x.d === 5 && x.h === 3)).toEqual([]);
    expect(ps.filter((x) => x.h === 1.5 && x.w === 3)).toEqual([]);
    expect(ps.filter((x) => x.w === 3 && x.d === 2 && x.h === 1 && x.at.x >= 302)).toEqual([]);
  });

  it("nothing is left of the boiler shop (#277)", () => {
    const s = scene();
    expect(s.solids.filter((x) => x.kind === "ramp" && x.at.z === 9)).toEqual([]);                                 // sawtooth roofs
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "rust" && x.r === 2.2)).toEqual([]);          // chimneys
    expect(prisms(s).filter((x) => x.roof === "gable" && x.at.x === 112 && x.at.y === 126)).toEqual([]);           // paint hall
    expect(prisms(s).filter((x) => x.mat === "steel" && x.at.x === 183.6)).toEqual([]);                            // rack
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.at.x === 190 && x.r === 4)).toEqual([]);              // tanks
  });

  it("quay lamps at y 20 and 80 (in quay()); none at y 120 or at (112, 124) / (174, 124) (#277)", () => {
    const s = scene();
    const lampAt = (x: number, y: number) => prisms(s).some((p) => p.mat === "steel" && p.w === 0.6 && p.h === 5 && p.at.x === x && p.at.y === y);
    expect(lampAt(198 - 1.4, 20)).toBe(true); expect(lampAt(198 - 1.4, 80)).toBe(true);
    expect(lampAt(198 - 1.4, 120)).toBe(false); expect(lampAt(112, 124)).toBe(false); expect(lampAt(174, 124)).toBe(false);
    for (const y of [20, 80]) expect(s.accents.some((a) => a.kind === "dot" && a.color === "cyan" && a.at.x === 198 - 1.4 + 0.3 && a.at.y === y + 0.3 && a.at.z === 5)).toBe(true);
  });

  it("halls ↔ workshops ↔ yard apart (disjoint boxes, 1e-9)", () => {
    const s = scene();
    const ws = workshops(s), us = units(s);
    const groups: Box[] = [
      ...halls(s).map((h) => box([h])),
      ...ws.map((w) => box([w, ...us.filter((u) => u.at.x >= w.at.x && u.at.x < w.at.x + w.w)])),
      box(yard(s)),
    ];
    expect(groups).toHaveLength(5);
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) expect(apart(groups[i]!, groups[j]!), `${i} ↔ ${j}`).toBe(true);
  });

  it("the north band: every solid with max.y < 0 (except quay, bollards and cones) falls in x 10..192, y −59..−13 and does not exceed z 22", () => {
    const bs = band(scene()).map(bounds);
    expect(bs.length).toBeGreaterThanOrEqual(40); // halls, forklifts, workshops, equipment and yard: without this it would pass empty
    for (const b of bs) {
      const where = JSON.stringify(b);
      expect(b.min.x, where).toBeGreaterThanOrEqual(10); expect(b.max.x, where).toBeLessThanOrEqual(192);
      expect(b.min.y, where).toBeGreaterThanOrEqual(-59); expect(b.max.y, where).toBeLessThanOrEqual(-13);
      expect(b.max.z, where).toBeLessThanOrEqual(22);
    }
  });
});
