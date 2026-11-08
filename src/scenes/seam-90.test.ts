import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { CAR } from "../kit/props";
import { CELL, ESTUARY_Y0, QUAY_W, QUAY_X, SEAM_CY, STATION_LAND, WORLD, ZONE_SPLIT_Y, eastBank, estuaryEast, inStationLand, worldZoneAt } from "../map/geo";
import { SEED } from "../map/seed";
import { veilCells } from "../world/veil";
import { boxFrame, zoneFrame } from "../world/frame";
import { CITY_EDGE, ROWS, blocks, estuaryReaches } from "./city-grid";
import { EXCAVATOR, excavatorBox } from "./excavator";
import { RAIL_YARD_X } from "./factory";
import { WEST_RAIL_X0, WEST_TRACKS_X } from "./hinterland";
import { RAIL_Y } from "./shipyard";
import { GREEN_BELT, builtAt, urbanAt } from "./sprawl-grid";
import { BUFFER_X, TRACK_X0 } from "./station";
import { bleedTerrainAt, terrainAt } from "./terrain";
import { world } from "./world";

// Evals of #319 (story #56 · 1): the Portfolio/Resume seam moves from y 146 to y 90; the station stays in Portfolio.
const w = world(SEED);
const raised = (xs: Solid[]) => xs.filter((s) => !isFlat(s));
const prisms = (xs: Solid[]) => xs.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism");
const dots = (xs: Accent[]) => xs.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");

describe("geography of the seam at y 90 (#319)", () => {
  it("constants: ZONE_SPLIT_Y 90, ESTUARY_Y0 146, SEAM_CY 141 and the estuary as on main", () => {
    expect(ZONE_SPLIT_Y).toBe(90);
    expect(ESTUARY_Y0).toBe(146);
    expect(SEAM_CY).toBe(141);
    expect(estuaryEast(ESTUARY_Y0)).toBe(eastBank(SEAM_CY));
    expect(estuaryEast(146)).toBe(241); // measured on main
    expect(estuaryEast(200)).toBeCloseTo(259.9, 9); // measured on main
    expect(STATION_LAND).toEqual({ x0: 96, y0: 90, x1: 198, y1: 146 });
  });

  it("inStationLand is half-open", () => {
    expect(inStationLand(96, 90)).toBe(true);
    expect(inStationLand(95.9, 90)).toBe(false);
    expect(inStationLand(150, 146)).toBe(false);
    expect(inStationLand(197.9, 145.9)).toBe(true);
  });

  it("worldZoneAt: station land is Portfolio, the new strip is Resume", () => {
    for (const [x, y] of [[380, 118], [350, 100], [100, 80], [150, 130], [100, 95], [98, 120]] as const) expect(worldZoneAt(x, y), `${x},${y}`).toBe("portfolio");
    for (const [x, y] of [[300, 120], [60, 95], [-30, 100], [290, 100]] as const) expect(worldZoneAt(x, y), `${x},${y}`).toBe("cv");
  });

  it("CITY_EDGE.north 90, estuaryReaches anchored at ESTUARY_Y0, GREEN_BELT 116..158", () => {
    expect(CITY_EDGE).toEqual({ west: -54, north: 90, south: 324 });
    expect(estuaryReaches(estuaryEast(240))).toBeCloseTo(240, 9);
    expect(GREEN_BELT).toEqual({ y0: 116, y1: 158 });
  });

  it("bleed: industrial north of 90, urban from 90, belt with no built land", () => {
    expect(builtAt(-100, 100)).toBe("urban");
    expect(builtAt(-100, 80)).toBe("industrial");
    expect(builtAt(-100, 134)).toBeNull();
    expect(urbanAt(-57, 150)).toBe(false);
    expect(bleedTerrainAt(-100, 100)).toBe("urban");
    expect(bleedTerrainAt(-100, 80)).toBe("industrial");
  });

  it("terrain: the new strip is asphalt, the station keeps its slab, the river and east bank north of 146", () => {
    for (const [x, y] of [[50, 94], [-30, 100], [50, 140], [98, 100], [303, 100]] as const) expect(terrainAt(x, y), `${x},${y}`).toBe("asphalt");
    expect(terrainAt(150, 100)).toBe("slab");
    expect(terrainAt(220, 100)).toBe("water");
    expect(terrainAt(260, 100)).toBe("water");
    expect(terrainAt(320, 100)).toBe("jungle");
    expect(ZONE_SPLIT_Y % 6).toBe(0);
    expect(ZONE_SPLIT_Y % 18).toBe(0);
  });

  it("the water is continuous at the new seam (rows 87/93) and at the estuary anchor (141/147)", () => {
    const waterX = (y: number) => { const xs: number[] = []; for (let x = 3; x < 344; x += CELL) if (terrainAt(x, y) === "water") xs.push(x); return xs; };
    for (const [n, s] of [[87, 93], [141, 147]] as const) {
      const north = waterX(n), south = waterX(s);
      expect(north.length).toBeGreaterThan(3);
      expect(south[0]).toBe(north[0]);
      expect(Math.abs(south[south.length - 1]! - north[north.length - 1]!)).toBeLessThanOrEqual(CELL);
    }
  });

  it("veil: station land goes with Portfolio, the strip with Resume; the cell 144..150 is classified by its centre", () => {
    const cells = veilCells();
    const at = (x: number, y: number) => cells.find((c) => x >= c.x && x < c.x + c.size && y >= c.y && y < c.y + c.size)!.zone;
    expect(at(99, 117)).toBe("portfolio");
    expect(at(150, 141)).toBe("portfolio");
    expect(at(150, 147)).toBe("cv");
    expect(at(60, 95)).toBe("cv");
  });

  it("frames: Portfolio includes the whole station, Resume starts at y 90", () => {
    expect(zoneFrame("portfolio")).toEqual(boxFrame({ x0: WORLD.x0, y0: WORLD.y0, x1: 344, y1: STATION_LAND.y1 }));
    expect(zoneFrame("cv")).toEqual(boxFrame({ x0: WORLD.x0, y0: 90, x1: 344, y1: WORLD.y1 }));
  });
});

