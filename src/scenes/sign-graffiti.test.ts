import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { fillText, measureText } from "../kit/lettering";
import { graffitiWall } from "./sign-graffiti";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; graffitiWall(out, accents); return { out, accents }; };

describe("graffiti wall placeholder (#360)", () => {
  it("a concrete poly wall 11.5 high, its footprint a rectangle L × 1.2 rotated 45°", () => {
    const { out } = build();
    expect(out.length).toBeGreaterThanOrEqual(1);
    const wall = out.find((s) => s.kind === "poly")!;
    expect(wall).toMatchObject({ kind: "poly", z: 0, h: 11.5, mat: "concrete" });
    if (wall.kind !== "poly") return;
    const L = measureText("Portfolio", 8.55).width + 5, [D, C, B] = wall.footprint;
    expect(wall.footprint).toHaveLength(4);
    expect(Math.hypot(C!.x - D!.x, C!.y - D!.y)).toBeCloseTo(L, 9);
    expect(Math.hypot(B!.x - C!.x, B!.y - C!.y)).toBeCloseTo(1.2, 9);
    expect((C!.x - D!.x) / L).toBeCloseTo(Math.SQRT1_2, 9); // edge 0 runs along (1, −1)/√2
    expect((C!.y - D!.y) / L).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(D!.x + D!.y).toBeCloseTo(Math.SQRT2 * 0.6, 9); // edge 0 is the front face, n·p = t/2
  });
  it("Portfolio painted as safety poly plates on edge 0, one per fillText quad, 2.5 in and baseline 1.5", () => {
    const wall = build().out.find((s) => s.kind === "poly")!;
    if (wall.kind !== "poly") throw new Error("no poly wall");
    const quads = fillText("Portfolio", 8.55, 1.6), L = measureText("Portfolio", 8.55).width + 5;
    const plates = wall.plates ?? [];
    expect(plates).toHaveLength(quads.length);
    plates.forEach((p, k) => {
      expect(p).toMatchObject({ wall: 0, shape: "poly", mat: "safety" });
      if (p.shape !== "poly") return;
      p.pts.forEach((q, i) => {
        expect(q.x).toBeCloseTo(2.5 / L + quads[k]![i]!.x / L, 12);
        expect(q.y).toBeCloseTo(1.5 + quads[k]![i]!.y, 12);
      });
    });
  });
  it("text accents, if any, are polys; deterministic", () => {
    const { accents } = build();
    for (const a of accents) expect(a.kind).toBe("poly");
    expect(build()).toEqual(build());
  });
});
