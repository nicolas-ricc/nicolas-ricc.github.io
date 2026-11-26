import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { BLEED, WORLD } from "../map/geo";
import { SEED } from "../map/seed";
import type { FixedLight } from "../city/lights";
import { FIXED_PARCELS, builtParcels } from "../city/zoning";
import * as plan from "./city-plan";
import { AXES, CITY_BOUNDS, HOTEL_LOT, PLAN_BOUNDS, PLAZA_CENTER, PLAZA_MAYOR, axis, axisBand, barrioAt, crossingPlazas, intersectionArea, parcels, pointInPoly } from "./city-plan";
import { hotel } from "./sign-hotel";
import { builtAt, southParcels } from "./sprawl-grid";
import { tech } from "./tech";
import { ARENA, AUDITORIUM, CLUB, PLAZAS, SCHOOL } from "./tech-zoning";
import { bleedTerrainAt } from "./terrain";
import { zoneRng } from "./world";

// Acceptance criteria of #493: the layout 30 u south, one city / coastal cut at y 378, the Bulevar Central and the Costanera to the south edge.

const COASTAL_CUT_Y = (plan as Record<string, unknown>).COASTAL_CUT_Y as number;
const EDGE = WORLD.y1 + BLEED.y; // 714, the south edge of the bleed
const rect = (r: { x: number; y: number; w: number; d: number }) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.d }, { x: r.x, y: r.y + r.d }];

describe("layout constants (#493)", () => {
  it("plaza, centre and hotel lot stretched 30 u south", () => {
    expect(PLAZA_MAYOR).toEqual({ x: 132, y: 206, w: 54, d: 114 });
    expect(PLAZA_CENTER).toEqual({ x: 159, y: 263 });
    expect(HOTEL_LOT).toEqual({ x: 73, y: 234, w: 54, d: 81 });
  });
  it("Diagonal Sur (132, 320) → (−420, 551) and Avenida del Sur at y 348", () => {
    expect([axis("diagonalSur").from, axis("diagonalSur").to]).toEqual([{ x: 132, y: 320 }, { x: -420, y: 551 }]);
    expect([axis("sur").from.y, axis("sur").to.y]).toEqual([348, 348]);
    expect(axis("barrio").from.y).toBe(378);
  });
  it("CITY_BOUNDS ends at the Avenida del Sur (348); one cut, COASTAL_CUT_Y = 378, bounds the plan", () => {
    expect(CITY_BOUNDS.y1).toBe(348);
    expect(COASTAL_CUT_Y).toBe(378);
    expect(PLAN_BOUNDS.y1).toBe(COASTAL_CUT_Y);
  });
  it("the Bulevar Central and the Costanera run to the south edge (y ≥ 714)", () => {
    for (const id of ["bulevar", "costanera"]) expect(Math.max(axis(id).from.y, axis(id).to.y), id).toBeGreaterThanOrEqual(EDGE);
  });
});

describe("one city / coastal cut at y 378 (#493)", () => {
  const built = builtParcels(), south = southParcels();
  it("the city builds a row of clásico blocks between y 348 and 378", () => {
    const row = built.filter((p) => p.c.y > 348 && p.c.y < 378);
    expect(row.length).toBeGreaterThanOrEqual(10);
    for (const p of row) expect(p.barrio, `${p.cell.col},${p.cell.row}`).toBe("clasico");
  });
  it("the city builds nothing south of the cut, the coastal neighbourhood nothing north of it", () => {
    for (const p of built) expect(p.c.y, `${p.cell.col},${p.cell.row}`).toBeLessThan(COASTAL_CUT_Y);
    for (const p of south) expect(p.c.y, `${p.cell.col},${p.cell.row}`).toBeGreaterThan(COASTAL_CUT_Y);
  });
  it("no south parcel overlaps a city parcel", () => {
    for (const s of south) for (const b of built) expect(intersectionArea(s.poly, b.poly), `${s.cell.col},${s.cell.row} × ${b.cell.col},${b.cell.row}`).toBeLessThan(1e-6);
  });
  it("barrioAt: bajo south of the cut, never a city barrio", () => {
    expect(["bajo", "residencial"]).toContain(barrioAt({ x: 0, y: COASTAL_CUT_Y + 1 }));
    expect(barrioAt({ x: -200, y: 363 })).toBe("clasico");
  });
  it("no built parcel (city or coastal) lies on an axis band, the Plaza Mayor, a crossing plaza or the hotel lot", () => {
    const holes = [...AXES.map((a) => ({ name: a.id, poly: axisBand(a) })), { name: "plaza", poly: rect(PLAZA_MAYOR) }, { name: "hotel", poly: rect(HOTEL_LOT) }, ...crossingPlazas().map((poly, i) => ({ name: `crossing ${i}`, poly }))];
    for (const p of [...built, ...south]) for (const h of holes) expect(intersectionArea(p.poly, h.poly), `${p.cell.col},${p.cell.row} × ${h.name}`).toBeLessThan(1e-6);
  });
  it("the hotel lot is one parcel of PLAN_BOUNDS", () => {
    expect(parcels(PLAN_BOUNDS).filter((p) => p.rect.x === HOTEL_LOT.x && p.rect.y === HOTEL_LOT.y && p.rect.w === HOTEL_LOT.w && p.rect.d === HOTEL_LOT.d)).toHaveLength(1);
  });
});

