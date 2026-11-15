import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { diagonalWall, measureText, roofDiagonal, strokeText } from "../kit/lettering";
import { neon } from "../kit/props";
import { helipadSign, helipadTubeSign } from "./sign-helipad";

const build = (f: (out: Solid[], accents: Accent[]) => void) => { const out: Solid[] = [], accents: Accent[] = []; f(out, accents); return { out, accents }; };
const SLAB = { kind: "prism", at: { x: -11, y: -11, z: 0 }, w: 22, d: 22, h: 0.5, mat: "concrete" };

describe("helipad sign placeholders (#360)", () => {
  for (const f of [helipadSign, helipadTubeSign]) {
    it(`${f.name}: the 22 × 22 × 0.5 concrete slab centered at the origin, green neon text, deterministic`, () => {
      const { out, accents } = build(f);
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out).toContainEqual(expect.objectContaining(SLAB));
      expect(accents.length).toBeGreaterThan(0);
      for (const a of accents) {
        expect(a.kind).toBe("poly");
        expect(["green", "greenBleed"]).toContain(a.color);
      }
      expect(accents.filter((a) => a.color === "green")).toHaveLength(accents.length / 2);
      expect(build(f)).toEqual(build(f));
    });
  }
  it("helipadSign: the word lies flat on the slab at z 0.55", () => {
    const tubes = build(helipadSign).accents.filter((a) => a.kind === "poly" && a.color === "green");
    for (const a of tubes) if (a.kind === "poly") for (const p of a.pts) expect(p.z).toBeCloseTo(0.55, 9);
  });
  it("helipadTubeSign: the word stands on the vertical diagonal plane x + y = 0, from the baseline z 1.5 up", () => {
    const tubes = build(helipadTubeSign).accents.filter((a) => a.kind === "poly" && a.color === "green");
    const zs = tubes.flatMap((a) => (a.kind === "poly" ? a.pts.map((p) => p.z) : []));
    for (const a of tubes) if (a.kind === "poly") for (const p of a.pts) expect(Math.abs(p.x + p.y)).toBeLessThan(1e-9);
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(1.5 - 0.5 - 1e-9); // a stroke 1.0 thick around the baseline
    expect(Math.max(...zs)).toBeGreaterThan(1.5 + 8.55 - 0.1);
  });
  it("helipadSign: cap height 6, stroke 0.8, centered on the roof diagonal at z 0.55", () => {
    const { width } = measureText("Resume", 6), u = roofDiagonal({ x: 0, y: 0, z: 0 }), o = { x: 0, y: 0, z: 0.55 };
    const origin = { x: o.x - u.u.x * width / 2 - u.v.x * 3, y: o.y - u.u.y * width / 2 - u.v.y * 3, z: 0.55 };
    const want = strokeText("Resume", roofDiagonal(origin), 6, 0.8).flatMap((q) => neon(q, "green")).filter((a) => a.color === "green");
    expect(build(helipadSign).accents.filter((a) => a.color === "green")).toEqual(want);
  });
  it("helipadTubeSign: cap height 8.55, stroke 1, centered on the diagonal wall at z 1.5", () => {
    const { width } = measureText("Resume", 8.55), u = diagonalWall({ x: 0, y: 0, z: 0 }).u;
    const origin = { x: -u.x * width / 2, y: -u.y * width / 2, z: 1.5 };
    const want = strokeText("Resume", diagonalWall(origin), 8.55, 1).flatMap((q) => neon(q, "green")).filter((a) => a.color === "green");
    expect(build(helipadTubeSign).accents.filter((a) => a.color === "green")).toEqual(want);
  });
});
