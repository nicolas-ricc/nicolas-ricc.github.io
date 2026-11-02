import { describe, expect, it } from "vitest";
import { ARCH_SEGMENTS, bandTone, facadeAccents, facadeFaces, facadeWindows, isWall, SLAB_H, windowPatches, type Facade } from "./facade";
import { v3 } from "./geometry";
import { tessellate, tessellateAll, visibleWalls, type Face, type Solid } from "./solids";

const tower: Solid & { kind: "prism" } = { kind: "prism", at: v3(0, 0, 0), w: 4, d: 4, h: 6, mat: "office", facade: { floors: 3, cols: 2 } };
const zspan = (f: Face) => Math.max(...f.pts.map((p) => p.z)) - Math.min(...f.pts.map((p) => p.z));

describe("facade", () => {
  it("for each visible wall: the wall, then the floor bands, and per floor 2 glass windows and a dark slab", () => {
    const vis = tessellate(tower);
    const walls = vis.filter((f) => isWall(f) && f.mat === "office" && zspan(f) === tower.h);
    expect(walls).toHaveLength(2);
    expect(vis).toHaveLength(3 + 2 * 12); // roof + 2 walls, and per wall 3 bands + 6 windows + 3 slabs
    for (const wall of walls) {
      const i = vis.indexOf(wall);
      const after = vis.slice(i + 1, i + 13);
      expect(after.map((f) => (f.mat === "glass" ? "w" : zspan(f) === 2 ? "b" : "s")).join("")).toBe("bbbwwswwswws");
      for (const f of after) expect(f.normal).toEqual(wall.normal); // coplanar: painted on top
    }
  });

  it("bands by height: 0, 1, 2 by thirds with 6 floors; 0, 1, 1 with 3; 0 with 1", () => {
    const bands = (floors: number) => {
      const f: Facade = { floors, cols: 2 };
      const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
      const fh = tower.h / floors;
      return facadeFaces(wall, f).filter((x) => x.mat === "office" && Math.abs(zspan(x) - fh) < 1e-9).map((x) => x.toneOffset);
    };
    expect(bands(6)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(bands(3)).toEqual([0, 1, 1]);
    expect(bands(1)).toEqual([0]);
    expect([4, 5, 9].map((n) => Array.from({ length: n }, (_, i) => bandTone(i, n)))).toEqual([[0, 0, 1, 2], [0, 0, 1, 1, 2], [0, 0, 0, 1, 1, 1, 2, 2, 2]]);
  });

  it("each band covers its whole floor, from side to side of the wall", () => {
    const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!; // south wall, x 0..4
    const bands = facadeFaces(wall, tower.facade!).filter((x) => x.mat === "office" && zspan(x) === 2);
    expect(bands.map((b) => [Math.min(...b.pts.map((p) => p.z)), Math.max(...b.pts.map((p) => p.z))])).toEqual([[0, 2], [2, 4], [4, 6]]);
    for (const b of bands) expect([Math.min(...b.pts.map((p) => p.x)), Math.max(...b.pts.map((p) => p.x))]).toEqual([0, 4]);
  });

  it("bands: false reproduces the facade without a gradient: per floor windows and slab", () => {
    const f: Facade = { ...tower.facade!, bands: false };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const faces = facadeFaces(wall, f);
    expect(faces.map((x) => (x.mat === "glass" ? "v" : x.toneOffset === -1 ? "l" : "?")).join("")).toBe("vvlvvlvvl");
    expect(facadeFaces(wall, tower.facade!).filter((x) => !(x.mat === "office" && zspan(x) === 2))).toEqual(faces);
  });

  it("windows stay inside their floor and slabs sit atop each floor", () => {
    const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!; // south wall
    const faces = facadeFaces(wall, tower.facade!);
    const windows = faces.filter((f) => f.mat === "glass");
    expect(windows.every((f) => f.pts.every((p) => p.y === 4))).toBe(true);
    const floor1 = windowPatches(wall, tower.facade!, 1);
    expect(floor1).toHaveLength(2);
    for (const w of floor1) {
      expect(Math.min(...w.map((p) => p.z))).toBeCloseTo(2.5);
      expect(Math.max(...w.map((p) => p.z))).toBeCloseTo(3.5);
    }
    const slabs = faces.filter((f) => f.toneOffset === -1);
    expect(slabs.map((f) => Math.max(...f.pts.map((p) => p.z))).sort()).toEqual([2, 4, 6]);
  });

  it("shopfront ground floor: a single glass band on floor 0", () => {
    const f: Facade = { floors: 2, cols: 3, base: "glass" };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const glass = facadeFaces(wall, f).filter((x) => x.mat === "glass");
    expect(glass).toHaveLength(1 + 3);
  });

  it("portico: band two tones darker than the building's material", () => {
    const f: Facade = { floors: 2, cols: 3, base: "portico" };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const faces = facadeFaces(wall, f);
    expect(faces.some((x) => x.mat === "office" && x.toneOffset === -2)).toBe(true);
    expect(faces.filter((x) => x.mat === "glass")).toHaveLength(3);
  });

  it("the lit floor comes out as polygonal accents, one per visible window", () => {
    const f: Facade = { floors: 3, cols: 2, litFloor: 1 };
    const walls = visibleWalls(tower);
    const acc = facadeAccents(walls, f, "amber");
    expect(acc).toHaveLength(4);
    for (const a of acc) {
      expect(a.kind).toBe("poly");
      if (a.kind === "poly") expect(a.pts.every((p) => p.z >= 2.5 && p.z <= 3.5)).toBe(true);
      expect(a.color).toBe("amber");
    }
    expect(facadeAccents(walls, { floors: 3, cols: 2 }, "amber")).toEqual([]);
  });

  it("gable ignores the facade; stepped roof applies it only to the box", () => {
    const gable = tessellateAll({ ...tower, roof: "gable" });
    expect(gable.every((x) => x.mat === "office" && x.toneOffset === 0)).toBe(true);
    const step = tessellateAll({ ...tower, roof: "step" });
    expect(step.filter((x) => x.mat === "glass")).toHaveLength(4 * 6);
  });

  it("wide and tall window: curtain wall", () => {
    const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!;
    const wide = windowPatches(wall, { floors: 3, cols: 2, window: { w: 0.85, h: 0.8 } }, 1)[0]!;
    const normal = windowPatches(wall, { floors: 3, cols: 2 }, 1)[0]!;
    const width = (p: typeof wide) => Math.abs(p[1]!.x - p[0]!.x), height = (p: typeof wide) => p[2]!.z - p[0]!.z;
    expect(width(wide)).toBeCloseTo(0.85 * 2, 6);
    expect(width(normal)).toBeCloseTo(0.5 * 2, 6);
    expect(height(wide)).toBeCloseTo(0.8 * 2, 6);
  });

  it("visibleWalls: only the walls facing the camera, without the facade's bands or windows", () => {
    const walls = visibleWalls(tower);
    expect(walls).toHaveLength(2);
    expect(walls.every((w) => isWall(w) && w.mat === "office" && zspan(w) === tower.h)).toBe(true);
    expect(visibleWalls({ kind: "cylinder", at: v3(0, 0, 0), r: 4, h: 6, mat: "office", sides: 12, facade: { floors: 3, cols: 1 } }).every((w) => zspan(w) === 6)).toBe(true);
  });

  it("isWall: horizontal normal", () => {
    const wall: Face = { pts: [], normal: v3(0, 1, 0), mat: "office", tone: "lit", toneOffset: 0 };
    expect(isWall(wall)).toBe(true);
    expect(isWall({ ...wall, normal: v3(0, 0, 1) })).toBe(false);
  });
});

describe("arcade", () => {
  const f: Facade = { floors: 2, cols: 3, base: "arcade" };
  const wall = tessellateAll({ ...tower, facade: f }).find((x) => isWall(x) && x.pts.every((p) => p.y === 4))!; // south wall, x 0..4, z 0..6
  const faces = facadeFaces(wall, f);
  const fh = 3;
  const arches = faces.filter((x) => x.toneOffset === -2);

  it("one arch per column, each a 9-point polygon: 2 from the rectangle's base and the 7 of the 6-segment semicircle", () => {
    expect(arches).toHaveLength(3);
    // the rectangle's two upper corners are the semicircle's ends: 4 − 2 + 7 = 9
    for (const a of arches) {
      expect(a.pts).toHaveLength(2 + ARCH_SEGMENTS + 1);
      expect(a.mat).toBe("office");
      expect(Math.min(...a.pts.map((p) => p.z))).toBeCloseTo(0);
      expect(Math.max(...a.pts.map((p) => p.z))).toBeCloseTo(fh * 0.8);
      expect(a.pts[2]!.z).toBeCloseTo(fh * 0.45); // arch springing
      expect(a.pts[8]!.z).toBeCloseTo(fh * 0.45);
    }
  });

  it("arches 0.7 of the column width, centered on their column", () => {
    const cw = 4 / 3;
    // the south wall's base runs from x 4 to 0 and columns are counted along the base: arch k is at x = 4 − (k + 0.5)·cw
    arches.forEach((a, k) => {
      const xs = a.pts.map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.7 * cw);
      expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(4 - (k + 0.5) * cw);
    });
  });

  it("pillars at −1 emitted before the arches, after the bands; no windows on floor 0", () => {
    const iPillar = faces.findIndex((x) => x.toneOffset === -1 && Math.abs(Math.max(...x.pts.map((p) => p.z)) - fh * 0.85) < 1e-9);
    expect(iPillar).toBe(2); // 0 and 1 are the floor bands
    expect(faces.findIndex((x) => x.toneOffset === -2)).toBe(3);
    expect(faces.filter((x) => x.mat === "glass")).toHaveLength(3); // only floor 1
    expect(windowPatches(wall, f, 0)).toEqual([]);
    expect(facadeAccents([wall], { ...f, litFloor: 0 }, "amber")).toEqual([]); // like the portico: floor 0 has no windows to light
  });

  it("no polygon leaves the wall or its floor", () => {
    for (const x of [faces[0]!, ...faces.slice(2, 2 + 1 + 3)]) { // floor 0 band, pillars and the 3 arches
      for (const p of x.pts) {
        expect(p.y).toBe(4);
        expect(p.x).toBeGreaterThanOrEqual(-1e-9);
        expect(p.x).toBeLessThanOrEqual(4 + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(-1e-9);
        expect(p.z).toBeLessThanOrEqual(fh + 1e-9);
      }
    }
  });

  it("with bands: false floor 0 starts with the pillars", () => {
    const raw = facadeFaces(wall, { ...f, bands: false });
    expect(raw[0]!.toneOffset).toBe(-1);
    expect(raw.slice(1, 4).every((x) => x.toneOffset === -2)).toBe(true);
  });
});

describe("facade on cylinder", () => {
  const drum: Solid = { kind: "cylinder", at: v3(0, 0, 0), r: 4, h: 6, mat: "office", sides: 12, facade: { floors: 3, cols: 1 } };
  const plain: Solid = { ...drum, facade: undefined };

  it("each wall carries its facade: 3 bands, 3 windows and 3 slabs after it", () => {
    const all = tessellateAll(drum), walls = tessellateAll(plain).filter(isWall);
    expect(walls).toHaveLength(12);
    expect(all).toHaveLength(2 + 12 * (1 + 9));
    for (const wall of walls) {
      const i = all.findIndex((f) => JSON.stringify(f.pts) === JSON.stringify(wall.pts));
      const after = all.slice(i + 1, i + 10);
      expect(after.filter((f) => f.mat === "glass")).toHaveLength(3);
      for (const f of after) expect(f.normal).toEqual(all[i]!.normal);
    }
  });

  it("tessellate discards back-facing walls along with their facade", () => {
    const vis = tessellate(drum), visWalls = tessellate(plain).filter(isWall);
    expect(vis).toHaveLength(1 + visWalls.length * 10); // roof + each visible wall with its 9 faces
  });
});

describe("facadeWindows", () => {
  const wallOf = (s: Solid) => tessellateAll(s).find((x) => isWall(x) && x.pts.every((p) => p.y === 4))!;

  it("cols · floors without base; cols · (floors − 1) with any base", () => {
    expect(facadeWindows(wallOf(tower), tower.facade!)).toHaveLength(2 * 3);
    for (const base of ["glass", "portico", "arcade"] as const) {
      const f: Facade = { floors: 3, cols: 2, base };
      expect(facadeWindows(wallOf({ ...tower, facade: f }), f)).toHaveLength(2 * 2);
    }
    const one: Facade = { floors: 1, cols: 4, base: "glass" };
    expect(facadeWindows(wallOf({ ...tower, facade: one }), one)).toEqual([]);
  });

  it("each window carries its floor and falls inside it, also with the wall raised", () => {
    const raised = { ...tower, at: v3(0, 0, 2) };
    const f: Facade = { floors: 3, cols: 2, base: "portico" };
    const ws = facadeWindows(wallOf({ ...raised, facade: f }), f);
    expect(ws.map((w) => w.floor)).toEqual([1, 1, 2, 2]);
    for (const w of ws) {
      const z0 = 2 + w.floor * 2;
      expect(Math.min(...w.pts.map((p) => p.z))).toBeGreaterThan(z0);
      expect(Math.max(...w.pts.map((p) => p.z))).toBeLessThan(z0 + 2);
    }
  });

  it("they match the glass windows of facadeFaces", () => {
    const f: Facade = { floors: 3, cols: 2, base: "arcade" };
    const wall = wallOf({ ...tower, facade: f });
    expect(facadeWindows(wall, f).map((w) => w.pts)).toEqual(facadeFaces(wall, f).filter((x) => x.mat === "glass").map((x) => x.pts));
  });
});

const ser = (faces: Face[]) =>
  faces.map((f) => ({ mat: f.mat, tone: f.tone, toneOffset: f.toneOffset, normal: [f.normal.x, f.normal.y, f.normal.z], pts: f.pts.map((p) => [p.x, p.y, p.z]) }));
const southOf = (s: Solid) => tessellateAll(s).find((f) => isWall(f) && f.pts.every((p) => p.y === (s.kind === "prism" ? s.at.y + s.d : NaN)))!;
const box = (w: number, d: number, h: number, facade: Facade): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(0, 0, 0), w, d, h, mat: "office", facade });
const diag: Solid & { kind: "poly" } = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 3 }, { x: 0, y: 3 }], z: 0, h: 6, mat: "office", facade: { floors: 3, cols: 2 } };
const diagWall = (s: Solid) => tessellateAll(s).find((f) => isWall(f) && f.pts[0]!.x === 4 && f.pts[1]!.x === 6)!;
/** Wall coordinates of a point: s (0..1 along the base), distance to the plane, z. */
const wallCoords = (wall: Face, p: { x: number; y: number; z: number }) => {
  const a = wall.pts[0]!, b = wall.pts[1]!, L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return { s: ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2, off: (p.x - a.x) * wall.normal.x + (p.y - a.y) * wall.normal.y, z: p.z };
};
const zs = (f: Face) => f.pts.map((p) => p.z), xs = (f: Face) => f.pts.map((p) => p.x);
const span = (v: number[]) => Math.max(...v) - Math.min(...v);
const lo = (v: number[]) => Math.min(...v), hi = (v: number[]) => Math.max(...v);

