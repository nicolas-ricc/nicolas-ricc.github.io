import { describe, expect, it } from "vitest";
import { BLEED, WORLD } from "../map/geo";
import { assembleWorld } from "../world/assemble";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS, pickExhibit, stepExhibit } from "./exhibits";

const regions = EXHIBITS.flatMap((e) => (e.kind === "region" ? [e] : []));

describe("catálogo de exhibits", () => {
  it("ids únicos con el patrón del hash", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("al menos cuatro regiones y una por zona", () => {
    expect(regions.length).toBeGreaterThanOrEqual(4);
    expect(new Set(regions.map((e) => e.zone))).toEqual(new Set(["portfolio", "cv", "blog"]));
  });
  it("cada caja cae dentro del mundo más el sangrado y no está invertida", () => {
    for (const { box } of regions) {
      expect(box.x0).toBeLessThan(box.x1); expect(box.y0).toBeLessThan(box.y1);
      expect(box.x0).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(box.x1).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(box.y0).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(box.y1).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
  });
  const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
  it("contra el mundo real cada región recorta al menos un sólido y un animador que no es el agua", () => {
    for (const e of regions) {
      expect(cropScene(scene, e.box).solids.length, e.id).toBeGreaterThan(0);
      expect(cropAnimators(animators, e.box).some((a) => a.zone !== null), e.id).toBe(true);
    }
  });
});

describe("selección por hash", () => {
  const [first, second] = EXHIBITS;
  it("acepta el hash con o sin #", () => {
    expect(pickExhibit(`#${second!.id}`)).toBe(second);
    expect(pickExhibit(second!.id)).toBe(second);
  });
  it("vacío, solo # o desconocido → el primero", () => {
    for (const h of ["", "#", "#nada", "#%E0%A4%A", `#${second!.id.toUpperCase()}`]) expect(pickExhibit(h)).toBe(first);
  });
  it("las flechas dan la vuelta en los extremos", () => {
    const last = EXHIBITS[EXHIBITS.length - 1]!;
    expect(stepExhibit(first!.id, 1)).toBe(second);
    expect(stepExhibit(first!.id, -1)).toBe(last);
    expect(stepExhibit(last.id, 1)).toBe(first);
  });
});
