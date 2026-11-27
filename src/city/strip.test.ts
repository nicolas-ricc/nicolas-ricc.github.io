import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import { polygonDistance } from "../kit/lettering";
import { PAN_REACH_SX, inCoverQuad, inPanReach } from "../map/geo";
import { SEED, createRng } from "../map/seed";
import { PLINTH_H } from "../scenes/city-pieces";
import { STREET } from "../scenes/city-grid";
import { CITY_BOUNDS, GRID_ORIGIN, BLOCK, LAND, PITCH, inCrossingPlaza, inPlazaMayor, onAxis, parcels, type Parcel } from "../scenes/city-plan";
import { GREEN_BELT, southParcels } from "../scenes/sprawl-grid";
import { TRAIN_CLEAR } from "../scenes/station";
import { zoneRng } from "../scenes/world";
import { BARRIO_STEP, assign, builtParcels, fixedParcel, isStrip, neighborhoodOfParcel, parcelNeighborhoods, stripNeighborhoods, stripRecipe, stripZoning, catalogueFor, type CityBarrio, type Neighborhood } from "./zoning";

// #496: the city builds the strip a pan shows west of the cover, and the strip's neighborhoods are mixed.
const world = () => assign(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1));
const dot = (p: Vec2): Vec2[] => [{ x: p.x - 0.05, y: p.y - 0.05 }, { x: p.x + 0.05, y: p.y - 0.05 }, { x: p.x + 0.05, y: p.y + 0.05 }, { x: p.x - 0.05, y: p.y + 0.05 }];
const cellCentres = (y0: number, y1: number): Vec2[] => {
  const out: Vec2[] = [];
  for (let j = -10; j < 30; j++) for (let i = -20; i < 10; i++) {
    const c = { x: GRID_ORIGIN.x + PITCH * i + BLOCK / 2, y: GRID_ORIGIN.y + PITCH * j + BLOCK / 2 };
    if (c.y >= y0 && c.y <= y1) out.push(c);
  }
  return out;
};
const near = (a: Parcel, b: Parcel): boolean => polygonDistance(a.poly, b.poly) <= STREET + 1 || (Math.abs(a.cell.col - b.cell.col) <= PITCH && Math.abs(a.cell.row - b.cell.row) <= PITCH);
const step = (n: Neighborhood): number | undefined => BARRIO_STEP[n as CityBarrio];

