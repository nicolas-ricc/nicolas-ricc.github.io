import { describe, expect, it } from "vitest";
import { ARCH_SEGMENTS, bandTone, facadeAccents, facadeFaces, facadeWindows, isWall, windowPatches, type Facade } from "./facade";
import { v3 } from "./geometry";
import { tessellate, tessellateAll, type Face, type Solid } from "./solids";

const tower: Solid & { kind: "prism" } = { kind: "prism", at: v3(0, 0, 0), w: 4, d: 4, h: 6, mat: "office", facade: { floors: 3, cols: 2 } };
const zspan = (f: Face) => Math.max(...f.pts.map((p) => p.z)) - Math.min(...f.pts.map((p) => p.z));

describe("fachada", () => {
  it("por cada pared visible: la pared, luego por piso una banda, 2 ventanas de vidrio y una losa oscura", () => {
    const vis = tessellate(tower);
    const walls = vis.filter((f) => isWall(f) && f.mat === "office" && zspan(f) === tower.h);
    expect(walls).toHaveLength(2);
    expect(vis).toHaveLength(3 + 2 * 12); // techo + 2 paredes, y por pared 3 bandas + 6 ventanas + 3 losas
    for (const wall of walls) {
      const i = vis.indexOf(wall);
      const after = vis.slice(i + 1, i + 13);
      expect(after.map((f) => (f.mat === "glass" ? "v" : zspan(f) === 2 ? "b" : "l")).join("")).toBe("bvvlbvvlbvvl");
      for (const f of after) expect(f.normal).toEqual(wall.normal); // coplanares: se pintan encima
    }
  });

  it("bandas por altura: 0, 1, 2 por tercios en 6 pisos; 0, 1, 1 en 3; 0 en 1", () => {
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

  it("cada banda cubre su piso entero, de lado a lado de la pared", () => {
    const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!; // pared sur, x 0..4
    const bands = facadeFaces(wall, tower.facade!).filter((x) => x.mat === "office" && zspan(x) === 2);
    expect(bands.map((b) => [Math.min(...b.pts.map((p) => p.z)), Math.max(...b.pts.map((p) => p.z))])).toEqual([[0, 2], [2, 4], [4, 6]]);
    for (const b of bands) expect([Math.min(...b.pts.map((p) => p.x)), Math.max(...b.pts.map((p) => p.x))]).toEqual([0, 4]);
  });

  it("bands: false reproduce la fachada sin gradiente: por piso ventanas y losa", () => {
    const f: Facade = { ...tower.facade!, bands: false };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const faces = facadeFaces(wall, f);
    expect(faces.map((x) => (x.mat === "glass" ? "v" : x.toneOffset === -1 ? "l" : "?")).join("")).toBe("vvlvvlvvl");
    expect(facadeFaces(wall, tower.facade!).filter((x) => !(x.mat === "office" && zspan(x) === 2))).toEqual(faces);
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
    // las bandas de la fachada comparten tono con la pared: las paredes salen del sólido sin fachada
    const walls = tessellate({ ...tower, facade: undefined }).filter(isWall).filter((x) => x.toneOffset === 0 && x.mat === "office");
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

describe("arcada", () => {
  const f: Facade = { floors: 2, cols: 3, base: "arcade" };
  const wall = tessellateAll({ ...tower, facade: f }).find((x) => isWall(x) && x.pts.every((p) => p.y === 4))!; // pared sur, x 0..4, z 0..6
  const faces = facadeFaces(wall, f);
  const fh = 3;
  const arches = faces.filter((x) => x.toneOffset === -2);

  it("un arco por columna, cada uno un polígono de 9 puntos: 2 de la base del rectángulo y los 7 del semicírculo de 6 segmentos", () => {
    expect(arches).toHaveLength(3);
    // las dos esquinas superiores del rectángulo son los extremos del semicírculo: 4 − 2 + 7 = 9
    for (const a of arches) expect(a.pts).toHaveLength(2 + ARCH_SEGMENTS + 1);
    for (const a of arches) {
      expect(a.mat).toBe("office");
      expect(Math.min(...a.pts.map((p) => p.z))).toBeCloseTo(0);
      expect(Math.max(...a.pts.map((p) => p.z))).toBeCloseTo(fh * 0.8);
      expect(a.pts[2]!.z).toBeCloseTo(fh * 0.45); // arranque del arco
      expect(a.pts[8]!.z).toBeCloseTo(fh * 0.45);
    }
  });

  it("arcos de 0.7 del ancho de columna, centrados en su columna", () => {
    const cw = 4 / 3;
    // la base de la pared sur va de x 4 a 0: las columnas se cuentan a lo largo de la base, así que se comparan los centros ordenados
    const centers = arches.map((a) => {
      const xs = a.pts.map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.7 * cw);
      return (Math.max(...xs) + Math.min(...xs)) / 2;
    }).sort((a, b) => a - b);
    centers.forEach((c, k) => expect(c).toBeCloseTo((k + 0.5) * cw));
  });

  it("pilares a −1 emitidos antes de los arcos, después de la banda; sin ventanas en el piso 0", () => {
    const iPillar = faces.findIndex((x) => x.toneOffset === -1 && Math.max(...x.pts.map((p) => p.z)) === fh * 0.85);
    expect(iPillar).toBe(1); // 0 es la banda del piso
    expect(faces.findIndex((x) => x.toneOffset === -2)).toBe(2);
    expect(faces.filter((x) => x.mat === "glass")).toHaveLength(3); // solo el piso 1
    expect(windowPatches(wall, f, 0)).toEqual([]);
    expect(facadeAccents([wall], { ...f, litFloor: 0 }, "amber")).toEqual([]); // como el pórtico: el piso 0 no tiene ventanas que encender
  });

  it("ningún polígono sale de la pared ni de su piso", () => {
    for (const x of faces.slice(0, 2 + 3)) { // banda, pilares y los 3 arcos del piso 0
      for (const p of x.pts) {
        expect(p.y).toBe(4);
        expect(p.x).toBeGreaterThanOrEqual(-1e-9);
        expect(p.x).toBeLessThanOrEqual(4 + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(-1e-9);
        expect(p.z).toBeLessThanOrEqual(fh + 1e-9);
      }
    }
  });

  it("con bands: false el piso 0 empieza por los pilares", () => {
    const raw = facadeFaces(wall, { ...f, bands: false });
    expect(raw[0]!.toneOffset).toBe(-1);
    expect(raw.slice(1, 4).every((x) => x.toneOffset === -2)).toBe(true);
  });
});

describe("fachada en cylinder", () => {
  const drum: Solid = { kind: "cylinder", at: v3(0, 0, 0), r: 4, h: 6, mat: "office", sides: 12, facade: { floors: 3, cols: 1 } };
  const plain: Solid = { ...drum, facade: undefined };

  it("cada pared lleva su fachada: 3 bandas, 3 ventanas y 3 losas detrás de ella", () => {
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

  it("tessellate descarta las paredes de espaldas junto con su fachada", () => {
    const vis = tessellate(drum), visWalls = tessellate(plain).filter(isWall);
    expect(vis).toHaveLength(1 + visWalls.length * 10); // techo + cada pared visible con sus 9 caras
  });
});

describe("facadeWindows", () => {
  const wallOf = (s: Solid) => tessellateAll(s).find((x) => isWall(x) && x.pts.every((p) => p.y === 4))!;

  it("cols · floors sin base; cols · (floors − 1) con cualquier base", () => {
    expect(facadeWindows(wallOf(tower), tower.facade!)).toHaveLength(2 * 3);
    for (const base of ["glass", "portico", "arcade"] as const) {
      const f: Facade = { floors: 3, cols: 2, base };
      expect(facadeWindows(wallOf({ ...tower, facade: f }), f)).toHaveLength(2 * 2);
    }
    const one: Facade = { floors: 1, cols: 4, base: "glass" };
    expect(facadeWindows(wallOf({ ...tower, facade: one }), one)).toEqual([]);
  });

  it("cada ventana lleva su piso y cae dentro de él, también con la pared elevada", () => {
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

  it("coinciden con las ventanas de vidrio de facadeFaces", () => {
    const f: Facade = { floors: 3, cols: 2, base: "arcade" };
    const wall = wallOf({ ...tower, facade: f });
    expect(facadeWindows(wall, f).map((w) => w.pts)).toEqual(facadeFaces(wall, f).filter((x) => x.mat === "glass").map((x) => x.pts));
  });
});
