import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { BLEED, WORLD, worldZoneAt } from "../map/geo";
import { allIsoColors } from "../map/palette-iso";
import { SUBSTATION } from "./substation";
import { LANDMARKS, world, zoneRng } from "./world";

describe("world", () => {
  it("es determinístico y cada zona tiene su propio stream de azar", () => {
    expect(JSON.stringify(world(7))).toBe(JSON.stringify(world(7)));
    expect(zoneRng(7, "portfolio").next()).not.toBe(zoneRng(7, "cv").next());
    expect(zoneRng(7, "portfolio").next()).toBe(zoneRng(7, "portfolio").next());
  });

  it("con todas las zonas trae el astillero y el terreno completo", () => {
    const w = world(7);
    expect(w.shipyard).not.toBeNull();
    expect(w.factory).not.toBeNull();
    expect(w.solids.length).toBeGreaterThan(700);
    expect(w.terrain.water.reduce((n, s) => n + (s.kind === "ground" ? s.tris.length : 0), 0) > 300).toBe(true);
    for (const s of [...w.shipyard!.solids, ...w.factory!.solids, ...w.city!.solids, ...w.sea!.solids]) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 2); expect(b.max.x).toBeLessThanOrEqual(WORLD.x1 + 1); // el distrito crece hasta el borde oeste del mundo
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1); expect(b.max.y).toBeLessThanOrEqual(WORLD.y1 + 1);
    }
    for (const s of w.solids) { // los márgenes construidos viven sobre el sangrado
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(b.max.x).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(b.max.y).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
    expect(w.hinterland).not.toBeNull(); expect(w.tech).not.toBeNull(); expect(w.fair).not.toBeNull();
    expect(world(7, { zones: ["portfolio", "cv", "blog"] }).tech).toBeNull(); // con filtro explícito no hay sangrado ni márgenes
    expect(world(7, { zones: ["portfolio", "cv", "blog"] }).fair).toBeNull();
  });

  it("filtrar por zona deja fuera lo demás", () => {
    const w = world(7, { zones: ["cv"] });
    expect(w.shipyard).toBeNull();
    expect(w.city).not.toBeNull();
    expect(w.solids.length).toBeGreaterThan(250);
    expect(w.terrain.bleed).toEqual([]);
    const b = world(7, { zones: ["blog"] });
    expect(b.city).toBeNull();
    expect(b.sea).not.toBeNull();
    expect(b.solids.length).toBeGreaterThanOrEqual(80);
  });

  it("el mundo entero trae astillero y ciudad, y el landmark de Resume cae en la torre", () => {
    const w = world(7);
    expect(w.city).not.toBeNull();
    expect(w.solids.length).toBeGreaterThan(900);
    expect(w.solids.filter((s) => !isFlat(s) && worldZoneAt(bounds(s).min.x, bounds(s).min.y) === "cv").length).toBeGreaterThan(450);
    const tower = w.solids.find((s) => s.kind === "prism" && s.h === 30)!;
    const b = bounds(tower);
    expect(LANDMARKS.cv.x).toBeGreaterThan(b.min.x); expect(LANDMARKS.cv.x).toBeLessThan(b.max.x);
    expect(LANDMARKS.cv.y).toBeGreaterThan(b.min.y); expect(LANDMARKS.cv.y).toBeLessThan(b.max.y);
  });

  it("astillero + fábrica, ciudad + distrito y Blog no comparten materiales de construcción, salvo los compartidos por regla", () => {
    const w = world(7);
    const mats = (solids: Solid[]) => new Set(solids.filter((s) => s.kind !== "cone").map((s) => s.mat));
    const portfolio = mats([...w.shipyard!.solids, ...w.factory!.solids]), cv = mats(w.city!.solids), blog = mats(w.sea!.solids);
    // glass: vidrio de fachadas; office: gris lila de la excavadora (decisión de #207). Subconjunto, no igualdad:
    // hoy la fábrica todavía no los usa (#218).
    const sharedWithCity = ["glass", "office", "rust", "steel"];
    const shared = [...portfolio].filter((m) => cv.has(m));
    expect(shared).toEqual(expect.arrayContaining(["rust", "steel"])); // lo que ya se comparte hoy sigue cubierto
    for (const m of shared) expect(sharedWithCity).toContain(m);
    const sharedWithBlog = ["steel", "rust", "hull", "rock", "glass", "whitewash"]; // glass: la linterna del faro (spec §7); whitewash: porcelana y remates de la fábrica (#207)
    for (const other of [portfolio, cv]) for (const m of blog) if (other.has(m)) expect(sharedWithBlog).toContain(m);
  });

  it("los landmarks caen en su zona", () => {
    for (const z of ["portfolio", "cv", "blog"] as const) expect(worldZoneAt(LANDMARKS[z].x, LANDMARKS[z].y)).toBe(z);
  });

  it("todo el render usa colores del atlas", () => {
    const w = world(7);
    const colors = allIsoColors();
    for (const i of buildRenderList([...w.terrain.ground, ...w.terrain.water, w.terrain.foam, ...w.terrain.bleed, ...w.ground, ...w.solids])) expect(colors.has(i.color)).toBe(true);
  });

  it("ningún sólido elevado de otra escena entra al cerco de la subestación (#244)", () => {
    const w = world(7);
    const mine = new Set(w.factory!.solids);
    const others = w.solids.filter((s) => !isFlat(s) && !mine.has(s));
    expect(others.length).toBeLessThan(w.solids.length - mine.size + 1);
    for (const s of others) {
      const b = bounds(s);
      expect(b.max.x <= SUBSTATION.x0 || b.min.x >= SUBSTATION.x1 || b.max.y <= SUBSTATION.y0 || b.min.y >= SUBSTATION.y1, JSON.stringify(s).slice(0, 90)).toBe(true);
    }
  });

  it("el landmark del Blog cae en la fosa y el sangrado existe solo con el mundo entero", () => {
    expect(worldZoneAt(LANDMARKS.blog.x, LANDMARKS.blog.y)).toBe("blog");
    expect(world(7).terrain.bleed.length).toBeGreaterThan(0);
    expect(world(7, { zones: ["portfolio"] }).terrain.bleed).toEqual([]);
  });

  it("Portfolio con fábrica supera 400 sólidos elevados y la fábrica queda al norte y al oeste del astillero", () => {
    const w = world(7);
    const raised = w.solids.filter((s) => !isFlat(s) && worldZoneAt(bounds(s).min.x, bounds(s).min.y) === "portfolio");
    expect(raised.length).toBeGreaterThan(400);
    const inNewRegion = (b: ReturnType<typeof bounds>) => b.min.x >= 4 && b.max.x <= 99 && b.min.y >= -4 && b.max.y <= 99; // región que deja el astillero (#238)
    expect(w.factory!.solids.every((s) => bounds(s).max.y <= 0 || bounds(s).max.x <= 0 || inNewRegion(bounds(s)))).toBe(true);
  });
});
