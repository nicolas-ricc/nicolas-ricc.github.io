// src/iso/solids.test.ts
import { describe, expect, it } from "vitest";
import { dot, v3, type Vec3 } from "./geometry";
import { shadeTone } from "./light";
import { facadeFaces } from "./facade";
import { bounds, isFlat, tessellate, tessellateAll, type Face, type Plate, type Solid } from "./solids";

const prism: Solid = { kind: "prism", at: v3(0, 0, 0), w: 2, d: 3, h: 4, mat: "concrete" };

describe("tessellate", () => {
  it("un prisma emite 6 caras en total y 3 visibles: techo, sur, este", () => {
    expect(tessellateAll(prism)).toHaveLength(6);
    const vis = tessellate(prism);
    expect(vis.map((f) => f.tone).sort()).toEqual(["lit", "shade", "top"]);
    const top = vis.find((f) => f.tone === "top")!;
    expect(top.pts.every((p) => p.z === 4)).toBe(true);
    const south = vis.find((f) => f.tone === "lit")!;
    expect(south.pts.every((p) => p.y === 3)).toBe(true);
    const east = vis.find((f) => f.tone === "shade")!;
    expect(east.pts.every((p) => p.x === 2)).toBe(true);
    expect(vis.every((f) => f.mat === "concrete" && f.toneOffset === 0)).toBe(true);
  });

  it("las normales apuntan hacia afuera sin importar el orden de los vértices", () => {
    for (const f of tessellateAll(prism)) {
      const c = { x: 1, y: 1.5, z: 2 };
      const fc = { x: f.pts.reduce((s, p) => s + p.x, 0) / f.pts.length, y: f.pts.reduce((s, p) => s + p.y, 0) / f.pts.length, z: f.pts.reduce((s, p) => s + p.z, 0) / f.pts.length };
      expect(f.normal.x * (fc.x - c.x) + f.normal.y * (fc.y - c.y) + f.normal.z * (fc.z - c.z)).toBeGreaterThan(0);
    }
  });

  it("techo a dos aguas: dos vertientes (up/down) y los hastiales como pentágonos", () => {
    const vis = tessellate({ ...prism, w: 10, d: 4, roof: "gable" });
    expect(vis.map((f) => f.tone)).toContain("up");
    expect(vis.map((f) => f.tone)).toContain("down");
    const east = vis.find((f) => f.pts.every((p) => p.x === 10))!;
    expect(east.pts).toHaveLength(5);
    expect(Math.max(...east.pts.map((p) => p.z))).toBeCloseTo(4 + 0.35 * 4);
  });

  it("techo escalonado: la caja más un segundo nivel más chico encima", () => {
    const all = tessellateAll({ ...prism, w: 10, d: 10, roof: "step" });
    expect(all).toHaveLength(12);
    const tops = all.filter((f) => f.tone === "top").map((f) => f.pts[0]!.z).sort();
    expect(tops).toEqual([4, 4 + 4 * 0.35]);
  });

  it("rampa hacia el este: el techo baja de oeste a este", () => {
    const vis = tessellate({ kind: "ramp", at: v3(0, 0, 0), w: 10, d: 4, h: 2, mat: "concrete", dir: "e" });
    const top = vis.find((f) => f.normal.z > 0.5)!;
    const west = top.pts.filter((p) => p.x === 0), east = top.pts.filter((p) => p.x === 10);
    expect(west.every((p) => p.z === 2)).toBe(true);
    expect(east.every((p) => p.z === 0)).toBe(true);
  });

  it("poly: prisma sobre una huella de 5 vértices, techo + 5 lados, solo los visibles", () => {
    const footprint = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 4 }];
    const s: Solid = { kind: "poly", footprint, z: 1, h: 3, mat: "rock" };
    expect(tessellateAll(s)).toHaveLength(7);
    const vis = tessellate(s);
    const top = vis.find((f) => f.tone === "top")!;
    expect(top.pts).toHaveLength(5);
    expect(top.pts.every((p) => p.z === 4)).toBe(true);
    expect(vis.length).toBeGreaterThanOrEqual(3);
    expect(vis.length).toBeLessThanOrEqual(5);
    expect(bounds(s)).toEqual({ min: { x: 0, y: 0, z: 1 }, max: { x: 8, y: 6, z: 4 } });
  });

  it("rampa hacia el sur: alto al norte, bajo al sur; hacia el norte, al revés", () => {
    const top = (dir: "n" | "s") => tessellate({ kind: "ramp", at: v3(0, 0, 0), w: 4, d: 10, h: 2, mat: "concrete", dir }).find((f) => f.normal.z > 0.5)!;
    const south = top("s");
    expect(south.pts.filter((p) => p.y === 0).every((p) => p.z === 2)).toBe(true);
    expect(south.pts.filter((p) => p.y === 10).every((p) => p.z === 0)).toBe(true);
    const north = top("n");
    expect(north.pts.filter((p) => p.y === 0).every((p) => p.z === 0)).toBe(true);
    expect(north.pts.filter((p) => p.y === 10).every((p) => p.z === 2)).toBe(true);
  });

  it("cilindro de 8 lados: techo octogonal y solo los lados que miran a la cámara", () => {
    const vis = tessellate({ kind: "cylinder", at: v3(0, 0, 0), r: 2, h: 5, mat: "steel" });
    const top = vis.find((f) => f.tone === "top")!;
    expect(top.pts).toHaveLength(8);
    const sides = vis.filter((f) => f.tone !== "top");
    expect(sides.length).toBeGreaterThanOrEqual(3);
    expect(sides.length).toBeLessThanOrEqual(5);
    expect(tessellateAll({ kind: "cylinder", at: v3(0, 0, 0), r: 2, h: 5, mat: "steel" })).toHaveLength(10);
  });

  it("cono de 6 lados: triángulos al ápice, sin techo", () => {
    const all = tessellateAll({ kind: "cone", at: v3(0, 0, 0), r: 2, h: 5, mat: "leaf" });
    expect(all).toHaveLength(7); // base + 6 lados
    expect(all.filter((f) => f.pts.length === 3)).toHaveLength(6);
    const vis = tessellate({ kind: "cone", at: v3(0, 0, 0), r: 2, h: 5, mat: "leaf" });
    expect(vis.every((f) => f.pts.length === 3)).toBe(true);
    expect(vis.some((f) => f.tone === "up")).toBe(true);
    expect(vis.some((f) => f.tone === "down")).toBe(true);
  });

  it("hull lofteado: proa en punta, popa redondeada, cubierta en deck, banda baja en mat y obra muerta en topMat, arrufo en la proa", () => {
    const s: Solid = { kind: "hull", at: v3(0, 0, 0), len: 20, beam: 4, h: 2, mat: "hull", topMat: "hullBlue" };
    const all = tessellateAll(s);
    expect(all).toHaveLength(2 + 10 * 4); // cubierta, base, 10 lados × (2 bandas × 2 triángulos)
    const deck = all.find((f) => f.normal.z > 0.99)!;
    expect(deck.mat).toBe("deck"); expect(deck.pts).toHaveLength(10);
    expect(Math.max(...deck.pts.map((p) => p.x))).toBeCloseTo(20, 6); // proa
    expect(Math.min(...deck.pts.map((p) => p.x))).toBeCloseTo(0, 6);  // popa
    expect(deck.pts.find((p) => p.x === 20)!.z).toBeCloseTo(2 * 1.25, 6); // arrufo de proa
    expect(deck.pts.find((p) => p.x === 0)!.z).toBeCloseTo(2 * 1.1, 6);  // arrufo de popa
    const sides = all.filter((f) => Math.abs(f.normal.z) < 0.99 && f.normal.z > -0.5);
    expect(sides.filter((f) => f.mat === "hull").length).toBe(20);
    expect(sides.filter((f) => f.mat === "hullBlue").length).toBe(20);
    const b = bounds(s);
    expect(b.min.x).toBeCloseTo(0, 6); expect(b.max.x).toBeCloseTo(20, 6);
    expect(b.min.y).toBeCloseTo(-2, 6); expect(b.max.y).toBeCloseTo(2, 6);
    expect(b.max.z).toBeCloseTo(2.5, 6);
    const mono = tessellateAll({ kind: "hull", at: v3(0, 0, 0), len: 20, beam: 4, h: 2, mat: "hull" });
    expect(mono.every((f) => f.mat === "hull")).toBe(true); // sin topMat: monocromo (astillero)
  });

  it("hull con heading π/2 tiene la proa al sur (+y) y gira alrededor de la popa", () => {
    const pts = tessellateAll({ kind: "hull", at: v3(10, 20, 0), len: 20, beam: 4, h: 2, mat: "hull", heading: Math.PI / 2 }).flatMap((f) => f.pts);
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(40, 6);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(20, 6);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(8, 6);
  });

  it("poly con facade emite ventanas y losas sobre sus paredes", () => {
    const fp = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    const plain = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "whitewash" });
    const withFacade = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "whitewash", facade: { floors: 1, cols: 2 } });
    expect(withFacade.length).toBeGreaterThan(plain.length);
    expect(withFacade.some((f) => f.mat === "glass")).toBe(true);
  });

  it("franja: un cuadrilátero horizontal por segmento, sin descarte", () => {
    const s: Solid = { kind: "strip", path: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], width: 2, z: -0.4, mat: "road" };
    const vis = tessellate(s);
    expect(vis).toHaveLength(2);
    expect(vis[0]!.pts).toHaveLength(4);
    expect(vis[0]!.pts.every((p) => p.z === -0.4)).toBe(true);
    expect(vis[0]!.tone).toBe("top");
    expect(isFlat(s)).toBe(true);
  });

  it("suelo: cada triángulo con su tono por inclinación y su offset", () => {
    const s: Solid = {
      kind: "ground", mat: "slab",
      tris: [
        { pts: [v3(0, 0, 0), v3(6, 0, 0), v3(0, 6, 0)] },
        { pts: [v3(6, 0, 0), v3(6, 6, 2), v3(0, 6, 0)], toneOffset: 1 },
      ],
    };
    const vis = tessellate(s);
    expect(vis).toHaveLength(2);
    expect(vis[0]!.tone).toBe("top");
    expect(vis[0]!.toneOffset).toBe(0);
    expect(vis[1]!.tone).not.toBe("top");
    expect(vis[1]!.toneOffset).toBe(1);
    expect(vis.every((f) => f.normal.z > 0)).toBe(true);
  });
});

