import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint";
import type { Solid } from "./solids";

const a: Solid = { kind: "prism", at: { x: 1, y: 2, z: 0 }, w: 1, d: 1, h: 1, mat: "steel" };
const b: Solid = { kind: "prism", at: { x: 3, y: 2, z: 0 }, w: 1, d: 1, h: 1, mat: "steel" };

describe("fingerprint", () => {
  it("son 8 dígitos hex, estable y sensible al orden", () => {
    expect(fingerprint([a, b])).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprint([a, b])).toBe(fingerprint([a, b]));
    expect(fingerprint([a, b])).not.toBe(fingerprint([b, a]));
  });

  it("ignora un ε por debajo de 1e-6 y el signo de −0", () => {
    const eps: Solid = { ...a, at: { x: 1 + 1e-9, y: 2, z: -0 } };
    expect(fingerprint([eps])).toBe(fingerprint([a]));
  });
});
