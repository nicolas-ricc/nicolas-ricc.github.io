import { describe, expect, it } from "vitest";
import type { Solid } from "../iso/solids";
import { createRng, type Rng } from "../map/seed";
import { jungle } from "./flora";

describe("flora", () => {
  it("pone n conos de selva dentro del rectángulo, a la altura pedida", () => {
    const out: Solid[] = [];
    jungle(out, createRng(7), { x0: 10, x1: 20, y0: 30, y1: 40 }, 8, 0.2);
    expect(out).toHaveLength(8);
    for (const s of out) {
      expect(s.kind).toBe("cone");
      if (s.kind !== "cone") continue;
      expect(["leaf", "leafDark"]).toContain(s.mat);
      expect(s.at.x).toBeGreaterThanOrEqual(10); expect(s.at.x).toBeLessThanOrEqual(20);
      expect(s.at.y).toBeGreaterThanOrEqual(30); expect(s.at.y).toBeLessThanOrEqual(40);
      expect(s.at.z).toBe(0.2);
      expect(s.r).toBeGreaterThanOrEqual(2); expect(s.r).toBeLessThanOrEqual(4);
      expect(s.h).toBeGreaterThanOrEqual(5); expect(s.h).toBeLessThanOrEqual(9);
    }
  });
  it("es determinística y por defecto apoya a z 0.4", () => {
    const a: Solid[] = [], b: Solid[] = [];
    jungle(a, createRng(3), { x0: 0, x1: 5, y0: 0, y1: 5 }, 3);
    jungle(b, createRng(3), { x0: 0, x1: 5, y0: 0, y1: 5 }, 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.every((s) => s.kind === "cone" && s.at.z === 0.4)).toBe(true);
  });
});

describe("flora: regla del tren", () => {
  const T = { y0: 130.8, y1: 134.2, x1: 158 };
  const rails = { y: [131, 134], train: T };
  /** Rng falso: `chance` siempre true; `int` devuelve, en orden, x, y, r, h (el orden de `jungle`). */
  const fixed = (...ints: number[]): Rng => { let i = 0; return { next: () => 0, chance: () => true, int: () => ints[i++]!, pick: (a) => a[0]! }; };
  const one = (x: number, y: number, r: number, h: number, rl?: Parameters<typeof jungle>[5]): Solid[] => {
    const out: Solid[] = [];
    jungle(out, fixed(x, y, r, h), { x0: x, x1: x, y0: y, y1: y }, 1, 0.4, rl);
    return out;
  };
  it("descarta un cono alto justo al sur de la vía", () => {
    expect(one(100, 141, 2, 9, rails)).toHaveLength(0);
  });
  it("sin train, el mismo cono queda", () => {
    expect(one(100, 141, 2, 9, { y: [131, 134] })).toHaveLength(1);
  });
  it("deja el que está lo bastante al sur (borde exacto incluido)", () => {
    expect(one(100, 134.5 + 2 + 1.4 * 9.4, 2, 9, rails)).toHaveLength(1);
    expect(one(100, 150, 2, 9, rails)).toHaveLength(1);
  });
  it("deja los que quedan al este del frente", () => {
    expect(one(180, 141, 2, 5, rails)).toHaveLength(1);
    expect(one(175, 141, 2, 9, rails)).toHaveLength(1);
    expect(one(173, 141, 2, 9, rails)).toHaveLength(1); // solo lo separa sx: 173 − 2 − 143 = 28 ≥ 27.2 (q da 157.84 < 158)
  });
  it("no toca los conos al norte de la vía", () => {
    expect(one(100, 120, 2, 9, rails)).toHaveLength(1);
  });
  it("el rng consume lo mismo con o sin train, y con train queda un subconjunto estricto", () => {
    const area = { x0: -238, x1: -62, y0: 112, y1: 141 };
    const a: Solid[] = [], b: Solid[] = [];
    const ra = createRng(5), rb = createRng(5);
    jungle(a, ra, area, 60, 0.4, { y: [131, 134] });
    jungle(b, rb, area, 60, 0.4, rails);
    expect(rb.next()).toBe(ra.next());
    const all = new Set(a.map((s) => JSON.stringify(s)));
    for (const s of b) expect(all.has(JSON.stringify(s))).toBe(true);
    expect(b.length).toBeLessThan(a.length);
  });
});