describe("bounds", () => {
  it("AABB de un prisma", () => {
    expect(bounds({ kind: "prism", at: v3(1, 2, 3), w: 4, d: 5, h: 6, mat: "steel" })).toEqual({ min: { x: 1, y: 2, z: 3 }, max: { x: 5, y: 7, z: 9 } });
  });
  it("AABB de un gable incluye la cumbrera", () => {
    expect(bounds({ kind: "prism", at: v3(0, 0, 0), w: 10, d: 4, h: 4, mat: "steel", roof: "gable" }).max.z).toBeCloseTo(5.4);
  });
  it("AABB de un suelo", () => {
    const b = bounds({ kind: "ground", mat: "slab", tris: [{ pts: [v3(0, 0, -1), v3(6, 0, 0), v3(0, 6, 1)] }] });
    expect(b).toEqual({ min: { x: 0, y: 0, z: -1 }, max: { x: 6, y: 6, z: 1 } });
  });
});

describe("wheel", () => {
  it("wheel: anillo vertical en el plano (1, −1, 0) con rayos, cubo y góndolas colgando; girar mueve las góndolas y todo el anillo cumple x + y = const", () => {
    const w: Solid = { kind: "wheel", at: v3(100, 50, 17), r: 14, width: 1.2, mat: "steel", sides: 16, angle: 0, gondolas: { mat: "rust", w: 1.6, d: 1.2, h: 1.4 } };
    const faces = tessellateAll(w);
    expect(faces.filter((f) => f.mat === "steel").length).toBe(16 + 16 + 1); // sectores, rayos, cubo
    for (const f of faces.filter((f) => f.mat === "steel")) { expect(f.tone).toBe("top"); for (const p of f.pts) expect(p.x + p.y).toBeCloseTo(150, 6); }
    expect(faces.filter((f) => f.mat === "rust").length).toBe(16 * 6);
    const b = bounds(w);
    expect(b.max.z).toBeCloseTo(31, 6); expect(b.min.z).toBeLessThan(3.1);
    const top0 = tessellateAll(w).filter((f) => f.mat === "rust").flatMap((f) => f.pts).sort((p, q) => q.z - p.z)[0]!;
    const top1 = tessellateAll({ ...w, angle: Math.PI / 16 }).filter((f) => f.mat === "rust").flatMap((f) => f.pts).sort((p, q) => q.z - p.z)[0]!;
    expect(Math.hypot(top0.x - top1.x, top0.y - top1.y)).toBeGreaterThan(1);
    expect(tessellate(w).filter((f) => f.mat === "steel").length).toBe(33); // mira a la cámara: nada se descarta
  });
});