describe("rich facade (#209)", () => {
  it("non-regression: without the new options, today's faces", () => {
    expect(ser(facadeFaces(southOf(tower), { ...tower.facade!, bands: false }))).toMatchInlineSnapshot(`
      [
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              3.5,
              4,
              0.5,
            ],
            [
              2.5,
              4,
              0.5,
            ],
            [
              2.5,
              4,
              1.5,
            ],
            [
              3.5,
              4,
              1.5,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              1.5,
              4,
              0.5,
            ],
            [
              0.5,
              4,
              0.5,
            ],
            [
              0.5,
              4,
              1.5,
            ],
            [
              1.5,
              4,
              1.5,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              4,
              4,
              1.7,
            ],
            [
              0,
              4,
              1.7,
            ],
            [
              0,
              4,
              2,
            ],
            [
              4,
              4,
              2,
            ],
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              3.5,
              4,
              2.5,
            ],
            [
              2.5,
              4,
              2.5,
            ],
            [
              2.5,
              4,
              3.5,
            ],
            [
              3.5,
              4,
              3.5,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              1.5,
              4,
              2.5,
            ],
            [
              0.5,
              4,
              2.5,
            ],
            [
              0.5,
              4,
              3.5,
            ],
            [
              1.5,
              4,
              3.5,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              4,
              4,
              3.7,
            ],
            [
              0,
              4,
              3.7,
            ],
            [
              0,
              4,
              4,
            ],
            [
              4,
              4,
              4,
            ],
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              3.5,
              4,
              4.5,
            ],
            [
              2.5,
              4,
              4.5,
            ],
            [
              2.5,
              4,
              5.5,
            ],
            [
              3.5,
              4,
              5.5,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              1.5,
              4,
              4.5,
            ],
            [
              0.5,
              4,
              4.5,
            ],
            [
              0.5,
              4,
              5.5,
            ],
            [
              1.5,
              4,
              5.5,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              4,
              4,
              5.7,
            ],
            [
              0,
              4,
              5.7,
            ],
            [
              0,
              4,
              6,
            ],
            [
              4,
              4,
              6,
            ],
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
      ]
    `);
    const shopfront: Facade = { floors: 2, cols: 3, base: "glass", bands: false };
    expect(ser(facadeFaces(southOf(box(4, 4, 6, shopfront)), shopfront))).toMatchInlineSnapshot(`
      [
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              3.68,
              4,
              0.44999999999999996,
            ],
            [
              0.31999999999999984,
              4,
              0.44999999999999996,
            ],
            [
              0.31999999999999984,
              4,
              2.4000000000000004,
            ],
            [
              3.68,
              4,
              2.4000000000000004,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              4,
              4,
              2.7,
            ],
            [
              0,
              4,
              2.7,
            ],
            [
              0,
              4,
              3,
            ],
            [
              4,
              4,
              3,
            ],
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              3.6666666666666665,
              4,
              3.75,
            ],
            [
              3,
              4,
              3.75,
            ],
            [
              3,
              4,
              5.25,
            ],
            [
              3.6666666666666665,
              4,
              5.25,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              2.3333333333333335,
              4,
              3.75,
            ],
            [
              1.666666666666667,
              4,
              3.75,
            ],
            [
              1.666666666666667,
              4,
              5.25,
            ],
            [
              2.3333333333333335,
              4,
              5.25,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              1,
              4,
              3.75,
            ],
            [
              0.3333333333333335,
              4,
              3.75,
            ],
            [
              0.3333333333333335,
              4,
              5.25,
            ],
            [
              1,
              4,
              5.25,
            ],
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0,
            1,
            0,
          ],
          "pts": [
            [
              4,
              4,
              5.7,
            ],
            [
              0,
              4,
              5.7,
            ],
            [
              0,
              4,
              6,
            ],
            [
              4,
              4,
              6,
            ],
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
      ]
    `);
    expect(ser(facadeFaces(diagWall(diag), { ...diag.facade!, bands: false }))).toMatchInlineSnapshot(`
      [
        {
          "mat": "glass",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              4.25,
              0.375,
              0.5,
            ],
            [
              4.75,
              1.125,
              0.5,
            ],
            [
              4.75,
              1.125,
              1.5,
            ],
            [
              4.25,
              0.375,
              1.5,
            ],
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              5.25,
              1.875,
              0.5,
            ],
            [
              5.75,
              2.625,
              0.5,
            ],
            [
              5.75,
              2.625,
              1.5,
            ],
            [
              5.25,
              1.875,
              1.5,
            ],
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              4,
              0,
              1.7,
            ],
            [
              6,
              3,
              1.7,
            ],
            [
              6,
              3,
              2,
            ],
            [
              4,
              0,
              2,
            ],
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
        {
          "mat": "glass",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              4.25,
              0.375,
              2.5,
            ],
            [
              4.75,
              1.125,
              2.5,
            ],
            [
              4.75,
              1.125,
              3.5,
            ],
            [
              4.25,
              0.375,
              3.5,
            ],
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              5.25,
              1.875,
              2.5,
            ],
            [
              5.75,
              2.625,
              2.5,
            ],
            [
              5.75,
              2.625,
              3.5,
            ],
            [
              5.25,
              1.875,
              3.5,
            ],
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              4,
              0,
              3.7,
            ],
            [
              6,
              3,
              3.7,
            ],
            [
              6,
              3,
              4,
            ],
            [
              4,
              0,
              4,
            ],
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
        {
          "mat": "glass",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              4.25,
              0.375,
              4.5,
            ],
            [
              4.75,
              1.125,
              4.5,
            ],
            [
              4.75,
              1.125,
              5.5,
            ],
            [
              4.25,
              0.375,
              5.5,
            ],
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              5.25,
              1.875,
              4.5,
            ],
            [
              5.75,
              2.625,
              4.5,
            ],
            [
              5.75,
              2.625,
              5.5,
            ],
            [
              5.25,
              1.875,
              5.5,
            ],
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "office",
          "normal": [
            0.8320502943378436,
            -0.554700196225229,
            0,
          ],
          "pts": [
            [
              4,
              0,
              5.7,
            ],
            [
              6,
              3,
              5.7,
            ],
            [
              6,
              3,
              6,
            ],
            [
              4,
              0,
              6,
            ],
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
      ]
    `);
  });

  describe("pilasters, courses and plinth", () => {
    it("piers { every 2, w 0.5 } with cols 4: 3 strips on edges 0, 2 and 4, from floor to eave, before the windows", () => {
      const f: Facade = { floors: 3, cols: 4, piers: { every: 2, w: 0.5, mat: "rust" } };
      const faces = facadeFaces(southOf(box(8, 4, 6, f)), f);
      const piers = faces.filter((x) => x.mat === "rust");
      expect(piers).toHaveLength(3);
      for (const x of piers) { expect(x.toneOffset).toBe(0); expect(lo(zs(x))).toBeCloseTo(0, 9); expect(hi(zs(x))).toBeCloseTo(6, 9); }
      const strips = piers.map((x) => [lo(xs(x)), hi(xs(x))]).sort((a, b) => a[0]! - b[0]!);
      expect(strips[0]![0]).toBeCloseTo(0, 9); expect(strips[0]![1]).toBeCloseTo(0.25, 9);
      expect(strips[1]![0]).toBeCloseTo(3.75, 9); expect(strips[1]![1]).toBeCloseTo(4.25, 9);
      expect(strips[2]![0]).toBeCloseTo(7.75, 9); expect(strips[2]![1]).toBeCloseTo(8, 9);
      const firstGlass = faces.findIndex((x) => x.mat === "glass");
      for (const x of piers) expect(faces.indexOf(x)).toBeLessThan(firstGlass);
    });

    it("every that does not divide cols: the final edge too (cols 5 → edges 0, 2, 4 and 5)", () => {
      const f: Facade = { floors: 1, cols: 5, piers: { every: 2, w: 0.5, mat: "rust" } };
      const strips = facadeFaces(southOf(box(10, 4, 3, f)), f).filter((x) => x.mat === "rust").map((x) => [lo(xs(x)), hi(xs(x))]).sort((a, b) => a[0]! - b[0]!);
      expect(strips).toHaveLength(4);
      const want = [[0, 0.25], [1.75, 2.25], [5.75, 6.25], [9.75, 10]];
      strips.forEach((st, i) => { expect(st[0]).toBeCloseTo(want[i]![0]!, 9); expect(st[1]).toBeCloseTo(want[i]![1]!, 9); });
    });

    it("courses replaces the slab: no face of the wall's material with toneOffset −1, one course per floor", () => {
      const f: Facade = { floors: 3, cols: 2, courses: { mat: "rust", h: 0.4 } };
      const faces = facadeFaces(southOf(tower), f);
      expect(faces.some((x) => x.mat === "office" && x.toneOffset === -1)).toBe(false);
      const courses = faces.filter((x) => x.mat === "rust");
      expect(courses).toHaveLength(3);
      for (const x of courses) { expect(x.toneOffset).toBe(0); expect(span(zs(x))).toBeCloseTo(0.4, 9); expect(span(xs(x))).toBeCloseTo(4, 9); }
      expect(courses.map((x) => hi(zs(x))).sort()).toEqual([2, 4, 6]);
    });

    it("plinth: first face, full-width band from the base", () => {
      const f: Facade = { floors: 3, cols: 2, plinth: { h: 1, mat: "concrete" }, bands: false };
      const faces = facadeFaces(southOf(tower), f);
      expect(faces[0]!.mat).toBe("concrete");
      expect(faces[0]!.toneOffset).toBe(0);
      expect(lo(zs(faces[0]!))).toBeCloseTo(0, 9); expect(hi(zs(faces[0]!))).toBeCloseTo(1, 9);
      expect(span(xs(faces[0]!))).toBeCloseTo(4, 9);
      expect(faces.filter((x) => x.mat === "concrete")).toHaveLength(1);
    });
  });

  describe("window ornaments", () => {
    const glassOf = (faces: Face[]) => faces.map((x, i) => [x, i] as const).filter(([x]) => x.mat === "glass");

    it("grid { 3, 4 }: 5 strips of 0.12 per window, inside the glass and after it", () => {
      const f: Facade = { floors: 3, cols: 2, grid: { cols: 3, rows: 4 } };
      const faces = facadeFaces(southOf(tower), f);
      const glass = glassOf(faces);
      expect(glass).toHaveLength(6);
      for (const [g, i] of glass) {
        const bars = faces.slice(i + 1, i + 6);
        expect(bars.every((x) => x.mat === "steel" && x.toneOffset === -1)).toBe(true);
        const vert = bars.filter((x) => Math.abs(span(xs(x)) - 0.12) < 1e-9 && Math.abs(span(zs(x)) - span(zs(g))) < 1e-9);
        const horz = bars.filter((x) => Math.abs(span(zs(x)) - 0.12) < 1e-9 && Math.abs(span(xs(x)) - span(xs(g))) < 1e-9);
        expect(vert).toHaveLength(2); expect(horz).toHaveLength(3);
        for (const x of bars) {
          expect(lo(xs(x))).toBeGreaterThanOrEqual(lo(xs(g)) - 1e-9); expect(hi(xs(x))).toBeLessThanOrEqual(hi(xs(g)) + 1e-9);
          expect(lo(zs(x))).toBeGreaterThanOrEqual(lo(zs(g)) - 1e-9); expect(hi(zs(x))).toBeLessThanOrEqual(hi(zs(g)) + 1e-9);
        }
      }
      const rust: Facade = { ...f, grid: { cols: 3, rows: 4, mat: "rust" } };
      expect(facadeFaces(southOf(tower), rust).filter((x) => x.mat === "rust")).toHaveLength(30);
    });

    it("head segmental: 7-point polygon per window, rise 0.3 × width above the top edge", () => {
      const f: Facade = { floors: 3, cols: 2, head: "segmental" };
      const faces = facadeFaces(southOf(tower), f);
      const glass = glassOf(faces);
      expect(faces.filter((x) => x.pts.length === 7)).toHaveLength(6);
      for (const [g, i] of glass) {
        const head = faces[i + 1]!;
        expect(head.pts).toHaveLength(7);
        expect(head.mat).toBe("office"); expect(head.toneOffset).toBe(0);
        const top = hi(zs(g)), width = span(xs(g));
        expect(hi(zs(head)) - top).toBeCloseTo(0.3 * width, 6);
        expect(lo(zs(head))).toBeCloseTo(top, 9);
        const corners = [head.pts[0]!, head.pts[1]!].map((p) => [p.x, p.z]).sort((a, b) => a[0]! - b[0]!);
        expect(corners[0]![0]).toBeCloseTo(lo(xs(g)), 9); expect(corners[0]![1]).toBeCloseTo(top, 9);
        expect(corners[1]![0]).toBeCloseTo(hi(xs(g)), 9); expect(corners[1]![1]).toBeCloseTo(top, 9);
        expect(lo(xs(head))).toBeCloseTo(lo(xs(g)), 9); expect(hi(xs(head))).toBeCloseTo(hi(xs(g)), 9);
      }
      const withMat = facadeFaces(southOf(tower), { ...f, headMat: "concrete" });
      expect(withMat.filter((x) => x.pts.length === 7).every((x) => x.mat === "concrete")).toBe(true);
    });

    it("head flat: rectangle 0.25 tall, as wide as the window, above its top edge", () => {
      const f: Facade = { floors: 3, cols: 2, head: "flat", headMat: "concrete" };
      const faces = facadeFaces(southOf(tower), f);
      for (const [g, i] of glassOf(faces)) {
        const head = faces[i + 1]!;
        expect(head.pts).toHaveLength(4);
        expect(head.mat).toBe("concrete"); expect(head.toneOffset).toBe(0);
        expect(lo(zs(head))).toBeCloseTo(hi(zs(g)), 9); expect(hi(zs(head))).toBeCloseTo(hi(zs(g)) + 0.25, 9);
        expect(lo(xs(head))).toBeCloseTo(lo(xs(g)), 9); expect(hi(xs(head))).toBeCloseTo(hi(xs(g)), 9);
      }
    });

    it("sill: band 0.2 tall below the window, 0.2 wider, toneOffset +1, right before the glass", () => {
      const f: Facade = { floors: 3, cols: 2, sill: "concrete" };
      const faces = facadeFaces(southOf(tower), f);
      const glass = glassOf(faces);
      expect(faces.filter((x) => x.mat === "concrete")).toHaveLength(6);
      for (const [g, i] of glass) {
        const sill = faces[i - 1]!;
        expect(sill.mat).toBe("concrete"); expect(sill.toneOffset).toBe(1);
        expect(hi(zs(sill))).toBeCloseTo(lo(zs(g)), 9); expect(span(zs(sill))).toBeCloseTo(0.2, 9);
        expect(lo(xs(sill))).toBeCloseTo(lo(xs(g)) - 0.1, 9); expect(hi(xs(sill))).toBeCloseTo(hi(xs(g)) + 0.1, 9);
      }
    });

    it("order per window: sill, glass, mullions, lintel", () => {
      const f: Facade = { floors: 2, cols: 1, sill: "concrete", grid: { cols: 2, rows: 1, mat: "rust" }, head: "flat", headMat: "whitewash", bands: false };
      const mats = facadeFaces(southOf(tower), f).map((x) => x.mat);
      expect(mats).toEqual(["concrete", "glass", "rust", "whitewash", "office", "concrete", "glass", "rust", "whitewash", "office"]);
    });
  });

  describe("tie plates", () => {
    const octagons = (faces: Face[], mat: Face["mat"]) => faces.filter((x) => x.mat === mat && x.pts.length === 8);
    const center = (x: Face) => ({ x: x.pts.reduce((a, p) => a + p.x, 0) / 8, z: x.pts.reduce((a, p) => a + p.z, 0) / 8 });

    it("ties: floors − 1 octagons per pilaster, centered on the intermediate floor's slab and after it", () => {
      const f: Facade = { floors: 3, cols: 4, piers: { every: 2, w: 0.5, mat: "rust" }, ties: { r: 0.25, mat: "steel" } };
      const faces = facadeFaces(southOf(box(8, 4, 6, f)), f);
      const ties = octagons(faces, "steel");
      expect(ties).toHaveLength(3 * 2);
      expect(faces.filter((x) => x.mat === "steel")).toHaveLength(6);
      for (const t of ties) {
        expect(t.toneOffset).toBe(0);
        const c = center(t);
        expect([2 - SLAB_H / 2, 4 - SLAB_H / 2].some((z) => Math.abs(c.z - z) < 1e-9)).toBe(true);
        const slab = faces.findIndex((x) => x.mat === "office" && x.toneOffset === -1 && Math.abs(hi(zs(x)) - (c.z + SLAB_H / 2)) < 1e-9);
        expect(slab).toBeGreaterThanOrEqual(0);
        expect(faces.indexOf(t)).toBeGreaterThan(slab);
        expect(span(xs(t))).toBeLessThanOrEqual(0.5 + 1e-9);
      }
      expect(ties.filter((t) => Math.abs(center(t).x - 4) < 1e-9)).toHaveLength(2);
    });

    it("ties with courses: centered on the course", () => {
      const f: Facade = { floors: 3, cols: 4, piers: { every: 2, w: 0.5, mat: "rust" }, courses: { mat: "concrete", h: 0.4 }, ties: { r: 0.25, mat: "steel" } };
      const ties = octagons(facadeFaces(southOf(box(8, 4, 6, f)), f), "steel");
      expect(ties).toHaveLength(6);
      for (const t of ties) expect([1.8, 3.8].some((z) => Math.abs(center(t).z - z) < 1e-9)).toBe(true);
    });

    it("ties without piers emits nothing", () => {
      const f: Facade = { floors: 3, cols: 4, ties: { r: 0.25, mat: "steel" } };
      expect(facadeFaces(southOf(box(8, 4, 6, f)), f).some((x) => x.mat === "steel")).toBe(false);
    });
  });

  describe("all options together", () => {
    const rich: Facade = {
      floors: 3, cols: 4, base: "glass",
      grid: { cols: 3, rows: 4 }, head: "segmental", headMat: "concrete", sill: "concrete",
      piers: { every: 2, w: 0.5, mat: "rust" }, courses: { mat: "concrete", h: 0.35 }, plinth: { h: 0.5, mat: "whitewash" }, ties: { r: 0.25, mat: "steel" },
    };

    it("every new face is coplanar with the wall and falls inside its rectangle (axis-aligned wall and diagonal wall)", () => {
      for (const wall of [southOf(box(12, 4, 9, rich)), diagWall({ ...diag, facade: rich })]) {
        const zb = lo(zs(wall)), zt = hi(zs(wall));
        const faces = facadeFaces(wall, rich);
        expect(faces.length).toBeGreaterThan(0);
        for (const x of faces) {
          expect(x.normal).toEqual(wall.normal);
          expect(x.tone).toBe(wall.tone);
          for (const p of x.pts) {
            const c = wallCoords(wall, p);
            expect(c.s).toBeGreaterThanOrEqual(-1e-9); expect(c.s).toBeLessThanOrEqual(1 + 1e-9);
            expect(Math.abs(c.off)).toBeLessThan(1e-9);
            expect(c.z).toBeGreaterThanOrEqual(zb - 1e-9); expect(c.z).toBeLessThanOrEqual(zt + 1e-9);
          }
        }
      }
    });

    it("lintel, sill and plinth that would overshoot the wall are clipped to the eave and the base", () => {
      const tall: Facade = { floors: 2, cols: 1, window: { w: 0.95, h: 0.9 }, head: "segmental", sill: "concrete", plinth: { h: 5, mat: "whitewash" } };
      const wall = southOf(box(8, 4, 1.4, tall));
      const faces = facadeFaces(wall, tall);
      for (const x of faces) for (const p of x.pts) { expect(p.z).toBeLessThanOrEqual(1.4 + 1e-9); expect(p.z).toBeGreaterThanOrEqual(-1e-9); }
      const flat = facadeFaces(wall, { ...tall, head: "flat" });
      for (const x of flat) for (const p of x.pts) expect(p.z).toBeLessThanOrEqual(1.4 + 1e-9);
    });

    it("tie plate taller than the slab on a low floor: the center is clamped above the base", () => {
      const f: Facade = { floors: 2, cols: 2, piers: { every: 1, w: 0.5, mat: "rust" }, ties: { r: 0.4, mat: "steel" } };
      const ties = facadeFaces(southOf(box(8, 4, 1, f)), f).filter((x) => x.mat === "steel");
      expect(ties).toHaveLength(3);
      for (const t of ties) { expect(lo(zs(t))).toBeGreaterThanOrEqual(-1e-9); expect(hi(zs(t))).toBeLessThanOrEqual(1 + 1e-9); }
    });

    it("zero-width window: the segmental arch emits no NaN points", () => {
      const f: Facade = { floors: 1, cols: 1, window: { w: 0, h: 0.5 }, head: "segmental" };
      for (const x of facadeFaces(southOf(box(4, 4, 3, f)), f)) for (const p of x.pts) expect(Number.isFinite(p.z) && Number.isFinite(p.x)).toBe(true);
    });

    it("the host solid keeps its bounds and gains no solids: only faces after each wall", () => {
      const plain = tessellateAll(box(12, 4, 9, { floors: 3, cols: 4 }));
      const fancy = tessellateAll(box(12, 4, 9, rich));
      expect(fancy.filter((x) => x.mat === "office" && x.toneOffset === 0)).toEqual(plain.filter((x) => x.mat === "office" && x.toneOffset === 0));
    });

    it("the lit floor's accents do not change with the new options", () => {
      const walls = tessellate(tower).filter(isWall).filter((x) => x.toneOffset === 0 && x.mat === "office");
      expect(facadeAccents(walls, { ...rich, cols: 2, base: undefined, litFloor: 1 }, "amber")).toEqual(facadeAccents(walls, { floors: 3, cols: 2, litFloor: 1 }, "amber"));
    });
  });
});

describe("bands and ornaments from main (#291)", () => {
  it("the bands are painted before plinth and pilasters", () => {
    const f: Facade = {
      floors: 3, cols: 4, plinth: { h: 0.6, mat: "stone" }, piers: { every: 2, w: 0.4, mat: "stone" },
      courses: { mat: "stone", h: 0.4 }, ties: { r: 0.2, mat: "stone" },
    };
    const s: Solid = { kind: "prism", at: v3(0, 0, 0), w: 10, d: 6, h: 9, mat: "office", facade: f };
    const walls = tessellateAll(s).filter(isWall).filter((x) => x.mat === "office" && x.toneOffset === 0 && Math.abs(zspan(x) - 9) < 1e-9);
    expect(walls).toHaveLength(4);
    for (const wall of walls) {
      const faces = facadeFaces(wall, f);
      const bands = faces.map((x, i) => (x.mat === "office" && Math.abs(zspan(x) - 3) < 1e-9 && x.toneOffset >= 0 && x.pts.length === 4 ? i : -1)).filter((i) => i >= 0);
      expect(bands).toHaveLength(3);
      const firstStone = faces.findIndex((x) => x.mat === "stone");
      expect(firstStone).toBeGreaterThan(Math.max(...bands));
    }
  });
});
