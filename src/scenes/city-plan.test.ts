import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import {
  AXES, BRIDGE_LANDING, CITY_BOUNDS, COASTAL_CUT_Y, HOTEL_LOT, LAND, PLAN_BOUNDS, PLAZA_CENTER, PLAZA_MAYOR,
  axisBand, barrioAt, crossingPlazas, intersectionArea, parcels, pointInPoly, polyArea, polyPerimeter,
} from "./city-plan";

/** Issue #472 (Trazado): the pure layout of the west bank. Plan: docs/plans/2026-11-23-472-trazado-city-plan.md. */

const rectPoly = (r: { x: number; y: number; w: number; d: number }): Vec2[] => [
  { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.d }, { x: r.x, y: r.y + r.d },
];
const box = (p: readonly Vec2[]) => ({
  x0: Math.min(...p.map((q) => q.x)), y0: Math.min(...p.map((q) => q.y)),
  x1: Math.max(...p.map((q) => q.x)), y1: Math.max(...p.map((q) => q.y)),
});
const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** Proper intersection of two segments (shared endpoints and collinear touches do not count). */
const segsCross = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean => {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
};
const isSimple = (p: readonly Vec2[]): boolean => {
  const n = p.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue; // adjacent through the closing edge
    if (segsCross(p[i]!, p[(i + 1) % n]!, p[j]!, p[(j + 1) % n]!)) return false;
  }
  return true;
};
const SOUTH_BOUNDS = { ...PLAN_BOUNDS, y0: COASTAL_CUT_Y, y1: 475 }; // #493: the coastal parcels start at the cut; the 348..378 row is in PLAN_BOUNDS

describe("city-plan axes (#472)", () => {
  it("AXES match the table, exact values, in that order", () => { // #493: bulevar and costanera end at 714 (WORLD.y1 + BLEED.y)
    expect(AXES.map((a) => ({ id: a.id, name: a.name, from: a.from, to: a.to, w: a.w, kind: a.kind }))).toEqual([
      { id: "costanera", name: "Costanera", from: { x: 188, y: 160 }, to: { x: 188, y: 714 }, w: 8, kind: "costanera" },
      { id: "plaza", name: "Avenida de la Plaza", from: { x: 132, y: 228 }, to: { x: -440, y: 228 }, w: 12, kind: "avenue" },
      { id: "diagonalNorte", name: "Diagonal Norte", from: { x: 132, y: 210 }, to: { x: -14, y: 169 }, w: 10, kind: "diagonal" },
      { id: "diagonalSur", name: "Diagonal Sur", from: { x: 132, y: 320 }, to: { x: -420, y: 551 }, w: 10, kind: "diagonal" },  // #493: 30 u south
      { id: "bulevar", name: "Bulevar Central", from: { x: 10, y: 160 }, to: { x: 10, y: 714 }, w: 20, kind: "boulevard" },
      { id: "vias", name: "Avenida de las Vías", from: { x: 184, y: 169 }, to: { x: -440, y: 169 }, w: 10, kind: "avenue" },
      { id: "sur", name: "Avenida del Sur", from: { x: 184, y: 348 }, to: { x: -440, y: 348 }, w: 10, kind: "avenue" },  // #493: y 348
      { id: "barrio", name: "Avenida del Barrio", from: { x: 184, y: 378 }, to: { x: -440, y: 378 }, w: 10, kind: "avenue" },
    ]);
  });

  it("the Diagonal Norte ends on the Avenida de las Vías (y 169)", () => {
    expect(AXES.find((a) => a.id === "diagonalNorte")!.to.y).toBe(169);
  });

  it("axisBand is the rectangle of width w around the segment", () => {
    const plaza = axisBand(AXES.find((a) => a.id === "plaza")!);
    expect(plaza).toHaveLength(4);
    expect(box(plaza)).toEqual({ x0: -440, y0: 222, x1: 132, y1: 234 });
  });
});

