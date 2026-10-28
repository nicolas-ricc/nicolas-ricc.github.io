import { describe, expect, it } from "vitest";
import { v3 } from "./geometry";
import { VIEW_DIR, Z_SCALE, occluded, project } from "./project";

describe("project (dimétrica 2:1)", () => {
  it("el origen va al origen", () => {
    expect(project(v3(0, 0, 0))).toEqual({ x: 0, y: 0 });
  });
  it("+x va a la derecha y abajo; +y a la izquierda y abajo, simétricos", () => {
    expect(project(v3(10, 0, 0))).toEqual({ x: 10, y: 5 });
    expect(project(v3(0, 10, 0))).toEqual({ x: -10, y: 5 });
  });
  it("z solo mueve en y, escalado", () => {
    expect(Z_SCALE).toBe(1.4);
    expect(project(v3(0, 0, 10))).toEqual({ x: 0, y: -14 });
  });
  it("VIEW_DIR apunta al SE y arriba", () => {
    expect(VIEW_DIR.x).toBeGreaterThan(0);
    expect(VIEW_DIR.y).toBeGreaterThan(0);
    expect(VIEW_DIR.z).toBeGreaterThan(0);
  });
});

describe("occluded", () => {
  const min = v3(0, 0, 0), max = v3(10, 10, 10);
  it("un punto detrás de la caja (al NO, abajo) queda tapado; uno delante (al SE) no", () => {
    expect(occluded(v3(-1, -1, 1), min, max)).toBe(true);
    expect(occluded(v3(11, 11, 1), min, max)).toBe(false);
  });
  it("el rayo pasa por arriba de la caja: libre", () => {
    expect(occluded(v3(-1, -1, 10), min, max)).toBe(false); // sube 1 por cada 1.4 en x: sale por encima
  });
  it("un punto sobre la cara sur de la caja no se tapa a sí mismo (contacto)", () => {
    expect(occluded(v3(5, 10, 5), min, max)).toBe(false);
  });
  it("el rayo pasa al este de la caja: libre", () => {
    expect(occluded(v3(10, -5, 1), min, max)).toBe(false);
  });
});
