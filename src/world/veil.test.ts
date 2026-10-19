import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { BLEED, CELL, CELL_BLEED, WORLD, worldZoneAt } from "../map/geo";
import { ACCENT_DIM, VEIL_ALPHA, accentZone, accentsByZone, focusAlphas, veilCells, veilPolygons, veilRuns } from "./veil";

describe("veilCells", () => {
  const cells = veilCells();
  it("cubren contenido + sangrado sin huecos ni solapes", () => {
    const area = cells.reduce((s, c) => s + c.size * c.size, 0);
    expect(area).toBe((WORLD.x1 - WORLD.x0 + 2 * BLEED.x) * (WORLD.y1 - WORLD.y0 + 2 * BLEED.y));
    for (const c of cells) expect([CELL, CELL_BLEED]).toContain(c.size);
  });
  it("cada celda está en la zona de su centro según worldZoneAt", () => {
    for (const c of cells) expect(c.zone).toBe(worldZoneAt(c.x + c.size / 2, c.y + c.size / 2));
  });
  it("las costuras se subdividen a 6: hay celdas chicas cerca de x 344 e y 146 y ninguna lejos", () => {
    const small = cells.filter((c) => c.size === CELL);
    expect(small.length).toBeGreaterThan(50);
    expect(small.some((c) => Math.abs(c.x - 344) < 40)).toBe(true);
    expect(small.some((c) => Math.abs(c.y - 146) < 40 && c.x < 300)).toBe(true);
    expect(cells.filter((c) => c.size === CELL_BLEED && c.x < -300 && c.y < -300).length).toBeGreaterThan(20);
  });
  it("la punta del faro y su arrecife son Portfolio, el mar abierto es Blog", () => {
    const at = (x: number, y: number) => cells.find((c) => x >= c.x && x < c.x + c.size && y >= c.y && y < c.y + c.size)!.zone;
    expect(at(380, 118)).toBe("portfolio");
    expect(at(404, 118)).toBe("portfolio");
    expect(at(500, 200)).toBe("blog");
    expect(at(-30, 300)).toBe("cv");
  });
});

describe("veilPolygons", () => {
  it("un cuadrilátero proyectado por tira, repartido por zona", () => {
    const polys = veilPolygons();
    const total = polys.portfolio.length + polys.cv.length + polys.blog.length;
    expect(total).toBe(veilRuns().length);
    for (const z of ["portfolio", "cv", "blog"] as const) { expect(polys[z].length).toBeGreaterThan(100); for (const p of polys[z]) expect(p).toHaveLength(8); }
  });
});

describe("veilRuns", () => {
  const runs = veilRuns();
  const cells = veilCells();
  it("cubren la misma área que las celdas", () => {
    const area = runs.reduce((s, r) => s + (r.x1 - r.x0) * r.h, 0);
    expect(area).toBe((WORLD.x1 - WORLD.x0 + 2 * BLEED.x) * (WORLD.y1 - WORLD.y0 + 2 * BLEED.y));
  });
  it("cada tira es una sola zona: en su centro y en el centro de cada celda que abarca", () => {
    for (const r of runs) {
      const cx = (r.x0 + r.x1) / 2, cy = r.y + r.h / 2;
      expect(worldZoneAt(cx, cy)).toBe(r.zone);
      for (let x = r.x0; x < r.x1; x += r.h) expect(worldZoneAt(x + r.h / 2, cy)).toBe(r.zone);
    }
  });
  it("son muchas menos que las celdas", () => {
    expect(runs.length).toBeLessThan(cells.length / 4);
  });
  it("veilPolygons devuelve un cuadrilátero por tira, repartido por zona", () => {
    const polys = veilPolygons();
    const total = polys.portfolio.length + polys.cv.length + polys.blog.length;
    expect(total).toBe(runs.length);
  });
});

describe("focusAlphas", () => {
  it("sin foco nada se vela", () => {
    expect(focusAlphas(null)).toEqual({ portfolio: { veil: 0, accents: 1 }, cv: { veil: 0, accents: 1 }, blog: { veil: 0, accents: 1 } });
  });
  it("con foco en cv, las otras dos se velan y sus acentos bajan", () => {
    const a = focusAlphas("cv");
    expect(a.cv).toEqual({ veil: 0, accents: 1 });
    expect(a.portfolio).toEqual({ veil: VEIL_ALPHA, accents: ACCENT_DIM });
    expect(a.blog).toEqual({ veil: VEIL_ALPHA, accents: ACCENT_DIM });
  });
});

describe("accentZone", () => {
  it("un punto por su posición, un polígono por su primer vértice, en mundo", () => {
    expect(accentZone({ kind: "dot", at: v3(10, 10, 5), r: 1, color: "cyan" })).toBe("portfolio");
    expect(accentZone({ kind: "poly", pts: [v3(500, 200, 0), v3(10, 10, 0)], color: "magenta" })).toBe("blog");
  });
});

describe("accentsByZone", () => {
  const dot = (x: number, y: number): Accent => ({ kind: "dot", at: v3(x, y, 1), r: 1, color: "amber" });
  const port = dot(380, 118), blog = dot(500, 200), cv = dot(-30, 300);
  it("sin zona, cada luz va a la zona de su posición (accentZone)", () => {
    expect(accentsByZone([port, blog, cv])).toEqual({ portfolio: [port], cv: [cv], blog: [blog] });
  });
  it("con zona, todas van a esa zona aunque estén en otra", () => {
    expect(accentsByZone([port, blog, cv], "blog")).toEqual({ portfolio: [], cv: [], blog: [port, blog, cv] });
  });
  it("sin luces devuelve las tres zonas vacías", () => {
    expect(accentsByZone([])).toEqual({ portfolio: [], cv: [], blog: [] });
  });
});