describe("viga (beam)", () => {
  const beam = (from: Vec3, to: Vec3, w: number, h: number): Solid => ({ kind: "beam", from, to, w, h, mat: "steel" });
  const corners = (s: Solid) => tessellateAll(s).flatMap((f) => f.pts);
  const finite = (s: Solid) => corners(s).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

  it("horizontal: los bounds coinciden con los de la caja equivalente", () => {
    const b = bounds(beam(v3(0, 1, 2), v3(4, 1, 2), 2, 1));
    const box = bounds({ kind: "prism", at: v3(0, 0, 1.5), w: 4, d: 2, h: 1, mat: "steel" });
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(box.min[k], 9); expect(b.max[k]).toBeCloseTo(box.max[k], 9); }
  });

  it("a 45°: los bounds son exactamente los de sus 8 vértices, con la sección nivelada", () => {
    const r = Math.SQRT1_2, w = 0.4, h = 0.6;
    // eje (1, 0, 1)/√2; lado (0, 1, 0); arriba (−1, 0, 1)/√2
    const pts: Vec3[] = [];
    for (const e of [v3(0, 0, 0), v3(3, 0, 3)]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      pts.push(v3(e.x - sz * r * h / 2, e.y + sy * w / 2, e.z + sz * r * h / 2));
    const b = bounds(beam(v3(0, 0, 0), v3(3, 0, 3), w, h));
    const ax = (k: "x" | "y" | "z") => pts.map((p) => p[k]);
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(Math.min(...ax(k)), 9); expect(b.max[k]).toBeCloseTo(Math.max(...ax(k)), 9); }
    // nivelada: cada vértice tiene su pareja de la arista de ancho a la misma z y a `w` en planta
    const all = corners(beam(v3(0, 0, 0), v3(3, 2, 3), w, h));
    for (const p of all)
      expect(all.some((q) => Math.abs(q.z - p.z) < 1e-9 && Math.abs(Math.hypot(q.x - p.x, q.y - p.y) - w) < 1e-9)).toBe(true);
  });

  it("teselación: 6 caras planas, cerradas (cada arista la comparten dos caras) y con la normal hacia afuera", () => {
    const s = beam(v3(1, 2, 0.5), v3(4, 0, 5), 0.5, 0.8);
    const faces = tessellateAll(s);
    expect(faces).toHaveLength(6);
    const key = (p: Vec3) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
    const edges = new Map<string, number>();
    const mid = v3(2.5, 1, 2.75);
    for (const f of faces) {
      expect(f.pts).toHaveLength(4);
      for (const p of f.pts) expect(dot(f.normal, v3(p.x - f.pts[0]!.x, p.y - f.pts[0]!.y, p.z - f.pts[0]!.z))).toBeCloseTo(0, 9); // plana
      expect(dot(f.normal, v3(f.pts[0]!.x - mid.x, f.pts[0]!.y - mid.y, f.pts[0]!.z - mid.z))).toBeGreaterThan(0); // hacia afuera
      f.pts.forEach((p, i) => { const q = f.pts[(i + 1) % 4]!; const e = [key(p), key(q)].sort().join("|"); edges.set(e, (edges.get(e) ?? 0) + 1); });
    }
    expect(edges.size).toBe(12);
    for (const n of edges.values()) expect(n).toBe(2);
  });

  it("sombreado coherente: la cara de arriba de una viga horizontal es 'top' y las visibles salen por tessellate", () => {
    const faces = tessellateAll(beam(v3(0, 0, 1), v3(4, 0, 1), 1, 1));
    expect(faces.filter((f) => f.tone === "top")).toHaveLength(1);
    expect(tessellate(beam(v3(0, 0, 1), v3(4, 0, 1), 1, 1)).every((f) => f.mat === "steel")).toBe(true);
  });

  it("invertir from/to da los mismos bounds; una viga que baja también", () => {
    const a = bounds(beam(v3(0, 0, 0), v3(3, 1, 3), 0.4, 0.6)), b = bounds(beam(v3(3, 1, 3), v3(0, 0, 0), 0.4, 0.6));
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(a.min[k], 9); expect(b.max[k]).toBeCloseTo(a.max[k], 9); }
  });

  it("vertical: sección w sobre y, h sobre x, sin NaN", () => {
    const s = beam(v3(0, 0, 0), v3(0, 0, 5), 2, 1);
    expect(finite(s)).toBe(true);
    const b = bounds(s);
    expect(b.max.y - b.min.y).toBeCloseTo(2, 9); expect(b.max.x - b.min.x).toBeCloseTo(1, 9); expect(b.max.z - b.min.z).toBeCloseTo(5, 9);
  });

  it("largo cero no rompe: vértices y bounds finitos, tessellate no tira", () => {
    const s = beam(v3(1, 1, 1), v3(1, 1, 1), 0.4, 0.4);
    expect(finite(s)).toBe(true);
    const b = bounds(s);
    for (const k of ["x", "y", "z"] as const) { expect(Number.isFinite(b.min[k])).toBe(true); expect(Number.isFinite(b.max[k])).toBe(true); }
    expect(() => tessellate(s)).not.toThrow();
    for (const f of tessellateAll(s)) expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
  });

  it("a 45°: cada cara lleva el tono que shadeTone da a su normal; la cara de arriba es vertiente", () => {
    const faces = tessellateAll(beam(v3(0, 0, 4), v3(4.5, 0, 8.5), 0.4, 0.5));
    for (const f of faces) expect(f.tone).toBe(shadeTone(f.normal));
    expect(faces.some((f) => f.tone === "up" || f.tone === "down")).toBe(true);
  });
});

