import { describe, expect, it } from "vitest";
import { ZONES, ZONE_IDS, zoneById } from "./zones";

describe("zones", () => {
  it("there are three zones with unique ids in the order portfolio, cv, blog", () => {
    expect(ZONES.map((z) => z.id)).toEqual(["portfolio", "cv", "blog"]);
    expect(ZONE_IDS).toEqual(["portfolio", "cv", "blog"]);
  });
  it("each zone has its own name and accent", () => {
    expect(new Set(ZONES.map((z) => z.accent)).size).toBe(3);
    expect(zoneById("cv")).toEqual({ id: "cv", name: "Resume", path: "area/resume", accent: "amber" });
    expect(new Set(ZONES.map((z) => z.path)).size).toBe(3);
    expect(ZONES.map((z) => z.path)).not.toContain("blog"); // /blog/ is the Hugo site
  });
  it("an unknown zone throws", () => {
    expect(() => zoneById("x" as never)).toThrow(/Unknown zone/);
  });
});