describe("city-plan crossing plazas (#472)", () => {
  const plazas = crossingPlazas();
  const centers = plazas.map((p) => ({ x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length }));

  it("three octagons, at (10, 175.7), (10, 371.05) and (65.1, 348)", () => {
    expect(plazas).toHaveLength(3);
    for (const p of plazas) expect(p).toHaveLength(8);
    const want = [{ x: 10, y: 175.7 }, { x: 10, y: 371.05 }, { x: 65.1, y: 348 }]; // #493: the Diagonal Sur moved 30 u south (was (10, 342.1) and (67.5, 318))
    for (const w of want) expect(centers.some((c) => Math.hypot(c.x - w.x, c.y - w.y) < 0.2), `${w.x}, ${w.y}`).toBe(true);
  });

  it("each center is farther than 50 from PLAZA_CENTER and farther than 26 from the others", () => {
    centers.forEach((c, i) => {
      expect(Math.hypot(c.x - PLAZA_CENTER.x, c.y - PLAZA_CENTER.y)).toBeGreaterThan(50);
      centers.forEach((o, j) => { if (i !== j) expect(Math.hypot(c.x - o.x, c.y - o.y)).toBeGreaterThan(26); });
    });
  });
});

describe("city-plan barrios (#472)", () => {
  it("barrioAt on the four reference points", () => {
    expect(barrioAt(PLAZA_CENTER)).toBe("clasico");
    expect(barrioAt({ x: 100, y: 400 })).toBe("residencial");
    expect(barrioAt({ x: -200, y: 200 })).toBe("moderno");
    expect(barrioAt({ x: -200, y: 300 })).toBe("transicion");
  });
});

