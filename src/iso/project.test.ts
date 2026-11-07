import { describe, expect, it } from "vitest";
import { v3 } from "./geometry";
import { VIEW_DIR, Z_SCALE, occluded, project } from "./project";

describe("project (2:1 dimetric)", () => {
  it("the origin maps to the origin", () => {
    expect(project(v3(0, 0, 0))).toEqual({ x: 0, y: 0 });
  });
  it("+x goes right and down; +y goes left and down, symmetric", () => {
    expect(project(v3(10, 0, 0))).toEqual({ x: 10, y: 5 });
    expect(project(v3(0, 10, 0))).toEqual({ x: -10, y: 5 });
  });
  it("z only moves y, scaled", () => {
    expect(Z_SCALE).toBe(1.4);
    expect(project(v3(0, 0, 10))).toEqual({ x: 0, y: -14 });
  });
  it("VIEW_DIR points southeast and up", () => {
    expect(VIEW_DIR.x).toBeGreaterThan(0);
    expect(VIEW_DIR.y).toBeGreaterThan(0);
    expect(VIEW_DIR.z).toBeGreaterThan(0);
  });
});

describe("occluded", () => {
  const min = v3(0, 0, 0), max = v3(10, 10, 10);
  it("a point behind the box (to the northwest, below) is hidden; one in front (to the southeast) is not", () => {
    expect(occluded(v3(-1, -1, 1), min, max)).toBe(true);
    expect(occluded(v3(11, 11, 1), min, max)).toBe(false);
  });
  it("the ray passes over the box: free", () => {
    expect(occluded(v3(-1, -1, 10), min, max)).toBe(false); // rises 1 per 1.4 in x: exits above
  });
  it("a point on the box's south face does not hide itself (contact)", () => {
    expect(occluded(v3(5, 10, 5), min, max)).toBe(false);
  });
  it("the ray passes east of the box: free", () => {
    expect(occluded(v3(10, -5, 1), min, max)).toBe(false);
  });
});
