import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { QUAY_TERRACES, inCrater } from "../scenes/city-grid";
import { HOTEL_LOT, PLAZA_MAYOR, axis, axisBand, inCrossingPlaza, pointInPoly } from "../scenes/city-plan";
import { axisSpan, crossings, crosswalks, inDomain } from "./crossings";
import { westQuay } from "./fixed";

const strictIn = (r: { x: number; y: number; w: number; d: number }, p: Vec2) => p.x > r.x + 1e-6 && p.x < r.x + r.w - 1e-6 && p.y > r.y + 1e-6 && p.y < r.y + r.d - 1e-6;
const near = (p: Vec2, q: Vec2, eps = 1e-6) => Math.abs(p.x - q.x) < eps && Math.abs(p.y - q.y) < eps;
const pair = (a: string, b: string) => [a, b].sort().join("–");

describe("axis spans (#473)", () => {
  const SPANS: Record<string, [Vec2, Vec2]> = {
    costanera: [{ x: 188, y: 164 }, { x: 188, y: 348 }], // #493: the city's street domain ends at y 348 (CITY_BOUNDS.y1)
    plaza: [{ x: 132, y: 228 }, { x: -402, y: 228 }], // the bleed's west edge (#496: spans are clipped where the terrain ends); the region bounds the domain (#479)
    diagonalNorte: [{ x: 132, y: 210 }, { x: -14, y: 169 }],
    diagonalSur: [{ x: 132, y: 320 }, { x: 132 - (28 * 552) / 231, y: 348 }], // #493: from (132, 320) to the cut at y 348
    bulevar: [{ x: 10, y: 164 }, { x: 10, y: 348 }],
    vias: [{ x: 184, y: 169 }, { x: -402, y: 169 }],
    sur: [{ x: 184, y: 348 }, { x: -402, y: 348 }],
  };

  it("axis spans match the city part of each axis", () => {
    for (const [id, [p, q]] of Object.entries(SPANS)) {
      const s = axisSpan(axis(id));
      expect(s, id).not.toBeNull();
      expect(near(s![0], p), `${id} start ${JSON.stringify(s![0])}`).toBe(true);
      expect(near(s![1], q), `${id} end ${JSON.stringify(s![1])}`).toBe(true);
      expect(inDomain(s![0]), id).toBe(true); // the far west end of an E-W axis lies outside the cover: only points inside it are in the domain
    }
    expect(axisSpan(axis("barrio"))).toBeNull();
  });
});

describe("crossings (#473)", () => {
  it("axis × axis crossings are the five of the layout", () => {
    const found = new Map<string, Vec2>();
    for (const c of crossings()) if (c.other) found.set(pair(c.a.id, c.other.id), c.at);
    const want: Record<string, Vec2> = {
      [pair("costanera", "vias")]: { x: 188, y: 169 },
      [pair("costanera", "sur")]: { x: 188, y: 348 }, // #493: the avenue at y 348
      [pair("plaza", "bulevar")]: { x: 10, y: 228 },
      [pair("bulevar", "sur")]: { x: 10, y: 348 },
      [pair("diagonalNorte", "vias")]: { x: -14, y: 169 },
    };
    expect([...found.keys()].sort()).toEqual(Object.keys(want).sort());
    for (const [k, p] of Object.entries(want)) expect(near(found.get(k)!, p), k).toBe(true);
  });

  it("no crossing center is in a plaza, a crossing plaza, the hotel lot or outside the city", () => {
    for (const c of crossings()) {
      const tag = `${c.a.id}:${c.otherId}`;
      expect(strictIn(PLAZA_MAYOR, c.at), tag).toBe(false);
      expect(inCrossingPlaza(c.at.x, c.at.y), tag).toBe(false);
      expect(strictIn(HOTEL_LOT, c.at), tag).toBe(false);
      expect(inDomain(c.at), tag).toBe(true);
    }
  });

  it("axis × street crossings", () => {
    const got = crossings().filter((c) => c.other === null).map((c) => `${c.a.id}:${c.otherId}`).sort();
    const want = [
      "costanera:y198",
      ...["x-380", "x-350", "x-320", "x-290", "x-260", "x-230", "x-200", "x-170", "x-140", "x-110", "x-80", "x-50", "x-20", "x40", "x70", "x100", "x130"].map((s) => `plaza:${s}`), // x 130: the tower island left with #474; x −80 and west: #479 (measured on agent/479 with the west streets)
      ...["x40", "x70", "x100", "x130", "y198"].map((s) => `diagonalNorte:${s}`),
      ...["x100", "x130"].map((s) => `diagonalSur:${s}`),
      ...["y198", "y258", "y288", "y318"].map((s) => `bulevar:${s}`),
      ...["x-380", "x-350", "x-320", "x-290", "x-260", "x-230", "x-200", "x-170", "x-140", "x-110", "x-80", "x-50", "x-20", "x40", "x70", "x100", "x130", "x160"].map((s) => `vias:${s}`), // #496: x −380..−320 in the strip
      ...["x-380", "x-350", "x-320", "x-290", "x-260", "x-230", "x-200", "x-170", "x-140", "x-110", "x-80", "x-50", "x-20", "x40", "x100", "x130", "x160"].map((s) => `sur:${s}`), // #496: x −380..−140 in the build region; #493: the avenue is at y 348: y 318 is now an ordinary street inside the city (bulevar:y318), and x −140 leaves the cover at y 348 (sur:x-140 gone)
    ].sort();
    expect(got).toEqual(want);
    expect(got).toHaveLength(64); // #496: 47 + 17 in the strip (measured). Before: 30 east of x −54 (as before #479) + 17 west of it, measured on agent/479 with the west streets
    expect(got.filter((g) => !/:x-/.test(g) || Number(g.split(":x")[1]) >= -54)).toHaveLength(31); // #493: +1 east (bulevar:y318), −1 west (sur:x-140)
  });
});