describe("Portfolio south of y 90 (#319)", () => {
  const sy = w.shipyard!, fa = w.factory!;

  it("every raised solid of shipyard and factory is north of 90.5 or on the station land (plus its quay wall)", () => {
    for (const s of [...raised(sy.solids), ...raised(fa.solids), ...fa.excavator]) {
      const b = bounds(s);
      const ok = b.max.y <= ZONE_SPLIT_Y + 0.5 || (b.min.x >= STATION_LAND.x0 - 0.5 && b.max.x <= QUAY_X + QUAY_W + 0.5 && b.max.y <= STATION_LAND.y1 + 0.5);
      expect(ok, `${s.kind}/${s.mat} x ${b.min.x}..${b.max.x} y ${b.min.y}..${b.max.y}`).toBe(true);
    }
  });

  it("no parking lot, no cars, no scrap, no jungle south of 90 outside the station land", () => {
    expect(sy.ground.some((g) => g.kind === "strip" && g.mat === "road" && g.width === 26)).toBe(false);
    expect(prisms(sy.solids).some((p) => p.w === 3 && p.d === 4 && p.h === 1.5)).toBe(false);
    expect(prisms(sy.solids).some((p) => p.mat === "rust" && p.w === 3 && p.d === 2 && p.h === 1)).toBe(false);
    for (const c of [...sy.solids, ...fa.solids]) if (c.kind === "cone" && (c.mat === "leaf" || c.mat === "leafDark") && !inStationLand(c.at.x, c.at.y)) expect(c.at.y, `cone ${c.at.x},${c.at.y}`).toBeLessThanOrEqual(ZONE_SPLIT_Y);
  });

  it("fitting-out sheds d 56 at y 24, silo at (310, 86), riprap only north of 90", () => {
    const sheds = prisms(sy.solids).filter((p) => p.roof === "gable" && (p.at.x === 304 || p.at.x === 316));
    expect(sheds.map((p) => [p.at.y, p.w, p.d, p.h])).toEqual([[24, 8, 56, 6], [24, 8, 56, 6]]);
    expect(sy.solids.some((s) => s.kind === "cylinder" && s.at.x === 310 && s.at.y === 86 && s.r === 4 && s.h === 6)).toBe(true);
    for (const s of sy.solids) if (s.kind === "cone" && s.mat === "rock" && s.at.x > QUAY_X) expect(s.at.y).toBeLessThan(ZONE_SPLIT_Y);
  });

  it("seam fence: steel mesh x −60..96 at y 89.4 h 1.2, ≥ 26 posts, six cyan lamps at y 88.2", () => {
    expect(prisms(sy.solids).some((p) => p.mat === "steel" && p.at.x === -60 && p.at.y === 89.4 && p.w === 156 && p.d === 0.6 && p.h === 1.2)).toBe(true);
    const posts = prisms(sy.solids).filter((p) => p.mat === "steel" && p.at.y === 89.3 && p.w === 0.3 && p.d === 0.3 && p.h === 1.6);
    expect(posts.length).toBeGreaterThanOrEqual(26);
    const xs = [-48, -24, 0, 24, 48, 72];
    for (const x of xs) {
      expect(prisms(sy.solids).some((p) => p.mat === "steel" && p.at.x === x && p.at.y === 88.2 && p.w === 0.6 && p.h === 5), `pole ${x}`).toBe(true);
      expect(dots(sy.accents).some((a) => a.color === "cyan" && Math.abs(a.at.x - x - 0.3) < 1e-9 && Math.abs(a.at.y - 88.5) < 1e-9 && a.at.z === 5), `lamp ${x}`).toBe(true);
    }
  });

  it("the shipyard draws no west track west of 96; station track 3 runs from 96 to the buffer", () => {
    expect(TRACK_X0).toEqual([134, 121, 96]);
    const rails = sy.ground.filter((g) => g.kind === "strip" && g.mat === "rail" && g.path.length === 2 && Math.abs(g.path[0]!.y - g.path[1]!.y) < 1e-9);
    for (const g of rails) if (g.kind === "strip") expect(Math.min(...g.path.map((p) => p.x))).toBeGreaterThanOrEqual(96);
    for (const y of RAIL_Y) expect(rails.some((g) => g.kind === "strip" && g.path[0]!.y === y && g.path[0]!.x === 96 && g.path[1]!.x === BUFFER_X), `rail y ${y}`).toBe(true);
    expect(prisms(sy.solids).some((p) => p.at.x === 105 && p.at.y === 88)).toBe(true); // the street truck stays
  });

  it("excavator 6 north: axle at (−14, 54), box ends at y ≤ 88.4", () => {
    expect(EXCAVATOR.at).toEqual({ x: -30, y: 70 });
    expect(excavatorBox().y1).toBeLessThanOrEqual(88.4);
  });

  it("factory rail yard: tracks end at y 86 with buffers, no junction, stockpiles at y ≤ 87", () => {
    const steel = fa.ground.filter((g) => g.kind === "strip" && g.mat === "steel");
    for (const g of steel) if (g.kind === "strip") for (const p of g.path) { expect(p.y).toBeLessThanOrEqual(86); expect(p.y).not.toBe(132.5); }
    for (const x of RAIL_YARD_X) expect(prisms(fa.solids).some((p) => p.mat === "steel" && p.w === 3 && p.d === 1.5 && p.h === 1.2 && p.at.y === 86 && Math.abs(p.at.x + 1.5 - x) < 1e-9), `buffer ${x}`).toBe(true);
    const piles = fa.solids.filter((s) => s.kind === "cone" && (s.mat === "rust" || s.mat === "sand") && s.at.x >= -25 && s.at.x <= -13);
    expect(piles.length).toBeGreaterThanOrEqual(5);
    for (const p of piles) if (p.kind === "cone") expect(p.at.y).toBeLessThanOrEqual(87);
  });
});

