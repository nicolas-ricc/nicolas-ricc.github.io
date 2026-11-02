import { describe, expect, it } from "vitest";
import { facadeFaces, type Facade } from "../iso/facade";
import { v3 } from "../iso/geometry";
import { tessellateAll, type Face, type Solid } from "../iso/solids";
import { ISO_TONES } from "../map/palette-iso";
import { SEED } from "../map/seed";
import { world } from "./world";

/**
 * Lo que pide la integración de `main` en la historia #35 (#291) y ningún test de un solo lado cubre: las dos
 * intenciones conviven en el motor, la paleta y el mundo.
 */
describe("integración de main en la historia #35", () => {
  it("las bandas de la fachada se pintan antes que zócalo, pilastras, impostas y tirantes", () => {
    const wall: Face = { pts: [v3(0, 6, 0), v3(10, 6, 0), v3(10, 6, 9), v3(0, 6, 9)], normal: v3(0, 1, 0), mat: "office", tone: "lit", toneOffset: 0 };
    const facade = {
      floors: 3, cols: 4,
      plinth: { h: 0.6, mat: "stone" }, piers: { every: 2, w: 0.4, mat: "stone" },
      courses: { mat: "stone", h: 0.4 }, ties: { r: 0.2, mat: "stone" },
    } as Facade;
    const faces = facadeFaces(wall, facade);
    const fullFloor = (f: Face) => f.mat === "office" && Math.abs(Math.max(...f.pts.map((p) => p.z)) - Math.min(...f.pts.map((p) => p.z)) - 3) < 1e-9;
    const bands = faces.flatMap((f, i) => (fullFloor(f) ? [i] : []));
    const stone = faces.flatMap((f, i) => (f.mat === "stone" ? [i] : []));
    expect(bands).toHaveLength(3);
    expect(stone.length).toBeGreaterThan(0);
    expect(Math.max(...bands)).toBeLessThan(Math.min(...stone));
  });

  it("una placa con wall 0 sobre una poly horaria cae en la arista footprint[0] → footprint[1]", () => {
    // horaria en (x este, y sur): área con signo negativa, la historia la invierte al extruir
    const footprint = [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 0 }];
    const poly = { kind: "poly", footprint, z: 0, h: 3, mat: "concrete", plates: [{ wall: 0, shape: "rect", u0: 0.25, u1: 0.75, z0: 1, z1: 2, mat: "signal" }] } as unknown as Solid;
    const plate = tessellateAll(poly).filter((f) => f.mat === "signal");
    expect(plate).toHaveLength(1);
    for (const p of plate[0]!.pts) expect(p.x).toBeCloseTo(0);
    expect(plate[0]!.normal.x).toBeCloseTo(-1);
  });

  it("todo material tiene la escalera de nueve tonos, también los que sumó main", () => {
    const ladder = ["deep", "dim", "down", "glow", "lit", "pale", "shade", "top", "up"];
    for (const m of ["signal", "stockbrick", "safety", "canopy", "livery", "tile"]) expect(Object.keys(ISO_TONES)).toContain(m);
    for (const [m, tones] of Object.entries(ISO_TONES)) expect(Object.keys(tones).sort(), m).toEqual(ladder);
  });

  it("el mundo trae la ciudad del kit y el barrio de main", () => {
    const w = world(SEED);
    expect(w.city!.placed.length).toBeGreaterThan(0); // historia: piezas del kit por barrio
    expect((w.tech as unknown as { homes?: unknown[] }).homes?.length ?? 0).toBeGreaterThan(0); // main: ventanas del barrio costero
  });
});
