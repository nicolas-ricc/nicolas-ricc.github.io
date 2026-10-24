import { describe, expect, it } from "vitest";
import { facadeAccents, facadeFaces, isWall, SLAB_H, windowPatches, type Facade } from "./facade";
import { v3 } from "./geometry";
import { tessellate, tessellateAll, type Face, type Solid } from "./solids";

const tower: Solid & { kind: "prism" } = { kind: "prism", at: v3(0, 0, 0), w: 4, d: 4, h: 6, mat: "office", facade: { floors: 3, cols: 2 } };

describe("fachada", () => {
  it("por cada pared visible: la pared, luego 6 ventanas de vidrio y 3 losas oscuras", () => {
    const vis = tessellate(tower);
    const walls = vis.filter(isWall).filter((f) => f.mat === "office" && f.toneOffset === 0);
    expect(walls).toHaveLength(2);
    expect(vis).toHaveLength(3 + 2 * 9);
    for (const wall of walls) {
      const i = vis.indexOf(wall);
      const after = vis.slice(i + 1, i + 10);
      expect(after.filter((f) => f.mat === "glass")).toHaveLength(6);
      expect(after.filter((f) => f.mat === "office" && f.toneOffset === -1)).toHaveLength(3);
      for (const f of after) expect(f.normal).toEqual(wall.normal); // coplanares: se pintan encima
    }
  });

  it("las ventanas quedan dentro de su piso y las losas arriba de cada piso", () => {
    const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!; // pared sur
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

  it("planta baja con vidriera: una sola banda de vidrio en el piso 0", () => {
    const f: Facade = { floors: 2, cols: 3, base: "glass" };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const glass = facadeFaces(wall, f).filter((x) => x.mat === "glass");
    expect(glass).toHaveLength(1 + 3);
  });

  it("pórtico: banda dos tonos más oscura del material del edificio", () => {
    const f: Facade = { floors: 2, cols: 3, base: "portico" };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const faces = facadeFaces(wall, f);
    expect(faces.some((x) => x.mat === "office" && x.toneOffset === -2)).toBe(true);
    expect(faces.filter((x) => x.mat === "glass")).toHaveLength(3);
  });

  it("el piso encendido sale como acentos poligonales, uno por ventana visible", () => {
    const f: Facade = { floors: 3, cols: 2, litFloor: 1 };
    const walls = tessellate({ ...tower, facade: f }).filter(isWall).filter((x) => x.toneOffset === 0 && x.mat === "office");
    const acc = facadeAccents(walls, f, "amber");
    expect(acc).toHaveLength(4);
    for (const a of acc) {
      expect(a.kind).toBe("poly");
      if (a.kind === "poly") expect(a.pts.every((p) => p.z >= 2.5 && p.z <= 3.5)).toBe(true);
      expect(a.color).toBe("amber");
    }
    expect(facadeAccents(walls, { floors: 3, cols: 2 }, "amber")).toEqual([]);
  });

  it("gable ignora la fachada; techo escalonado la aplica solo a la caja", () => {
    const gable = tessellateAll({ ...tower, roof: "gable" });
    expect(gable.every((x) => x.mat === "office" && x.toneOffset === 0)).toBe(true);
    const step = tessellateAll({ ...tower, roof: "step" });
    expect(step.filter((x) => x.mat === "glass")).toHaveLength(4 * 6);
  });

  it("window ancha y alta: muro cortina", () => {
    const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!;
    const wide = windowPatches(wall, { floors: 3, cols: 2, window: { w: 0.85, h: 0.8 } }, 1)[0]!;
    const normal = windowPatches(wall, { floors: 3, cols: 2 }, 1)[0]!;
    const width = (p: typeof wide) => Math.abs(p[1]!.x - p[0]!.x), height = (p: typeof wide) => p[2]!.z - p[0]!.z;
    expect(width(wide)).toBeCloseTo(0.85 * 2, 6);
    expect(width(normal)).toBeCloseTo(0.5 * 2, 6);
    expect(height(wide)).toBeCloseTo(0.8 * 2, 6);
  });

  it("isWall: normal horizontal", () => {
    const wall: Face = { pts: [], normal: v3(0, 1, 0), mat: "office", tone: "lit", toneOffset: 0 };
    expect(isWall(wall)).toBe(true);
    expect(isWall({ ...wall, normal: v3(0, 0, 1) })).toBe(false);
  });
});

const ser = (faces: Face[]) =>
  faces.map((f) => ({ mat: f.mat, tone: f.tone, toneOffset: f.toneOffset, normal: [f.normal.x, f.normal.y, f.normal.z], pts: f.pts.map((p) => [p.x, p.y, p.z]) }));
const southOf = (s: Solid) => tessellateAll(s).find((f) => isWall(f) && f.pts.every((p) => p.y === (s.kind === "prism" ? s.at.y + s.d : NaN)))!;
const box = (w: number, d: number, h: number, facade: Facade): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(0, 0, 0), w, d, h, mat: "office", facade });
const diag: Solid & { kind: "poly" } = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 3 }, { x: 0, y: 3 }], z: 0, h: 6, mat: "office", facade: { floors: 3, cols: 2 } };
const diagWall = (s: Solid) => tessellateAll(s).find((f) => isWall(f) && f.pts[0]!.x === 4 && f.pts[1]!.x === 6)!;
/** Coordenadas de pared de un punto: s (0..1 a lo largo de la base), distancia al plano, z. */
const wallCoords = (wall: Face, p: { x: number; y: number; z: number }) => {
  const a = wall.pts[0]!, b = wall.pts[1]!, L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return { s: ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2, off: (p.x - a.x) * wall.normal.x + (p.y - a.y) * wall.normal.y, z: p.z };
};
const zs = (f: Face) => f.pts.map((p) => p.z), xs = (f: Face) => f.pts.map((p) => p.x);
const span = (v: number[]) => Math.max(...v) - Math.min(...v);
const lo = (v: number[]) => Math.min(...v), hi = (v: number[]) => Math.max(...v);

