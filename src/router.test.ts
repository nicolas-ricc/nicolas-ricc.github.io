import { describe, expect, it } from "vitest";
import { pathForZone, zoneFromPath } from "./router";

describe("router", () => {
  it("maps paths to zones", () => {
    expect(zoneFromPath("/")).toBeNull();
    expect(zoneFromPath("/area/portfolio/")).toBe("portfolio");
    expect(zoneFromPath("/area/portfolio")).toBe("portfolio");
    expect(zoneFromPath("/area/resume/index.html")).toBe("cv");
    expect(zoneFromPath("/area/blog/?x=1")).toBe("blog");
    expect(zoneFromPath("/blog/")).toBeNull(); // /blog/ is the Hugo site, not a zone
    expect(zoneFromPath("/area/")).toBeNull();
    expect(zoneFromPath("/area/blogx/")).toBeNull();
    expect(zoneFromPath("/otra/")).toBeNull();
  });
  it("maps zones to paths", () => {
    expect(pathForZone(null)).toBe("/");
    expect(pathForZone("cv")).toBe("/area/resume/");
    expect(pathForZone("blog")).toBe("/area/blog/");
  });
  it("is the inverse", () => {
    for (const id of ["portfolio", "cv", "blog"] as const) expect(zoneFromPath(pathForZone(id))).toBe(id);
  });
  it("respects a base prefix other than /", () => {
    expect(zoneFromPath("/map/", "/map/")).toBeNull();
    expect(zoneFromPath("/map/area/resume/", "/map/")).toBe("cv");
    expect(zoneFromPath("/map/area/blog/index.html", "/map/")).toBe("blog");
    expect(zoneFromPath("/area/resume/", "/map/")).toBeNull(); // outside the prefix it is not ours
    expect(pathForZone(null, "/map/")).toBe("/map/");
    expect(pathForZone("portfolio", "/map/")).toBe("/map/area/portfolio/");
    for (const id of ["portfolio", "cv", "blog"] as const) expect(zoneFromPath(pathForZone(id, "/map/"), "/map/")).toBe(id);
  });
});
