import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { ALWAYS_LIT, cornerLamps, homeWindow, lawn } from "./neighborhood";
import { blockAt, newCtx } from "./neighborhood-fixtures";

describe("neighborhood", () => {
  it("lawn: a leafDark prism h 0.05 over the whole block", () => {
    const ctx = newCtx();
    lawn(ctx, { x: 132, y: 448, w: 24, d: 18 });
    expect(ctx.solids).toEqual([{ kind: "prism", at: v3(132, 448, 0), w: 24, d: 18, h: 0.05, mat: "leafDark" }]);
  });
  it("lawn: a block with a parcel gets the parcel polygon, leafDark h 0.05 at z 0", () => {
    const ctx = newCtx(), b = blockAt(133, 471);
    lawn(ctx, b);
    expect(ctx.solids).toEqual([{ kind: "poly", footprint: b.parcel!.poly, z: 0, h: 0.05, mat: "leafDark" }]);
  });
  it("cornerLamps: east lamp at (x + w − 1, y − 1.5), south lamp at (x + 1, y + d + 0.6), on any size", () => {
    for (const b of [{ x: 132, y: 448, w: 24, d: 18 }, { x: 103, y: 441, w: 24, d: 24 }, { x: 163, y: 441, w: 21, d: 24 }, { x: 103, y: 441, w: 20, d: 20 }]) {
      const ctx = newCtx();
      cornerLamps(ctx, b);
      const at = ctx.solids.map((s) => (s.kind === "prism" ? [s.at.x, s.at.y] : null));
      expect(at).toContainEqual([b.x + b.w - 1, b.y - 1.5]); expect(at).toContainEqual([b.x + 1, b.y + b.d + 0.6]);
    }
  });
  it("homeWindow adds the window as is", () => {
    const ctx = newCtx(), pts = [v3(0, 1, 0), v3(1, 1, 0), v3(1, 1, 1), v3(0, 1, 1)];
    homeWindow(ctx, pts, true, "g");
    expect(ctx.homes).toEqual([{ pts, lit: true, group: "g" }]);
  });
  it("the fixed lit groups are the school staircase and the club gym", () => {
    expect([...ALWAYS_LIT].sort()).toEqual(["club-gym", "school-staircase"]);
  });
});
