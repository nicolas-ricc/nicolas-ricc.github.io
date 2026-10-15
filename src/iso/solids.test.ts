// src/iso/solids.test.ts
import { describe, expect, it } from "vitest";
import { v3 } from "./geometry";
import { bounds, GABLE_RATIO, isFlat, tessellate, tessellateAll, type Solid } from "./solids";

const prism: Solid = { kind: "prism", at: v3(0, 0, 0), w: 2, d: 3, h: 4, mat: "concrete" };

/** Punto en polígono por paridad de cruces (2D). */
function inside(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

const mean = (pts: { x: number; y: number }[], k: "x" | "y"): number => pts.reduce((a, p) => a + p[k], 0) / pts.length;

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

describe("orientación por sentido de giro", () => {
  it("poly cóncavo (L): cada pared apunta hacia afuera en los dos sentidos de giro", () => {
    const L = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }];
    for (const footprint of [L, [...L].reverse()]) {
      const walls = tessellateAll({ kind: "poly", footprint, z: 0, h: 3, mat: "concrete" }).filter((f) => Math.abs(f.normal.z) < 1e-6);
      expect(walls).toHaveLength(6);
      for (const f of walls) {
        expect(Math.hypot(f.normal.x, f.normal.y)).toBeCloseTo(1, 9);
        const cx = mean(f.pts, "x"), cy = mean(f.pts, "y");
        expect(inside({ x: cx + 0.1 * f.normal.x, y: cy + 0.1 * f.normal.y }, L)).toBe(false);
      }
    }
  });

  it("una huella ya canónica no se invierte: la pared i va de footprint[i] a footprint[i+1]", () => {
    const fp = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 6 }, { x: 0, y: 4 }];
    const walls = tessellateAll({ kind: "poly", footprint: fp, z: 0, h: 3, mat: "rock" }).slice(2);
    walls.forEach((f, i) => {
      expect({ x: f.pts[0]!.x, y: f.pts[0]!.y }).toEqual(fp[i]);
      expect({ x: f.pts[1]!.x, y: f.pts[1]!.y }).toEqual(fp[(i + 1) % fp.length]);
    });
  });
});

describe("tone", () => {
  it("tone: 1 suma una unidad al toneOffset de todas las caras, también las de fachada y del techo escalonado", () => {
    const cases: Solid[] = [prism, { ...prism, facade: { floors: 2, cols: 2 } }, { ...prism, w: 10, d: 10, roof: "step" }];
    for (const s of cases) {
      const plain = tessellateAll(s), toned = tessellateAll({ ...s, tone: 1 });
      expect(toned).toHaveLength(plain.length);
      toned.forEach((f, i) => expect(f.toneOffset).toBe(plain[i]!.toneOffset + 1));
    }
    expect(tessellateAll({ ...prism, facade: { floors: 2, cols: 2 } }).some((f) => f.mat === "glass")).toBe(true);
  });
});

describe("hip", () => {
  const hipOf = (w: number, d: number): Solid => ({ kind: "prism", at: v3(1, 2, 3), w, d, h: 4, mat: "concrete", roof: "hip" });
  const slopes = (s: Solid) => tessellateAll(s).filter((f) => f.normal.z > 0.3 && f.normal.z < 0.997);

  it("techo a cuatro aguas: 9 caras, cuatro faldones inclinados, cumbrera a h·(1 + GABLE_RATIO)", () => {
    for (const s of [hipOf(10, 6), hipOf(6, 10)]) {
      expect(tessellateAll(s)).toHaveLength(9);
      expect(slopes(s)).toHaveLength(4);
      expect(bounds(s).max.z).toBeCloseTo(3 + 4 * (1 + GABLE_RATIO), 9);
    }
    expect(bounds(hipOf(6, 10))).toEqual({ min: { x: 1, y: 2, z: 3 }, max: { x: 7, y: 12, z: expect.closeTo(3 + 4 * (1 + GABLE_RATIO), 9) } });
  });

  it("hip con w === d: la cumbrera es un punto y ninguna normal es NaN", () => {
    const all = tessellateAll(hipOf(6, 6));
    expect(all).toHaveLength(9);
    for (const f of all) expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
    expect(slopes(hipOf(6, 6))).toHaveLength(4);
  });
});

