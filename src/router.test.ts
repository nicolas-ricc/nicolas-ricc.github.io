import { describe, expect, it } from "vitest";
import { pathForZone, zoneFromPath } from "./router";

describe("router", () => {
  it("mapea paths a zonas", () => {
    expect(zoneFromPath("/")).toBeNull();
    expect(zoneFromPath("/portfolio/")).toBe("portfolio");
    expect(zoneFromPath("/portfolio")).toBe("portfolio");
    expect(zoneFromPath("/cv/index.html")).toBe("cv");
    expect(zoneFromPath("/escritos/?x=1")).toBe("blog");
    expect(zoneFromPath("/blog/")).toBeNull(); // /blog/ es el Hugo, no una zona
    expect(zoneFromPath("/otra/")).toBeNull();
  });
  it("mapea zonas a paths", () => {
    expect(pathForZone(null)).toBe("/");
    expect(pathForZone("cv")).toBe("/cv/");
    expect(pathForZone("blog")).toBe("/escritos/");
  });
  it("es inverso", () => {
    for (const id of ["portfolio", "cv", "blog"] as const) expect(zoneFromPath(pathForZone(id))).toBe(id);
  });
  it("respeta un prefijo base distinto de /", () => {
    expect(zoneFromPath("/map/", "/map/")).toBeNull();
    expect(zoneFromPath("/map/cv/", "/map/")).toBe("cv");
    expect(zoneFromPath("/map/escritos/index.html", "/map/")).toBe("blog");
    expect(zoneFromPath("/cv/", "/map/")).toBeNull(); // fuera del prefijo no es nuestro
    expect(pathForZone(null, "/map/")).toBe("/map/");
    expect(pathForZone("portfolio", "/map/")).toBe("/map/portfolio/");
    for (const id of ["portfolio", "cv", "blog"] as const) expect(zoneFromPath(pathForZone(id, "/map/"), "/map/")).toBe(id);
  });
});