describe("crosswalks (#473)", () => {
  const dist = (p: Vec2, q: Vec2) => Math.hypot(p.x - q.x, p.y - q.y);

  it("every axis crossing has a crosswalk", () => {
    const served = new Map<string, boolean>();
    for (const c of crossings()) {
      if (!c.other) continue;
      const k = pair(c.a.id, c.other.id), ok = crosswalks().some((w) => w.a === c.a && dist(w.at, c.at) <= c.half + 3 + 1e-6);
      served.set(k, (served.get(k) ?? false) || ok);
    }
    expect(served.size).toBe(5);
    for (const [k, ok] of served) expect(ok, k).toBe(true);
  });

  it("every axis × street crossing has a crosswalk within half + 3 (Diagonal Norte × y 198 is served by its x 70 neighbour, T5)", () => {
    for (const c of crossings()) {
      if (c.other) continue;
      expect(crosswalks().some((w) => w.a === c.a && dist(w.at, c.at) <= c.half + 3 + 1e-6), `${c.a.id}:${c.otherId}`).toBe(true);
    }
    const dn = crosswalks().filter((w) => w.a.id === "diagonalNorte");
    expect(dn).toHaveLength(4); // x40, x70, x100, x130: y198 dropped by T5
  });

  it("every crosswalk is three strips of the axis width, perpendicular to it, 1.6 apart", () => {
    for (const w of crosswalks()) {
      const L = Math.hypot(w.a.to.x - w.a.from.x, w.a.to.y - w.a.from.y), ux = (w.a.to.x - w.a.from.x) / L, uy = (w.a.to.y - w.a.from.y) / L;
      expect(w.strips).toHaveLength(3);
      const mids = w.strips.map(([p, q]) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }));
      for (const [p, q] of w.strips) {
        expect(Math.abs((q.x - p.x) * ux + (q.y - p.y) * uy)).toBeLessThan(1e-9);
        expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeCloseTo(w.a.w, 6);
      }
      expect(dist(mids[0]!, mids[1]!)).toBeCloseTo(1.6, 6);
      expect(dist(mids[1]!, mids[2]!)).toBeCloseTo(1.6, 6);
      expect(near(mids[1]!, w.at)).toBe(true);
    }
  });

  it("no crosswalk strip steps on a plaza, a crossing plaza, the hotel lot, a crater, a foreign band, the terraces or under the bridge", () => {
    for (const w of crosswalks()) {
      const foreign = ["costanera", "plaza", "diagonalNorte", "diagonalSur", "bulevar", "vias", "sur", "barrio"].filter((id) => id !== w.a.id).map((id) => axisBand(axis(id)));
      for (const [p, q] of w.strips) for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }, tag = `${w.a.id} at ${m.x.toFixed(1)},${m.y.toFixed(1)}`;
        expect(strictIn(PLAZA_MAYOR, m), tag).toBe(false);
        expect(inCrossingPlaza(m.x, m.y), tag).toBe(false);
        expect(strictIn(HOTEL_LOT, m), tag).toBe(false);
        expect(inCrater(m.x, m.y), tag).toBe(false);
        expect(strictIn(QUAY_TERRACES, m), tag).toBe(false);
        expect(m.x >= 186 && m.y >= 207 && m.y <= 217, `${tag} under the bridge`).toBe(false);
        for (const b of foreign) expect(pointInPoly(m.x, m.y, b), `${tag} in a foreign band`).toBe(false);
      }
    }
  });

  it("crosswalks: 37 measured", () => {
    expect(crosswalks()).toHaveLength(71); // #496: +17 in the strip (measured, was 70). #496: +16 in the strip (measured). Before: measured on agent/479 with the west streets: 37 east of x −54 (unchanged) + 17 west of it. The 37 measured (#473): the prototype's 37, + plaza × x100 (strict hotel edge), − costanera × vias (terraces), − diagonalNorte × y198 (T5), + plaza × x130 (the tower island left with #474)
  });

  it("QUAY_TERRACES covers westQuay's terrace tables", () => {
    const solids: Solid[] = [];
    westQuay(solids, []);
    const furniture = solids.filter((s) => s.kind === "prism" && s.mat === "paving" && ((s.w === 1 && s.d === 1 && s.h === 0.7) || (s.w === 0.5 && s.d === 0.5 && s.h === 0.5))); // tables and chairs (kit/props)
    expect(furniture.length).toBeGreaterThan(0);
    for (const s of furniture) {
      const b = bounds(s);
      expect(b.min.x >= QUAY_TERRACES.x && b.max.x <= QUAY_TERRACES.x + QUAY_TERRACES.w && b.min.y >= QUAY_TERRACES.y && b.max.y <= QUAY_TERRACES.y + QUAY_TERRACES.d, `${s.kind} ${b.min.x},${b.min.y}`).toBe(true);
    }
  });
});