describe("fachada rica (#209)", () => {
  it("no regresión: sin opciones nuevas, las caras de hoy", () => {
    expect(ser(facadeFaces(southOf(tower), tower.facade!))).toMatchInlineSnapshot(`
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
    const vidriera: Facade = { floors: 2, cols: 3, base: "glass" };
    expect(ser(facadeFaces(southOf(box(4, 4, 6, vidriera)), vidriera))).toMatchInlineSnapshot(`
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
    expect(ser(facadeFaces(diagWall(diag), diag.facade!))).toMatchInlineSnapshot(`
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

  describe("pilastras, impostas y zócalo", () => {
    it("piers { every 2, w 0.5 } con cols 4: 3 franjas en los bordes 0, 2 y 4, del piso al alero, antes de las ventanas", () => {
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

    it("every que no divide a cols: también el borde final (cols 5 → bordes 0, 2, 4 y 5)", () => {
      const f: Facade = { floors: 1, cols: 5, piers: { every: 2, w: 0.5, mat: "rust" } };
      const strips = facadeFaces(southOf(box(10, 4, 3, f)), f).filter((x) => x.mat === "rust").map((x) => [lo(xs(x)), hi(xs(x))]).sort((a, b) => a[0]! - b[0]!);
      expect(strips).toHaveLength(4);
      const want = [[0, 0.25], [1.75, 2.25], [5.75, 6.25], [9.75, 10]];
      strips.forEach((st, i) => { expect(st[0]).toBeCloseTo(want[i]![0]!, 9); expect(st[1]).toBeCloseTo(want[i]![1]!, 9); });
    });

    it("courses reemplaza la losa: ninguna cara del material de la pared con toneOffset −1, una imposta por piso", () => {
      const f: Facade = { floors: 3, cols: 2, courses: { mat: "rust", h: 0.4 } };
      const faces = facadeFaces(southOf(tower), f);
      expect(faces.some((x) => x.mat === "office" && x.toneOffset === -1)).toBe(false);
      const courses = faces.filter((x) => x.mat === "rust");
      expect(courses).toHaveLength(3);
      for (const x of courses) { expect(x.toneOffset).toBe(0); expect(span(zs(x))).toBeCloseTo(0.4, 9); expect(span(xs(x))).toBeCloseTo(4, 9); }
      expect(courses.map((x) => hi(zs(x))).sort()).toEqual([2, 4, 6]);
    });

    it("plinth: primera cara, banda de todo el ancho desde la base", () => {
      const f: Facade = { floors: 3, cols: 2, plinth: { h: 1, mat: "concrete" } };
      const faces = facadeFaces(southOf(tower), f);
      expect(faces[0]!.mat).toBe("concrete");
      expect(faces[0]!.toneOffset).toBe(0);
      expect(lo(zs(faces[0]!))).toBeCloseTo(0, 9); expect(hi(zs(faces[0]!))).toBeCloseTo(1, 9);
      expect(span(xs(faces[0]!))).toBeCloseTo(4, 9);
      expect(faces.filter((x) => x.mat === "concrete")).toHaveLength(1);
    });
  });

  describe("adornos de ventana", () => {
    const glassOf = (faces: Face[]) => faces.map((x, i) => [x, i] as const).filter(([x]) => x.mat === "glass");

    it("grid { 3, 4 }: 5 franjas de 0.12 por ventana, dentro del vidrio y después de él", () => {
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

    it("head segmental: polígono de 7 puntos por ventana, flecha 0.3 × ancho sobre el borde superior", () => {
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

    it("head flat: rectángulo de 0.25 de alto, del ancho de la ventana, sobre su borde superior", () => {
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

    it("sill: banda 0.2 de alto bajo la ventana, 0.2 más ancha, toneOffset +1, justo antes del vidrio", () => {
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

    it("orden por ventana: alféizar, vidrio, parteluces, dintel", () => {
      const f: Facade = { floors: 2, cols: 1, sill: "concrete", grid: { cols: 2, rows: 1, mat: "rust" }, head: "flat", headMat: "whitewash" };
      const mats = facadeFaces(southOf(tower), f).map((x) => x.mat);
      expect(mats).toEqual(["concrete", "glass", "rust", "whitewash", "office", "concrete", "glass", "rust", "whitewash", "office"]);
    });
  });

  describe("placas de tirante", () => {
    const octagons = (faces: Face[], mat: Face["mat"]) => faces.filter((x) => x.mat === mat && x.pts.length === 8);
    const center = (x: Face) => ({ x: x.pts.reduce((a, p) => a + p.x, 0) / 8, z: x.pts.reduce((a, p) => a + p.z, 0) / 8 });

    it("ties: floors − 1 octógonos por pilastra, centrados en la losa del entrepiso y después de ella", () => {
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

    it("ties con courses: centrados en la imposta", () => {
      const f: Facade = { floors: 3, cols: 4, piers: { every: 2, w: 0.5, mat: "rust" }, courses: { mat: "concrete", h: 0.4 }, ties: { r: 0.25, mat: "steel" } };
      const ties = octagons(facadeFaces(southOf(box(8, 4, 6, f)), f), "steel");
      expect(ties).toHaveLength(6);
      for (const t of ties) expect([1.8, 3.8].some((z) => Math.abs(center(t).z - z) < 1e-9)).toBe(true);
    });

    it("ties sin piers no emite nada", () => {
      const f: Facade = { floors: 3, cols: 4, ties: { r: 0.25, mat: "steel" } };
      expect(facadeFaces(southOf(box(8, 4, 6, f)), f).some((x) => x.mat === "steel")).toBe(false);
    });
  });

  describe("todas las opciones juntas", () => {
    const rich: Facade = {
      floors: 3, cols: 4, base: "glass",
      grid: { cols: 3, rows: 4 }, head: "segmental", headMat: "concrete", sill: "concrete",
      piers: { every: 2, w: 0.5, mat: "rust" }, courses: { mat: "concrete", h: 0.35 }, plinth: { h: 0.5, mat: "whitewash" }, ties: { r: 0.25, mat: "steel" },
    };

    it("toda cara nueva es coplanar con la pared y cae dentro de su rectángulo (pared de eje y pared diagonal)", () => {
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

    it("dintel, alféizar y zócalo que se pasarían de la pared se recortan al alero y a la base", () => {
      const tall: Facade = { floors: 2, cols: 1, window: { w: 0.95, h: 0.9 }, head: "segmental", sill: "concrete", plinth: { h: 5, mat: "whitewash" } };
      const wall = southOf(box(8, 4, 1.4, tall));
      const faces = facadeFaces(wall, tall);
      for (const x of faces) for (const p of x.pts) { expect(p.z).toBeLessThanOrEqual(1.4 + 1e-9); expect(p.z).toBeGreaterThanOrEqual(-1e-9); }
      const flat = facadeFaces(wall, { ...tall, head: "flat" });
      for (const x of flat) for (const p of x.pts) expect(p.z).toBeLessThanOrEqual(1.4 + 1e-9);
    });

    it("placa de tirante más alta que la losa en un piso bajo: el centro se acota sobre la base", () => {
      const f: Facade = { floors: 2, cols: 2, piers: { every: 1, w: 0.5, mat: "rust" }, ties: { r: 0.4, mat: "steel" } };
      const ties = facadeFaces(southOf(box(8, 4, 1, f)), f).filter((x) => x.mat === "steel");
      expect(ties).toHaveLength(3);
      for (const t of ties) { expect(lo(zs(t))).toBeGreaterThanOrEqual(-1e-9); expect(hi(zs(t))).toBeLessThanOrEqual(1 + 1e-9); }
    });

    it("ventana de ancho cero: el arco rebajado no emite puntos NaN", () => {
      const f: Facade = { floors: 1, cols: 1, window: { w: 0, h: 0.5 }, head: "segmental" };
      for (const x of facadeFaces(southOf(box(4, 4, 3, f)), f)) for (const p of x.pts) expect(Number.isFinite(p.z) && Number.isFinite(p.x)).toBe(true);
    });

    it("el sólido anfitrión no cambia de bounds ni suma sólidos: solo caras después de cada pared", () => {
      const plain = tessellateAll(box(12, 4, 9, { floors: 3, cols: 4 }));
      const fancy = tessellateAll(box(12, 4, 9, rich));
      expect(fancy.filter((x) => x.mat === "office" && x.toneOffset === 0)).toEqual(plain.filter((x) => x.mat === "office" && x.toneOffset === 0));
    });

    it("los acentos del piso encendido no cambian con las opciones nuevas", () => {
      const walls = tessellate(tower).filter(isWall).filter((x) => x.toneOffset === 0 && x.mat === "office");
      expect(facadeAccents(walls, { ...rich, cols: 2, base: undefined, litFloor: 1 }, "amber")).toEqual(facadeAccents(walls, { floors: 3, cols: 2, litFloor: 1 }, "amber"));
    });
  });
});