describe("no regresión de las placas", () => {
  it("un prisma sin plates tesela exactamente igual que antes de las placas", () => {
    expect(tessellateAll({ kind: "prism", at: v3(1, 2, 0), w: 3, d: 2, h: 4, mat: "brick" })).toMatchInlineSnapshot(`
      [
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "top",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -0,
            "y": -0,
            "z": -1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
      ]
    `);
    expect(tessellateAll({ kind: "prism", at: v3(1, 2, 0), w: 3, d: 2, h: 4, mat: "brick", facade: { floors: 1, cols: 1 } })).toMatchInlineSnapshot(`
      [
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "top",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -0,
            "y": -0,
            "z": -1,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1.75,
              "y": 2,
              "z": 1,
            },
            {
              "x": 3.25,
              "y": 2,
              "z": 1,
            },
            {
              "x": 3.25,
              "y": 2,
              "z": 3,
            },
            {
              "x": 1.75,
              "y": 2,
              "z": 3,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2.5,
              "z": 1,
            },
            {
              "x": 4,
              "y": 3.5,
              "z": 1,
            },
            {
              "x": 4,
              "y": 3.5,
              "z": 3,
            },
            {
              "x": 4,
              "y": 2.5,
              "z": 3,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 2,
              "z": 4,
            },
          ],
          "tone": "shade",
          "toneOffset": -1,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 3.25,
              "y": 4,
              "z": 1,
            },
            {
              "x": 1.75,
              "y": 4,
              "z": 1,
            },
            {
              "x": 1.75,
              "y": 4,
              "z": 3,
            },
            {
              "x": 3.25,
              "y": 4,
              "z": 3,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": 0,
            "y": 1,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
            {
              "x": 4,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 4,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 0,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "glass",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 3.5,
              "z": 1,
            },
            {
              "x": 1,
              "y": 2.5,
              "z": 1,
            },
            {
              "x": 1,
              "y": 2.5,
              "z": 3,
            },
            {
              "x": 1,
              "y": 3.5,
              "z": 3,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "brick",
          "normal": {
            "x": -1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 1,
              "y": 4,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 2,
              "z": 3.7,
            },
            {
              "x": 1,
              "y": 2,
              "z": 4,
            },
            {
              "x": 1,
              "y": 4,
              "z": 4,
            },
          ],
          "tone": "lit",
          "toneOffset": -1,
        },
      ]
    `);
    expect(tessellateAll({ kind: "ramp", at: v3(0, 0, 0), w: 4, d: 2, h: 2, mat: "steel", dir: "s" })).toMatchInlineSnapshot(`
      [
        {
          "mat": "steel",
          "normal": {
            "x": -0,
            "y": -0,
            "z": -1,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 0,
            "y": 0.7071067811865475,
            "z": 0.7071067811865475,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 2,
            },
            {
              "x": 4,
              "y": 0,
              "z": 2,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
          ],
          "tone": "up",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": -1,
            "y": -0,
            "z": -0,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 0,
              "z": 2,
            },
          ],
          "tone": "lit",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 1,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 4,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 2,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 0,
            "y": -1,
            "z": 0,
          },
          "pts": [
            {
              "x": 0,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 0,
            },
            {
              "x": 4,
              "y": 0,
              "z": 2,
            },
            {
              "x": 0,
              "y": 0,
              "z": 2,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
        {
          "mat": "steel",
          "normal": {
            "x": 0,
            "y": 0,
            "z": 0,
          },
          "pts": [
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 4,
              "y": 2,
              "z": 0,
            },
            {
              "x": 0,
              "y": 2,
              "z": 0,
            },
          ],
          "tone": "shade",
          "toneOffset": 0,
        },
      ]
    `);
  });
});

