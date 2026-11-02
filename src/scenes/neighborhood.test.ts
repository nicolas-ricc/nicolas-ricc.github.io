import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { ALWAYS_LIT, homeWindow, lawn } from "./neighborhood";
import { newCtx } from "./neighborhood-fixtures";

describe("neighborhood", () => {
  it("lawn: a leafDark prism h 0.05 over the whole block", () => {
    const ctx = newCtx();
    lawn(ctx, { x: 132, y: 448, w: 24, d: 18 });
    expect(ctx.solids).toEqual([{ kind: "prism", at: v3(132, 448, 0), w: 24, d: 18, h: 0.05, mat: "leafDark" }]);
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