describe("the city builds the strip north of the coastal cut (#496)", () => {
  it("the strip comes after the core and lies outside the cover", () => {
    const ps = builtParcels(), first = ps.findIndex(isStrip);
    expect(first).toBeGreaterThan(0);
    for (const [i, p] of ps.entries()) expect(isStrip(p), `${i}`).toBe(i >= first);
    for (const p of ps.filter(isStrip)) expect(inCoverQuad(p.c.x, p.c.y, 16 / 9, 30), `${p.cell.col},${p.cell.row}`).toBe(false);
    expect(ps.filter(isStrip).length).toBeGreaterThanOrEqual(20);
  });

  it("the city reaches the pan reach", () => {
    const built = [...builtParcels(), ...parcels(CITY_BOUNDS)];
    for (const c of cellCentres(176, 366)) {
      if (!inPanReach(c.x, c.y) || c.x - c.y < PAN_REACH_SX + 15 || c.x > LAND.x1 || c.y < Math.max(LAND.y0, GREEN_BELT.y1)) continue;
      if (onAxis(c.x, c.y) || inPlazaMayor(c.x, c.y) || inCrossingPlaza(c.x, c.y)) continue;
      expect(built.some((p) => polygonDistance(p.poly, dot(c)) <= 20), `${c.x},${c.y}`).toBe(true);
    }
  });

  it("a strip parcel draws only from its own rng", () => {
    const strip = (xs: ReturnType<typeof world>) => xs.filter((p) => p.parcel && isStrip(p.parcel)).map((p) => `${p.parcel!.cell.col},${p.parcel!.cell.row} ${p.recipe} ${p.tone}`);
    const a = strip(world()), b = strip(assign(zoneRng(SEED, "cv"), createRng(99)));
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it("the lab cut still works and keeps the strip zoning", () => {
    const before = stripZoning();
    const cut = assign(createRng(1), createRng(2), -60);
    expect(cut.some((p) => p.parcel && isStrip(p.parcel))).toBe(false);
    expect(stripZoning()).toBe(before);
  });
});

describe("the strip's zoning (#496)", () => {
  const cityCore = builtParcels().filter((p) => !isStrip(p)), coreNs = parcelNeighborhoods(cityCore);
  const coreOf = new Map<Parcel, Neighborhood>(cityCore.map((p, i) => [p, coreNs[i]!]));
  for (const p of southParcels()) if (!isStrip(p)) coreOf.set(p, "bajo");
  const zones = stripZoning();
  const strip = [...zones.keys()];

  it("covers the strip of the city and of the coastal neighborhood", () => {
    expect(strip.length).toBe(builtParcels().filter(isStrip).length + southParcels().filter(isStrip).length);
  });

  it("the strip reads mixed, not in bands", () => {
    const kinds = new Set(zones.values());
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    const rows = new Map<number, Set<Neighborhood>>(), counts = new Map<number, number>();
    for (const [p, n] of zones) { rows.set(p.cell.row, (rows.get(p.cell.row) ?? new Set()).add(n)); counts.set(p.cell.row, (counts.get(p.cell.row) ?? 0) + 1); }
    const full = [...counts].filter(([, k]) => k >= 4).map(([r]) => r);
    expect(full.length).toBeGreaterThan(0);
    expect(full.filter((r) => rows.get(r)!.size >= 2).length * 2).toBeGreaterThanOrEqual(full.length);
  });

  it("the south strip is mostly houses with patches of taller blocks", () => {
    const south = southParcels().filter(isStrip), bajo = south.filter((p) => zones.get(p) === "bajo");
    expect(bajo.length / south.length).toBeGreaterThanOrEqual(0.55);
    const free = south.filter((p) => zones.get(p) !== "bajo" && ![...coreOf.keys()].some((c) => near(p, c)));
    expect(free.length).toBeGreaterThanOrEqual(2);
  });

  it("core neighborhoods equal parcelNeighborhoods(core)", () => {
    const placed = world().filter((p) => p.parcel && !isStrip(p.parcel));
    for (const q of placed) expect(q.neighborhood, `${q.parcel!.cell.col},${q.parcel!.cell.row}`).toBe(coreOf.get(q.parcel!));
  });

  it("the one-step rule holds across the strip and against the core", () => {
    const all = [...strip, ...coreOf.keys()], nOf = (p: Parcel) => zones.get(p) ?? coreOf.get(p)!;
    for (const a of strip) for (const b of all) {
      if (a === b || !near(a, b)) continue;
      const sa = step(nOf(a)), sb = step(nOf(b));
      if (sa === undefined || sb === undefined) continue; // bars and civic take no part
      expect(Math.abs(sa - sb), `${a.cell.col},${a.cell.row} ${nOf(a)} vs ${b.cell.col},${b.cell.row} ${nOf(b)}`).toBeLessThanOrEqual(1);
    }
  });

  it("strip lots respect trainCap", () => {
    const strip = world().filter((p) => p.parcel && isStrip(p.parcel) && p.parcel.rect.y > TRAIN_CLEAR.y1);
    expect(strip.length).toBeGreaterThan(0);
    for (const p of strip) expect(p.lot.maxH, `${p.parcel!.cell.col},${p.parcel!.cell.row}`).toBeLessThanOrEqual((p.parcel!.rect.y - 134.5) / 1.4 - PLINTH_H);
  });

  it("city bajo strip parcels build scatterHouses, the rest their neighborhood's catalogue", () => {
    const strip = world().filter((p) => p.parcel && isStrip(p.parcel));
    for (const p of strip) {
      expect(p.neighborhood).toBe(zones.get(p.parcel!));
      if (p.neighborhood === "bajo") expect(p.recipe).toBe("scatterHouses");
      else expect(p.recipe).not.toBe("scatterHouses");
    }
  });

  it("stripRecipe: bajo is scatterHouses, any other neighborhood a recipe of its catalogue", () => {
    const p = strip[0]!;
    expect(stripRecipe("bajo", p, createRng(1))).toBe("scatterHouses");
    for (const n of ["clasico", "transicion", "moderno"] as const) for (let i = 0; i < 20; i++) expect(catalogueFor(n, p).map((r) => r.name)).toContain(stripRecipe(n, p, createRng(i)));
  });

  it("a strip parcel pinned from below by a core moderno does not end two steps above its bajo neighbour", () => {
    // chain (cells one pitch apart, polygons far apart): core moderno - strip A (moderno) - strip B (bajo) - core bajo
    const fake = (i: number): Parcel => ({ cell: { col: i * PITCH, row: 0 }, poly: [{ x: i * 1000, y: 0 }, { x: i * 1000 + 10, y: 0 }, { x: i * 1000 + 10, y: 10 }, { x: i * 1000, y: 10 }] }) as unknown as Parcel;
    const [c0, a, b, c3] = [fake(0), fake(1), fake(2), fake(3)] as const, bases = new Map<Parcel, Neighborhood>([[a, "moderno"], [b, "bajo"]]);
    const out = stripNeighborhoods([a, b], [c0, c3], ["moderno", "bajo"], (p) => bases.get(p)!);
    expect(out).toEqual(["transicion", "clasico"]);
    expect(Math.abs(step(out[0]!)! - step(out[1]!)!)).toBeLessThanOrEqual(1);
  });

  it("no strip parcel is bars, civic or fixed", () => {
    for (const p of strip) { expect(fixedParcel(p)).toBeUndefined(); expect(["bars", "civic"]).not.toContain(neighborhoodOfParcel(p)); }
  });
});
