import { describe, expect, it } from "vitest";
import { chase, flip, pulse } from "./neon";

describe("neon", () => {
  it("pulse vale 1 en fase 0, 0 a medio período y respeta la fase", () => {
    expect(pulse(0, 2400)).toBeCloseTo(1);
    expect(pulse(1200, 2400)).toBeCloseTo(0);
    expect(pulse(0, 2400, 0.5)).toBeCloseTo(0);
    expect(pulse(2400, 2400)).toBeCloseTo(1);
  });
  it("chase enciende `lit` luces y avanza un lugar por paso, también con pasos grandes", () => {
    expect(chase(3, 0, 1)).toEqual([true, false, false]);
    expect(chase(3, 1, 1)).toEqual([false, true, false]);
    expect(chase(3, 4, 1)).toEqual([false, true, false]);
    expect(chase(5, 2, 2)).toEqual([false, false, true, true, false]);
    for (let s = 0; s < 10; s++) expect(chase(4, s, 2).filter(Boolean)).toHaveLength(2);
    expect(chase(3, 7, 1)).toEqual(chase(3, 7, 1));
  });
  it("flip alterna: par → a, impar → b", () => {
    expect(flip(0, "cyan", "magenta")).toBe("cyan");
    expect(flip(1, "cyan", "magenta")).toBe("magenta");
    expect(flip(2, "cyan", "magenta")).toBe("cyan");
  });
});
