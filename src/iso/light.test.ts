import { describe, expect, it } from "vitest";
import { v3 } from "./geometry";
import { SHADOW_CORE_H, SHADOW_DIR, SHADOW_MAX_H, SHADOW_PER_UNIT, TO_SUN, shadeTone, shadowPoint, shadowPolygon } from "./light";
import type { Solid } from "./solids";

describe("light", () => {
  it("el sol está bajo, al oeste-sudoeste", () => {
    expect(TO_SUN.x).toBeLessThan(0);
    expect(TO_SUN.y).toBeGreaterThan(0);
    expect(TO_SUN.z).toBeCloseTo(Math.sin((25 * Math.PI) / 180), 3);
  });

  it("las tres caras visibles reciben tres tonos distintos", () => {
    expect(shadeTone(v3(0, 0, 1))).toBe("top");   // techo
    expect(shadeTone(v3(0, 1, 0))).toBe("lit");   // pared sur
    expect(shadeTone(v3(1, 0, 0))).toBe("shade"); // pared este
  });

  it("una vertiente hacia el sol sube, una en contra baja", () => {
    expect(shadeTone(v3(0, 0.6, 0.8))).toBe("up");
    expect(shadeTone(v3(0, -0.6, 0.8))).toBe("down");
  });

  it("un plano casi horizontal sigue siendo techo", () => {
    expect(shadeTone(v3(0.02, 0, 0.9998))).toBe("top");
  });

  it("la sombra cae al ENE con longitud proporcional a la altura", () => {
    const p = shadowPoint(v3(0, 0, 2));
    expect(p.x).toBeCloseTo(SHADOW_DIR.x * SHADOW_PER_UNIT * 2, 6);
    expect(p.y).toBeCloseTo(SHADOW_DIR.y * SHADOW_PER_UNIT * 2, 6);
    expect(SHADOW_PER_UNIT).toBeCloseTo(1.4 / Math.tan((25 * Math.PI) / 180), 6);
  });

  it("bajo el suelo no hay sombra: el punto queda donde está", () => {
    expect(shadowPoint(v3(3, 4, -2))).toEqual({ x: 3, y: 4 });
  });

  it("por encima de SHADOW_MAX_H la sombra deja de crecer", () => {
    expect(SHADOW_MAX_H).toBe(18);
    expect(shadowPoint(v3(0, 0, 30))).toEqual(shadowPoint(v3(0, 0, 18)));
    expect(shadowPoint(v3(0, 0, 17)).x).toBeLessThan(shadowPoint(v3(0, 0, 18)).x);
  });
});

describe("shadowPolygon", () => {
  it("un prisma 1×1×h proyecta un casco convexo que llega a 1 + 0.894·L·h en x", () => {
    const h = 2;
    const poly = shadowPolygon({ kind: "prism", at: v3(0, 0, 0), w: 1, d: 1, h, mat: "steel" })!;
    expect(poly.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...poly.map((p) => p.x))).toBeCloseTo(1 + SHADOW_DIR.x * SHADOW_PER_UNIT * h, 6);
    expect(Math.min(...poly.map((p) => p.y))).toBeCloseTo(SHADOW_DIR.y * SHADOW_PER_UNIT * h, 6);
    expect(poly).toContainEqual({ x: 0, y: 0 });
    expect(poly).toContainEqual({ x: 0, y: 1 });
  });
  it("suelo, franjas y sólidos hundidos no proyectan", () => {
    expect(shadowPolygon({ kind: "strip", path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], width: 1, z: 0, mat: "road" })).toBeNull();
    expect(shadowPolygon({ kind: "ground", mat: "slab", tris: [] })).toBeNull();
    expect(shadowPolygon({ kind: "prism", at: v3(0, 0, -6), w: 2, d: 2, h: 6, mat: "concrete" })).toBeNull();
  });
  it("un cono proyecta la base más el ápice desplazado", () => {
    const poly = shadowPolygon({ kind: "cone", at: v3(0, 0, 0), r: 1, h: 3, mat: "leaf" })!;
    expect(Math.max(...poly.map((p) => p.x))).toBeCloseTo(SHADOW_DIR.x * SHADOW_PER_UNIT * 3, 6);
  });

  it("el núcleo recorta la sombra a SHADOW_CORE_H y cabe dentro de la completa", () => {
    const s: Solid = { kind: "prism", at: v3(0, 0, 0), w: 1, d: 1, h: 20, mat: "steel" };
    const full = shadowPolygon(s)!, core = shadowPolygon(s, SHADOW_CORE_H)!;
    expect(SHADOW_CORE_H).toBe(9);
    expect(Math.max(...core.map((p) => p.x))).toBeCloseTo(1 + SHADOW_DIR.x * SHADOW_PER_UNIT * SHADOW_CORE_H, 6);
    expect(Math.max(...full.map((p) => p.x))).toBeCloseTo(1 + SHADOW_DIR.x * SHADOW_PER_UNIT * SHADOW_MAX_H, 6);
    expect(shadowPoint(v3(0, 0, 20), SHADOW_CORE_H)).toEqual(shadowPoint(v3(0, 0, 9)));
  });
});

describe("sombra de la viga", () => {
  it("una pluma flotando proyecta sombra que contiene la proyección de la punta; largo cero no rompe", () => {
    const s: Solid = { kind: "beam", from: v3(0, 0, 4), to: v3(4, 0, 8), w: 0.4, h: 0.5, mat: "steel" };
    const poly = shadowPolygon(s)!;
    expect(poly.length).toBeGreaterThanOrEqual(3);
    const tip = shadowPoint(v3(4, 0, 8));
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    expect(tip.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9); expect(tip.x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
    expect(tip.y).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-9); expect(tip.y).toBeLessThanOrEqual(Math.max(...ys) + 1e-9);
    const zero = shadowPolygon({ ...s, to: s.from });
    expect(zero!.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});