describe("dome", () => {
  const d: Solid = { kind: "dome", at: v3(10, 20, 2), r: 4, h: 3, mat: "concrete" };

  it("cúpula 12×3: 37 caras, laterales sin mirar al suelo, base hacia abajo y descartada", () => {
    const all = tessellateAll(d);
    expect(all).toHaveLength(37);
    const base = all.filter((f) => f.pts.every((p) => p.z === 2));
    expect(base).toHaveLength(1);
    expect(base[0]!.normal.z).toBeLessThan(0);
    for (const f of all.filter((f) => f !== base[0])) expect(f.normal.z).toBeGreaterThanOrEqual(0);
    expect(all.filter((f) => f.pts.length === 3)).toHaveLength(12);
    expect(bounds(d).max.z).toBeCloseTo(5, 9);
    const inset = 4 * Math.cos(Math.PI / 12); // `regular` deja caras planas a los cuatro vientos
    expect(bounds(d).min).toEqual({ x: expect.closeTo(10 - inset, 9), y: expect.closeTo(20 - inset, 9), z: 2 });
    expect(tessellate(d).some((f) => f.normal.z < 0)).toBe(false);
  });

  it("sides y rings configurables", () => {
    expect(tessellateAll({ ...d, sides: 16, rings: 4 })).toHaveLength(65);
  });

  it("cúpula chata y cúpula alta: toda lateral mira hacia arriba y hacia afuera del eje", () => {
    for (const [r, h] of [[10, 1], [1, 10]] as const) {
      const s: Solid = { kind: "dome", at: v3(0, 0, 0), r, h, mat: "concrete", rings: 4 };
      for (const f of tessellateAll(s).slice(1)) {
        expect(f.normal.z).toBeGreaterThanOrEqual(0);
        expect(f.normal.x * mean(f.pts, "x") + f.normal.y * mean(f.pts, "y")).toBeGreaterThan(0);
      }
    }
  });
});

describe("vault", () => {
  const vx: Solid = { kind: "vault", at: v3(0, 0, 1), len: 12, w: 6, h: 3, axis: "x", mat: "concrete" };

  it("bóveda de 6 segmentos: 9 caras, hastiales verticales y opuestos, franjas hacia arriba, base hacia abajo", () => {
    const all = tessellateAll(vx);
    expect(all).toHaveLength(9);
    const gables = all.filter((f) => Math.abs(f.normal.z) < 1e-6);
    expect(gables).toHaveLength(2);
    expect(gables[0]!.normal.x + gables[1]!.normal.x).toBeCloseTo(0, 9);
    expect(Math.abs(gables[0]!.normal.x)).toBeCloseTo(1, 9);
    expect(gables.every((g) => g.pts.length === 7)).toBe(true);
    expect(all.filter((f) => f.normal.z < -1e-6)).toHaveLength(1);
    expect(all.filter((f) => f.normal.z > 1e-6)).toHaveLength(6);
    expect(bounds(vx)).toEqual({ min: { x: 0, y: 0, z: 1 }, max: { x: 12, y: expect.closeTo(6, 9), z: expect.closeTo(4, 9) } });
  });

  it("bóveda chata y bóveda alta: toda franja mira hacia arriba y hacia afuera del eje", () => {
    for (const [w, h] of [[10, 1], [2, 10]] as const) {
      const strips = tessellateAll({ kind: "vault", at: v3(0, 0, 0), len: 8, w, h, axis: "x", mat: "concrete" }).filter((f) => f.normal.z > 1e-6);
      expect(strips).toHaveLength(6);
      for (const f of strips) {
        const off = mean(f.pts, "y") - w / 2;
        if (Math.abs(off) > 1e-9) expect(f.normal.y * off).toBeGreaterThan(0);
      }
    }
  });

  it("axis y intercambia las extensiones de la AABB", () => {
    const b = bounds({ ...vx, axis: "y" });
    expect(b.max.x).toBeCloseTo(6, 9);
    expect(b.max.y).toBeCloseTo(12, 9);
  });
});
