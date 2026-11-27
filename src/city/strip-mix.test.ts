import { describe, expect, it } from "vitest";
import { STRIP_IN, STRIP_OUT, fieldKind, hash01, mixes, stripWeight, urbanity, valueNoise } from "./strip-mix";

// #496: a smooth deterministic field of "how urban" picks the strip's neighborhoods.
describe("the strip's mixing field (#496)", () => {
  it("stripWeight is 0 east of −400, 1 west of −470, linear between", () => {
    expect([STRIP_IN, STRIP_OUT]).toEqual([-400, -470]);
    expect(stripWeight(0, 300)).toBe(0);
    expect(stripWeight(-100, 300)).toBe(0); // x − y = −400
    expect(stripWeight(-170, 300)).toBe(1); // −470
    expect(stripWeight(-500, 300)).toBe(1);
    expect(stripWeight(-135, 300)).toBeCloseTo(0.5, 9);
  });

  it("hash01 and valueNoise stay in [0, 1] and are deterministic", () => {
    for (let i = 0; i < 500; i++) {
      const x = -400 + i * 1.37, y = 150 + i * 1.11, h = hash01(x, y), n = valueNoise(x, y, 45);
      expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1);
      expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1);
      expect(hash01(x, y)).toBe(h); expect(urbanity(x, y)).toBe(urbanity(x, y));
    }
  });

  it("the field is smooth: two points 10 u apart differ by ≤ 0.3", () => {
    for (let i = 0; i < 600; i++) {
      const x = -420 + (i * 37) % 560, y = 160 + (i * 53) % 550, a = (i * 0.7) % (2 * Math.PI);
      expect(Math.abs(urbanity(x, y) - urbanity(x + 10 * Math.cos(a), y + 10 * Math.sin(a))), `${x},${y}`).toBeLessThanOrEqual(0.3);
    }
  });

  it("higher to the north: mean urbanity at y 200 beats y 650 by ≥ 0.3", () => {
    const mean = (y: number) => { let s = 0, n = 0; for (let x = -390; x <= -150; x += 3) { s += urbanity(x, y); n++; } return s / n; };
    expect(mean(200) - mean(650)).toBeGreaterThanOrEqual(0.3);
  });

  it("fieldKind follows the thresholds moderno > transicion > clasico > bajo", () => {
    for (let i = 0; i < 2000; i++) {
      const x = -400 + (i * 17) % 560, y = 160 + (i * 29) % 550, u = urbanity(x, y), k = fieldKind(x, y);
      expect(k).toBe(u > 0.72 ? "moderno" : u > 0.52 ? "transicion" : u > 0.34 ? "clasico" : "bajo");
    }
  });

  it("mixes never fires east of the ramp and always fires west of it", () => {
    for (let i = 0; i < 300; i++) {
      expect(mixes({ x: -50 + i, y: 300 })).toBe(false);
      expect(mixes({ x: -300 - (i % 90), y: 300 + i })).toBe(true);
    }
  });
});
