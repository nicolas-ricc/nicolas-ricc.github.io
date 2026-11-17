import { describe, expect, it } from "vitest";
import { ISO_COLORS } from "../map/palette-iso";
import { accentItem, spot } from "./accent";
import { v3 } from "./geometry";
import { project } from "./project";

describe("accentItem", () => {
  it("a dot is projected and resolves its color", () => {
    expect(accentItem({ kind: "dot", at: v3(0, 0, 10), r: 2, color: "amber" })).toEqual({ kind: "dot", x: 0, y: -14, r: 2, color: ISO_COLORS.amber });
  });
  it("a polygon is projected flat, with alpha 1 by default", () => {
    const it = accentItem({ kind: "poly", pts: [v3(0, 0, 0), v3(2, 0, 0), v3(2, 2, 0)], color: "magentaMid" });
    expect(it).toEqual({ kind: "poly", pts: [0, 0, 2, 1, 0, 2], color: ISO_COLORS.magentaMid, alpha: 1 });
  });
  it("honors the requested alpha", () => {
    const it = accentItem({ kind: "poly", pts: [v3(0, 0, 0), v3(1, 0, 0), v3(0, 1, 0)], color: "cyanBleed", alpha: 0.3 });
    expect(it.kind === "poly" && it.alpha).toBe(0.3);
  });
});

describe("spot (#403)", () => {
  it("projects to a rhombus of radius r centred on project(at)", () => {
    const at = v3(3, 5, 2), c = project(at), it = accentItem(spot(at, 0.4, "cyan"));
    if (it.kind !== "poly") throw new Error("spot is a poly");
    const want = [c.x + 0.4, c.y, c.x, c.y - 0.4, c.x - 0.4, c.y, c.x, c.y + 0.4];
    expect(it.pts).toHaveLength(8);
    it.pts.forEach((v, k) => expect(v).toBeCloseTo(want[k]!, 9));
  });
  it("is a poly with alpha 1 by default and the given alpha otherwise, never a dot", () => {
    expect(spot(v3(0, 0, 0), 1, "magenta")).toMatchObject({ kind: "poly", color: "magenta", alpha: 1 });
    expect(spot(v3(0, 0, 0), 1, "magenta", 0.5)).toMatchObject({ kind: "poly", alpha: 0.5 });
  });
});
