import { describe, expect, it } from "vitest";
import { bounds } from "../iso/solids";
import { createRng } from "../map/seed";
import type { Vec2 } from "../iso/geometry";
import { cornice, domeRoof, gableRoof, greenRoof, hipRoof, offsetFootprint, pyramid, stepRoof, stepTop } from "./roofs";

const F = { x: 10, y: 20, w: 12, d: 8, z: 9 };
const inside = (b: { min: { x: number; y: number }; max: { x: number; y: number } }, m: number) =>
  b.min.x >= F.x - m - 1e-9 && b.max.x <= F.x + F.w + m + 1e-9 && b.min.y >= F.y - m - 1e-9 && b.max.y <= F.y + F.d + m + 1e-9;

describe("roofs", () => {
  it("cornice: overhangs 0.5 per side and measures 0.4, resting on the roof", () => {
    const [c] = cornice(F, "officeDark");
    expect(c).toMatchObject({ kind: "prism", w: 13, d: 9, h: 0.4, mat: "officeDark" });
    const b = bounds(c!);
    expect([b.min.x, b.min.y, b.min.z]).toEqual([9.5, 19.5, 9]);
  });

  it("hipRoof: rests at the body's z, 1.5 tall, hipped and within the footprint + 0.5", () => {
    const [r] = hipRoof(F, "terracotta");
    expect(r).toMatchObject({ kind: "prism", roof: "hip", h: 1.5, mat: "terracotta" });
    const b = bounds(r!);
    expect(b.min.z).toBe(F.z);
    expect(inside(b, 0.5)).toBe(true);
  });

  it("step: the setback topper and the footprint where whatever goes on top rests", () => {
    const [s] = stepRoof(F, 2, "office");
    const t = stepTop(F, 2);
    expect(t).toEqual({ x: 10 + 12 * 0.2, y: 20 + 8 * 0.2, w: 12 * 0.6, d: 8 * 0.6, z: 11 });
    expect(s).toMatchObject({ kind: "prism", w: t.w, d: t.d, h: 2 });
    expect(bounds(s!).max.z).toBe(t.z);
  });

  it("gable, green terrace, pyramid and dome rest on the roof and don't leave the footprint", () => {
    for (const ss of [gableRoof(F, 3, "copper"), greenRoof(F, createRng(1)), pyramid(F, 4, "copper"), domeRoof(F, 3, "copper")]) {
      expect(ss.length).toBeGreaterThan(0);
      for (const s of ss) { const b = bounds(s); expect(b.min.z).toBeGreaterThanOrEqual(F.z); expect(inside(b, 0)).toBe(true); }
    }
    expect(pyramid(F, 4, "copper")[0]).toMatchObject({ kind: "cone", sides: 4, h: 4 });
    expect(domeRoof(F, 3, "copper")[0]).toMatchObject({ kind: "dome", h: 3 });
  });

  it("offsetFootprint: grows the footprint m outward in either winding direction", () => {
    const r = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
    const big = [{ x: -0.5, y: -0.5 }, { x: 10.5, y: -0.5 }, { x: 10.5, y: 8.5 }, { x: -0.5, y: 8.5 }];
    const close = (a: Vec2[], b: Vec2[]) => a.forEach((p, i) => { expect(p.x).toBeCloseTo(b[i]!.x, 9); expect(p.y).toBeCloseTo(b[i]!.y, 9); });
    close(offsetFootprint(r, 0.5), big);
    close(offsetFootprint([...r].reverse(), 0.5), [...big].reverse());
    // 45° chamfer: the cut side moves 0.5 along its normal
    const cut = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 6, y: 8 }, { x: 0, y: 8 }];
    const o = offsetFootprint(cut, 0.5), a = o[2]!, b = o[3]!;
    expect((a.x - 10) * Math.SQRT1_2 + (a.y - 4) * Math.SQRT1_2).toBeCloseTo(0.5, 9);
    expect((b.x - 6) * Math.SQRT1_2 + (b.y - 8) * Math.SQRT1_2).toBeCloseTo(0.5, 9);
  });

  it("cornice and hipRoof interlock; gable, step, pyramid and dome do not", () => {
    expect(cornice(F, "stone").every((s) => s.interlocks === true)).toBe(true);
    expect(hipRoof(F, "terracotta").every((s) => s.interlocks === true)).toBe(true);
    for (const s of [...gableRoof(F, 2, "terracotta"), ...stepRoof(F, 2, "stone"), ...pyramid(F, 2, "stone"), ...domeRoof(F, 2, "stone")]) expect(s.interlocks).toBeUndefined();
  });
});