describe("bleed after the seam (#319)", () => {
  const hi = w.hinterland!, te = w.tech!;
  const isSleeper = (s: Solid) => s.kind === "prism" && s.mat === "rust" && s.w === 1 && s.d === 5 && s.h === 0.3;

  it("hinterland: everything but the west-line sleepers north of 90 and in Portfolio", () => {
    for (const s of hi.solids) {
      if (isSleeper(s)) continue;
      const b = bounds(s);
      expect(b.max.y, `${s.kind}/${s.mat} ${b.min.x},${b.min.y}`).toBeLessThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
    }
  });

  it("hinterland: trucks at 84, lamp at (−130, 86), both west sheds, tracks to 86, west rails to WORLD.x0", () => {
    for (const x of [-120, -108, -96]) expect(prisms(hi.solids).some((p) => p.at.x === x && p.at.y === 84 && p.w === 6), `truck ${x}`).toBe(true);
    expect(prisms(hi.solids).some((p) => p.at.x === -130 && p.at.y === 86 && p.h === 5)).toBe(true);
    expect(prisms(hi.solids).filter((p) => p.at.x === -190 && p.w === 36 && p.d === 14 && p.roof === "gable").length).toBe(2);
    for (const g of hi.ground) if (g.kind === "strip" && g.path.every((p) => WEST_TRACKS_X.some((x) => Math.abs(p.x - x) <= 0.8))) for (const p of g.path) expect(p.y).toBeLessThanOrEqual(86);
    const rails = hi.ground.filter((g) => g.kind === "strip" && g.mat === "rail" && g.path[0]!.x === WEST_RAIL_X0);
    expect(rails.map((g) => g.kind === "strip" && [g.path[0]!.y, g.path[1]!.x])).toEqual([[131, WORLD.x0], [134, WORLD.x0]]);
    const sleepers = hi.solids.filter(isSleeper);
    expect(sleepers.length).toBeGreaterThanOrEqual(80);
    for (const s of sleepers) { const b = bounds(s); expect(b.max.x).toBeLessThan(WORLD.x0); expect((((b.min.x % 4) + 4) % 4)).toBe(2); }
  });

  it("tech plants the green belt: ≥ 20 cones west of the content, none on the tracks", () => {
    const belt = te.solids.filter((c): c is Solid & { kind: "cone" } => c.kind === "cone" && (c.mat === "leaf" || c.mat === "leafDark") && c.at.x < WORLD.x0 && c.at.y >= GREEN_BELT.y0 && c.at.y < GREEN_BELT.y1);
    expect(belt.length).toBeGreaterThanOrEqual(20);
    for (const c of belt) for (const ry of RAIL_Y) expect(Math.abs(c.at.y - ry)).toBeGreaterThanOrEqual(c.r + 1.5);
  });
});