describe("placas", () => {
  const P: Solid & { kind: "prism" } = { kind: "prism", at: v3(0, 0, 0), w: 4, d: 3, h: 6, mat: "brick" };
  const plate = (wall: number, extra: Partial<Plate> = {}): Plate => ({ wall, shape: "rect", u0: 0.25, u1: 0.75, z0: 1, z1: 3, mat: "steel", ...extra });
  const near = (a: number, lo: number, hi: number) => a >= lo - 1e-9 && a <= hi + 1e-9;
  const isSouth = (f: Face) => f.mat === "brick" && f.pts.every((p) => p.y === 3) && Math.abs(f.normal.z) < 1e-6;

  it("rect en la pared sur: sale justo después de la cara sur, coplanar y dentro de su rectángulo", () => {
    const s = { ...P, plates: [plate(2)] };
    for (const faces of [tessellateAll(s), tessellate(s)]) {
      const i = faces.findIndex(isSouth);
      expect(i).toBeGreaterThanOrEqual(0);
      const pl = faces[i + 1]!;
      expect(pl.mat).toBe("steel");
      expect(pl.normal).toEqual(faces[i]!.normal);
      expect(pl.tone).toBe(faces[i]!.tone);
      expect(pl.toneOffset).toBe(0);
      expect(pl.pts).toHaveLength(4);
      for (const p of pl.pts) { expect(p.y).toBe(3); expect(near(p.x, 1, 3)).toBe(true); expect(near(p.z, 1, 3)).toBe(true); }
      expect(faces.filter((f) => f.mat === "steel")).toHaveLength(1);
    }
  });

  it("toneOffset de la placa se respeta", () => {
    const pl = tessellateAll({ ...P, plates: [plate(2, { toneOffset: -2 })] }).find((f) => f.mat === "steel")!;
    expect(pl.toneOffset).toBe(-2);
  });

  it("placa en la pared norte: está en tessellateAll con la normal norte y no aparece en tessellate", () => {
    const s = { ...P, plates: [plate(0)] };
    const all = tessellateAll(s).find((f) => f.mat === "steel")!;
    expect(all.normal.y).toBeLessThan(0);
    expect(all.pts.every((p) => p.y === 0)).toBe(true);
    expect(tessellate(s).some((f) => f.mat === "steel")).toBe(false);
  });

  it("disc: octógono de 8 puntos que toca los cuatro bordes del rectángulo; tri: 3 puntos con vértice arriba al medio", () => {
    const disc = tessellateAll({ ...P, plates: [plate(2, { shape: "disc" })] }).find((f) => f.mat === "steel")!;
    expect(disc.pts).toHaveLength(8);
    for (const p of disc.pts) { expect(p.y).toBe(3); expect(near(p.x, 1, 3)).toBe(true); expect(near(p.z, 1, 3)).toBe(true); }
    expect(Math.min(...disc.pts.map((p) => p.x))).toBeCloseTo(1, 9);
    expect(Math.max(...disc.pts.map((p) => p.x))).toBeCloseTo(3, 9);
    expect(Math.min(...disc.pts.map((p) => p.z))).toBeCloseTo(1, 9);
    expect(Math.max(...disc.pts.map((p) => p.z))).toBeCloseTo(3, 9);
    const tri = tessellateAll({ ...P, plates: [plate(2, { shape: "tri" })] }).find((f) => f.mat === "steel")!;
    expect(tri.pts).toHaveLength(3);
    const exp = [v3(1, 3, 1), v3(3, 3, 1), v3(2, 3, 3)];
    tri.pts.forEach((p, k) => { for (const c of ["x", "y", "z"] as const) expect(p[c]).toBeCloseTo(exp[k]![c], 9); });
  });

  it("poly de 5 lados: la placa de wall 3 cae sobre la arista 3, y una de wall 1 recorre la arista diagonal", () => {
    const footprint = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 4 }];
    const s: Solid = { kind: "poly", footprint, z: 1, h: 3, mat: "rock", plates: [plate(3, { u0: 0, u1: 1, z0: 2, z1: 3 }), plate(1, { mat: "glass", z0: 2, z1: 3 })] };
    const all = tessellateAll(s);
    const edge3 = all.findIndex((f) => f.mat === "rock" && f.pts.length === 4 && f.pts.some((p) => p.x === 4 && p.y === 6) && f.pts.some((p) => p.x === 0 && p.y === 4));
    expect(edge3).toBeGreaterThanOrEqual(0);
    const pl = all[edge3 + 1]!;
    expect(pl.mat).toBe("steel");
    expect(pl.normal).toEqual(all[edge3]!.normal);
    const plan = pl.pts.map((p) => `${p.x},${p.y}`);
    expect(plan).toContain("4,6");
    expect(plan).toContain("0,4");
    const diag = all.find((f) => f.mat === "glass")!;
    const xs = diag.pts.map((p) => p.x), ys = diag.pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(6.5, 9); expect(Math.max(...xs)).toBeCloseTo(7.5, 9);
    expect(Math.min(...ys)).toBeCloseTo(0.75, 9); expect(Math.max(...ys)).toBeCloseTo(2.25, 9);
  });

  it("facade y plates en la misma pared: primero la pared, luego la fachada, luego las placas; las otras paredes no la llevan", () => {
    const facade = { floors: 2, cols: 1 };
    const all = tessellateAll({ ...P, facade, plates: [plate(2)] });
    const i = all.findIndex(isSouth);
    const n = facadeFaces(all[i]!, facade).length;
    expect(n).toBeGreaterThan(0);
    for (const f of all.slice(i + 1, i + 1 + n)) expect(f.mat === "glass" || (f.mat === "brick" && f.toneOffset === -1)).toBe(true);
    expect(all[i + 1 + n]!.mat).toBe("steel");
    expect(all.filter((f) => f.mat === "steel")).toHaveLength(1);
  });

  it("dos placas en la misma pared salen en el orden del arreglo, después de la pared este", () => {
    const all = tessellateAll({ ...P, plates: [plate(1, { mat: "steel" }), plate(1, { mat: "glass" })] });
    const i = all.findIndex((f) => f.mat === "brick" && f.pts.every((p) => p.x === 4) && Math.abs(f.normal.z) < 1e-6);
    expect(all[i + 1]!.mat).toBe("steel");
    expect(all[i + 2]!.mat).toBe("glass");
  });

  it("bounds igual con y sin placas, aun con una placa que sobresale", () => {
    expect(bounds({ ...P, plates: [plate(2)] })).toEqual(bounds(P));
    expect(bounds({ ...P, plates: [plate(2, { u0: -0.5, u1: 1.5, z0: 5, z1: 9 })] })).toEqual(bounds(P));
  });

  it("roof gable ignora las placas; roof step las aplica solo a la caja", () => {
    const gable = { ...P, roof: "gable" as const };
    expect(tessellateAll({ ...gable, plates: [plate(2)] })).toEqual(tessellateAll(gable));
    const step = tessellateAll({ ...P, roof: "step", plates: [plate(2)] });
    expect(step.filter((f) => f.mat === "steel")).toHaveLength(1);
    const i = step.findIndex((f) => f.mat === "steel");
    expect(isSouth(step[i - 1]!)).toBe(true);
  });

  it("wall fuera de rango: no tira y no emite placa", () => {
    for (const wall of [4, -1, 1.5]) expect(tessellateAll({ ...P, plates: [plate(wall)] })).toEqual(tessellateAll(P));
  });

  describe("en ramp", () => {
    const R: Solid & { kind: "ramp" } = { kind: "ramp", at: v3(0, 0, 0), w: 4, d: 2, h: 2, mat: "steel", dir: "n" };
    const rp = (wall: number, extra: Partial<Plate> = {}): Plate => plate(wall, { mat: "glass", z0: 0.2, z1: 0.8, ...extra });
    const wallOf = (faces: Face[], pred: (p: Vec3) => boolean) => faces.findIndex((f) => f.mat === "steel" && Math.abs(f.normal.z) < 1e-6 && f.pts.every(pred));

    it("placa en wall 2: sale después del lado sur, en tessellateAll y en tessellate", () => {
      const s = { ...R, plates: [rp(2)] };
      for (const faces of [tessellateAll(s), tessellate(s)]) {
        const i = wallOf(faces, (p) => p.y === 2);
        expect(i).toBeGreaterThanOrEqual(0);
        const pl = faces[i + 1]!;
        expect(pl.mat).toBe("glass");
        expect(pl.normal).toEqual(faces[i]!.normal);
        expect(pl.pts.every((p) => p.y === 2)).toBe(true);
      }
    });

    it("placa en wall 3 (oeste): recorre la arista de (0, 2) a (0, 0), después de la pared oeste", () => {
      const all = tessellateAll({ ...R, plates: [rp(3, { u0: 0.1, u1: 0.3, z0: 0.5, z1: 1.5 })] });
      const i = wallOf(all, (p) => p.x === 0);
      const pl = all[i + 1]!;
      expect(pl.mat).toBe("glass");
      expect(pl.normal).toEqual(all[i]!.normal);
      for (const p of pl.pts) { expect(p.x).toBe(0); expect(near(p.y, 1.4, 1.8)).toBe(true); }
    });

    it("placa en wall 1 más alta que el perfil: no se recorta", () => {
      const pl = tessellateAll({ ...R, plates: [rp(1, { u0: 0, u1: 0.2, z0: 0.5, z1: 1.9 })] }).find((f) => f.mat === "glass")!;
      expect(Math.max(...pl.pts.map((p) => p.z))).toBeCloseTo(1.9, 9);
      expect(pl.pts.every((p) => p.x === 4)).toBe(true);
    });

    it("bounds igual con y sin placas", () => {
      expect(bounds({ ...R, plates: [rp(2), rp(1, { z1: 5 })] })).toEqual(bounds(R));
    });
  });
});
