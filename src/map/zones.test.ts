import { describe, expect, it } from "vitest";
import { ZONES, ZONE_IDS, zoneById } from "./zones";

describe("zones", () => {
  it("hay tres zonas con ids únicos en orden portfolio, cv, blog", () => {
    expect(ZONES.map((z) => z.id)).toEqual(["portfolio", "cv", "blog"]);
    expect(ZONE_IDS).toEqual(["portfolio", "cv", "blog"]);
  });
  it("cada zona tiene nombre y acento propios", () => {
    expect(new Set(ZONES.map((z) => z.accent)).size).toBe(3);
    expect(zoneById("cv")).toEqual({ id: "cv", name: "Resume", path: "area/resume", accent: "amber" });
    expect(new Set(ZONES.map((z) => z.path)).size).toBe(3);
    expect(ZONES.map((z) => z.path)).not.toContain("blog"); // /blog/ es el Hugo
  });
  it("una zona desconocida tira", () => {
    expect(() => zoneById("x" as never)).toThrow(/desconocida/);
  });
});
