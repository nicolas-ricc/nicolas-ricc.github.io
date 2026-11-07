import { describe, expect, it } from "vitest";
import { depthAt } from "./depth-map";

describe("depth-map", () => {
  it("is 0 on land and grows away from the coast", () => {
    expect(depthAt(100, 100)).toBe(0);           // shipyard
    expect(depthAt(150, -300)).toBe(0);          // north bleed (jungle or built)
    expect(depthAt(400, 60)).toBeGreaterThan(0);
    expect(depthAt(400, 60)).toBeLessThan(depthAt(480, 60));
    expect(depthAt(480, 60)).toBeLessThan(depthAt(560, 60));
    expect(depthAt(200, 300)).toBeLessThan(depthAt(240, 300)); // shore vs center of the estuary
  });
  it("is a distance in world units, not in cells", () => {
    expect(depthAt(560, 60)).toBeGreaterThan(60);
    expect(depthAt(900, 300)).toBeGreaterThan(200); // bleed sea, far from everything
  });
});