describe("Resume after the seam (#319)", () => {
  const ci = w.city!;

  it("the main line crosses the new strip: two rails and ballast from WORLD.x0 to 96, sleepers −58..94", () => {
    for (const y of RAIL_Y) expect(ci.ground.some((g) => g.kind === "strip" && g.mat === "rail" && g.width === 0.5 && g.path[0]!.y === y && g.path[0]!.x === WORLD.x0 && g.path[1]!.x === STATION_LAND.x0), `rail ${y}`).toBe(true);
    expect(ci.ground.some((g) => g.kind === "strip" && g.mat === "rail" && g.width === 5 && g.path[0]!.y === 132.5)).toBe(true);
    const sleepers = prisms(ci.solids).filter((p) => p.mat === "rust" && p.w === 1 && p.d === 5 && p.h === 0.3 && p.at.y === 130);
    expect(sleepers.map((p) => p.at.x)).toEqual(Array.from({ length: 39 }, (_, i) => -58 + 4 * i).filter((x) => ![-22, 6, 10, 38, 66, 70].includes(x))); // none under the four level crossings (#320)
  });

  it("the new strip west of the station holds only what #320 allows: row 92 and freight blocks with their buildings, cars, rail lands", () => {
    const strip = blocks().filter((k) => k.x + k.w <= STATION_LAND.x0 && k.y >= 90 && k.y < 164);
    const inBlock = (b: Bounds) => strip.some((k) => b.min.x >= k.x - 0.5 && b.max.x <= k.x + k.w + 0.5 && b.min.y >= k.y - 0.5 && b.max.y <= k.y + k.d + 0.5);
    const isCar = (s: Solid) => s.kind === "prism" && s.w === CAR.w && s.d === CAR.d && s.h === 1.2;
    const onRails = (b: Bounds) => b.min.y >= 128 && b.max.y <= 138.2 && b.max.z <= 3; // (south post ends at 137.8 + 0.3 = 138.1) main line, sleepers, fences, crossings, posts
    for (const s of raised(ci.solids)) {
      const b = bounds(s);
      if (b.min.x >= STATION_LAND.x0 || b.max.y > 158 || b.min.y < 90) continue;
      expect(inBlock(b) || isCar(s) || onRails(b), `${s.kind}/${s.mat} ${b.min.x},${b.min.y}`).toBe(true);
    }
  });

  it("west quay wall starts at ESTUARY_Y0", () => {
    const walls = prisms(ci.solids).filter((p) => p.mat === "plaza" && p.at.x === 192 && p.at.z === -1);
    expect(Math.min(...walls.map((p) => p.at.y))).toBe(ESTUARY_Y0);
  });

  it("street lines (#320): N-S from 90 west of the station skipping 128..137, others from 158; E-W north of ROWS[1] only y 113 and 137", () => {
    const lines = ci.ground.filter((g): g is Solid & { kind: "strip" } => g.kind === "strip" && g.width === 0.3);
    for (const g of lines) {
      const [a, b] = [g.path[0]!, g.path[g.path.length - 1]!];
      const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
      if (Math.abs(a.x - b.x) < 1e-9) {
        expect(minY, `N-S ${a.x}`).toBeGreaterThanOrEqual(a.x < STATION_LAND.x0 ? 90 : ESTUARY_Y0 + 12);
        if (a.x < STATION_LAND.x0) expect(maxY <= 128 || minY >= 137, `N-S ${a.x} crosses the track`).toBe(true);
      } else if (minY < ROWS[1]!) expect([113, 137], `E-W ${a.y}`).toContain(a.y);
    }
    expect(lines.some((g) => g.path[0]!.x < STATION_LAND.x0 && Math.abs(g.path[0]!.x - g.path[1]!.x) < 1e-9 && Math.min(g.path[0]!.y, g.path[1]!.y) === 90)).toBe(true);
  });
});