describe("city-plan parcels (#472)", () => {
  const all = [...parcels(PLAN_BOUNDS), ...parcels(SOUTH_BOUNDS)]; // #493: PLAN_BOUNDS (to y 378) replaces CITY_BOUNDS, so the 348..378 row is checked against bands, plaza, crossing plazas
  const holes: { name: string; poly: Vec2[] }[] = [
    ...AXES.map((a) => ({ name: `axis ${a.id}`, poly: axisBand(a) })),
    { name: "PLAZA_MAYOR", poly: rectPoly(PLAZA_MAYOR) },
    ...crossingPlazas().map((poly, i) => ({ name: `crossing plaza ${i}`, poly })),
  ];

  it("every parcel is a simple polygon of ≥ 3 vertices, area ≥ 70, radius ≥ 3.4 and smaller box side ≥ 9", () => {
    for (const p of all) {
      const tag = `${p.cell.col},${p.cell.row}`;
      expect(p.poly.length, tag).toBeGreaterThanOrEqual(3);
      expect(isSimple(p.poly), tag).toBe(true);
      const a = polyArea(p.poly);
      expect(a, tag).toBeGreaterThanOrEqual(70);
      expect((2 * a) / polyPerimeter(p.poly), tag).toBeGreaterThanOrEqual(3.4);
      const b = box(p.poly);
      expect(Math.min(b.x1 - b.x0, b.y1 - b.y0), tag).toBeGreaterThanOrEqual(9);
    }
  });

  it("no parcel intersects an axis band, PLAZA_MAYOR, or a crossing plaza", () => {
    for (const p of all) for (const h of holes) expect(intersectionArea(p.poly, h.poly), `${p.cell.col},${p.cell.row} × ${h.name}`).toBeLessThan(1e-6);
  });

  it("HOTEL_LOT is exactly one parcel and no other parcel touches it", () => {
    const city = parcels(CITY_BOUNDS);
    const hotel = city.filter((p) => p.rect.x === HOTEL_LOT.x && p.rect.y === HOTEL_LOT.y && p.rect.w === HOTEL_LOT.w && p.rect.d === HOTEL_LOT.d);
    expect(hotel).toHaveLength(1);
    expect(hotel[0]!.cell).toEqual({ col: 73, row: 231 });
    expect(hotel[0]!.poly).toHaveLength(4);
    for (const p of city) if (p !== hotel[0]) expect(intersectionArea(p.poly, rectPoly(HOTEL_LOT)), `${p.cell.col},${p.cell.row}`).toBeLessThan(1e-6);
  });

  it("no parcel reaches y < 164 nor x > 184", () => {
    expect(LAND).toEqual({ y0: 164, x1: 184 });
    for (const p of all) for (const q of p.poly) {
      expect(q.y).toBeGreaterThanOrEqual(164 - 1e-9);
      expect(q.x).toBeLessThanOrEqual(184 + 1e-9);
    }
  });

  it("the rect of each parcel lies inside its poly and equals a rectangular parcel", () => {
    for (const p of all) {
      const tag = `${p.cell.col},${p.cell.row}`;
      expect(p.rect.w, tag).toBeGreaterThan(0);
      expect(p.rect.d, tag).toBeGreaterThan(0);
      // corners pulled 1e-6 toward the center: a corner on the boundary counts as inside
      const cx = p.rect.x + p.rect.w / 2, cy = p.rect.y + p.rect.d / 2;
      for (const q of rectPoly(p.rect)) expect(pointInPoly(q.x + (cx - q.x) * 1e-6, q.y + (cy - q.y) * 1e-6, p.poly), tag).toBe(true);
      expect(intersectionArea(p.poly, rectPoly(p.rect)), tag).toBeCloseTo(p.rect.w * p.rect.d, 6);
      const b = box(p.poly), rectangular = Math.abs(polyArea(p.poly) - (b.x1 - b.x0) * (b.y1 - b.y0)) < 1e-6;
      if (rectangular) expect(p.rect, tag).toEqual({ x: b.x0, y: b.y0, w: b.x1 - b.x0, d: b.y1 - b.y0 });
    }
  });

  it("the rect of every CITY_BOUNDS parcel is at least 6 on each side (lot minus sidewalks ≥ 3)", () => {
    for (const p of parcels(PLAN_BOUNDS)) expect(Math.min(p.rect.w, p.rect.d), `${p.cell.col},${p.cell.row}`).toBeGreaterThanOrEqual(6);
  });

  it("parcel counts: 70..95 over the cover north of the cut (378), 20..30 coastal ones down to y 475, 70 in CITY_BOUNDS", () => {
    // Measured while planning: 63 and 111 over the whole cover width (PLAN_BOUNDS), the parent's measure 1;
    // CITY_BOUNDS had stopped at CITY_EDGE.west (−54) with 33; since #479 its x0 is −Infinity and it holds the whole cover width: 63 (measured on agent/479).
    expect(parcels(PLAN_BOUNDS).length).toBeGreaterThanOrEqual(70); // #493: 81 in PLAN_BOUNDS (was 63): the 70 of CITY_BOUNDS plus the 11 of the 348..378 row
    expect(parcels(PLAN_BOUNDS).length).toBeLessThanOrEqual(95);
    expect(parcels(SOUTH_BOUNDS).length).toBeGreaterThanOrEqual(20); // #493: SOUTH_BOUNDS starts at the cut: 24 coastal parcels down to y 475 (the old 111 counted the whole cover from y 164)
    expect(parcels(SOUTH_BOUNDS).length).toBeLessThanOrEqual(30);
    expect(parcels(CITY_BOUNDS)).toHaveLength(70); // #493: ends at y 348 (was 63 at 318)
    expect(parcels(PLAN_BOUNDS)).toHaveLength(81);
    expect(parcels(CITY_BOUNDS)).not.toBe(parcels(PLAN_BOUNDS)); // #493: different y1, different memo
  });

  it("parcels are memoized per bounds, and different bounds do not collide", () => {
    expect(parcels(PLAN_BOUNDS)).toBe(parcels({ ...PLAN_BOUNDS }));
    expect(parcels(PLAN_BOUNDS)).not.toBe(parcels(SOUTH_BOUNDS));
  });

  it("parcels come in row, then column order, and carry their barrio and distance", () => {
    const ps = parcels(CITY_BOUNDS);
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1]!.cell, b = ps[i]!.cell;
      expect(a.row < b.row || (a.row === b.row && a.col <= b.col)).toBe(true);
    }
    for (const p of ps) {
      expect(p.barrio).toBe(barrioAt(p.c));
      expect(p.d).toBeCloseTo(Math.hypot(p.c.x - PLAZA_CENTER.x, p.c.y - PLAZA_CENTER.y), 9);
    }
  });
});

describe("city-plan constants (#472)", () => {
  it("CITY_BOUNDS has no west edge (#479) and ends at the Avenida del Sur", () => {
    expect(CITY_BOUNDS).toEqual({ x0: -Infinity, y0: 164, x1: 184, y1: 348 }); // #493: 348
  });
  it("the bridge landing stands inside the plaza", () => {
    expect(intersectionArea(rectPoly(BRIDGE_LANDING), rectPoly(PLAZA_MAYOR))).toBeCloseTo(54 * 10, 6);
  });
});
