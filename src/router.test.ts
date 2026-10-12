import { describe, expect, it } from "vitest";
import { pathForZone, zoneFromPath } from "./router";

describe("router", () => {
  it("mapea paths a zonas", () => {
    expect(zoneFromPath("/")).toBeNull();
    expect(zoneFromPath("/area/portfolio/")).toBe("portfolio");
    expect(zoneFromPath("/area/portfolio")).toBe("portfolio");
    expect(zoneFromPath("/area/resume/index.html")).toBe("cv");
    expect(zoneFromPath("/area/blog/?x=1")).toBe("blog");
    expect(zoneFromPath("/blog/")).toBeNull(); // /blog/ es el Hugo, no una zona
    expect(zoneFromPath("/area/")).toBeNull();
    expect(zoneFromPath("/area/blogx/")).toBeNull();
    expect(zoneFromPath("/otra/")).toBeNull();
  });
  it("mapea zonas a paths", () => {
    expect(pathForZone(null)).toBe("/");
    expect(pathForZone("cv")).toBe("/area/resume/");
    expect(pathForZone("blog")).toBe("/area/blog/");
  });
  it("es inverso", () => {
    for (const id of ["portfolio", "cv", "blog"] as const) expect(zoneFromPath(pathForZone(id))).toBe(id);
  });
  it("respeta un prefijo base distinto de /", () => {
    expect(zoneFromPath("/map/", "/map/")).toBeNull();
    expect(zoneFromPath("/map/area/resume/", "/map/")).toBe("cv");
    expect(zoneFromPath("/map/area/blog/index.html", "/map/")).toBe("blog");
    expect(zoneFromPath("/area/resume/", "/map/")).toBeNull(); // fuera del prefijo no es nuestro
    expect(pathForZone(null, "/map/")).toBe("/map/");
    expect(pathForZone("portfolio", "/map/")).toBe("/map/area/portfolio/");
    for (const id of ["portfolio", "cv", "blog"] as const) expect(zoneFromPath(pathForZone(id, "/map/"), "/map/")).toBe(id);
  });
});