describe("fixed pieces move with the layout (#493)", () => {
  it("the civic palace and the theatre face the plaza's new south edge (row 321)", () => {
    expect(FIXED_PARCELS.find((f) => f.recipe === "civicPalace")!.cell).toEqual({ col: 163, row: 321 });
    expect(FIXED_PARCELS.find((f) => f.recipe === "theatre")!.cell).toEqual({ col: 133, row: 321 });
  });
  it("every tech fixed cell is a south parcel of at least 20 × 20", () => {
    const south = southParcels();
    for (const c of [ARENA, AUDITORIUM, SCHOOL, CLUB, ...PLAZAS]) {
      const hit = south.filter((p) => p.cell.col === c.col && p.cell.row === c.row);
      expect(hit, JSON.stringify(c)).toHaveLength(1);
      expect(Math.min(hit[0]!.rect.w, hit[0]!.rect.d), JSON.stringify(c)).toBeGreaterThanOrEqual(20);
    }
  });
  it("today's hotel stays inside the longer lot", () => {
    const out: Solid[] = [], accents: Accent[] = [], lights: FixedLight[] = [];
    hotel(out, accents, lights);
    for (const s of out) {
      const q = bounds(s);
      expect(q.min.x >= HOTEL_LOT.x - 0.5 && q.max.x <= HOTEL_LOT.x + HOTEL_LOT.w + 0.5 && q.min.y >= HOTEL_LOT.y - 0.5 && q.max.y <= HOTEL_LOT.y + HOTEL_LOT.d + 0.5, JSON.stringify(q)).toBe(true);
    }
  });
});

describe("Bulevar Central and Costanera to the south edge (#493)", () => {
  const scene = tech(zoneRng(SEED, "cv", 2));
  const all = [...scene.ground, ...scene.solids];
  const onBand = (id: string, x: number, y: number) => pointInPoly(x, y, axisBand(axis(id)));
  it("bulevar: lanes, planter, trees and lamps past y 700", () => {
    expect(all.some((s) => s.kind === "strip" && s.mat === "paving" && s.width === 0.4 && s.path.some((q) => q.y > 700) && s.path.every((q) => onBand("bulevar", q.x, q.y))), "lanes").toBe(true);
    expect(all.some((s) => s.kind === "prism" && s.mat === "leafDark" && s.w === 4 && s.h === 0.3 && s.at.y + s.d > 700 && onBand("bulevar", s.at.x + 2, s.at.y)), "planter").toBe(true);
    expect(all.some((s) => s.kind === "cone" && s.at.y > 700 && Math.abs(s.at.x - 10) < 2), "trees").toBe(true);
    expect(all.some((s) => s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5 && s.at.y > 700 && onBand("bulevar", s.at.x + 0.3, s.at.y + 0.3)), "lamps").toBe(true);
  });
  it("costanera: promenade to the edge and lamps past y 700", () => {
    expect(all.some((s) => s.kind === "strip" && s.path.every((q) => q.x >= 184 && q.x <= 192) && Math.max(...s.path.map((q) => q.y)) >= EDGE), "promenade").toBe(true);
    expect(all.some((s) => s.kind === "prism" && s.mat === "steel" && s.h === 6.5 && s.at.y > 700), "lamps").toBe(true);
    expect(all.some((s) => s.kind === "cone" && s.mat === "leaf" && s.at.x === 186.6 && s.at.y > 690), "trees").toBe(true); // last tipu at 696 (every 24 from 336, y <= 708)
  });
  it("the ground under both axes is asphalt to the edge; the estuary stays water", () => {
    for (const [x, y] of [[10, 700], [-5, 710], [29, 710], [188, 710]] as const) expect(builtAt(x, y), `${x},${y}`).toBe("urban");
    expect(bleedTerrainAt(10, 700)).toBe("urban");
    expect(builtAt(60, 700)).not.toBe("urban");
    expect(builtAt(200, 700)).not.toBe("urban");
  });
});

describe("glossary (#493)", () => {
  it("the Parcel entry names the coastal cut", () => {
    const parcel = readFileSync("CONTEXT.md", "utf8").split("### Parcel")[1]!.split("###")[0]!;
    expect(parcel).toContain("COASTAL_CUT_Y");
    expect(parcel).not.toContain("north of y 318");
  });
});
