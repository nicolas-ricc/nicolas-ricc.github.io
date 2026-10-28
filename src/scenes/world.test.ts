import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { BLEED, WORLD, worldZoneAt } from "../map/geo";
import { allIsoColors } from "../map/palette-iso";
import { STAIR_TOWER } from "./boiler-house";
import { PLANT } from "./factory";
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
    expect(w.solids.filter((s) => mine.has(s))).toHaveLength(mine.size); // world() reusa los objetos de la fábrica
    for (const s of others) {
      const b = bounds(s);
      expect(b.max.x <= SUBSTATION.x0 || b.min.x >= SUBSTATION.x1 || b.max.y <= SUBSTATION.y0 || b.min.y >= SUBSTATION.y1, JSON.stringify(s).slice(0, 90)).toBe(true);
    }
  });

  it("ningún sólido elevado de otra escena entra a la huella de la planta ni a la playa de camiones (#246)", () => {
    const w = world(7);
    const mine = new Set(w.factory!.solids);
    const others = w.solids.filter((s) => !isFlat(s) && !mine.has(s));
    const areas = [{ x0: PLANT.x, x1: STAIR_TOWER.x1, y0: PLANT.y - 0.6, y1: PLANT.y + PLANT.d + 1.5 }, { x0: PLANT.x, x1: STAIR_TOWER.x1, y0: PLANT.y + PLANT.d + 1.5, y1: PLANT.y + PLANT.d + 16 }]; // techo desde el alero norte hasta el zócalo; playa al sur
    for (const s of others) {
      const b = bounds(s);
      for (const a of areas) expect(b.max.x <= a.x0 || b.min.x >= a.x1 || b.max.y <= a.y0 || b.min.y >= a.y1, JSON.stringify(s).slice(0, 90)).toBe(true);
    }
  });

  it("el astillero en la banda norte no toca el desvío, los vagones, la locomotora ni la grúa torre (#247)", () => {
    const w = world(7);
    const siding = w.factory!.ground.filter((s) => s.kind === "strip").map(bounds).filter((b) => b.min.y >= -9.01 && b.max.y <= -6.99); // rieles del desvío
    const pieces = w.factory!.solids.filter((s) => !isFlat(s)).map(bounds).filter((b) => b.min.y >= -13.1 && b.max.y <= -6.7); // vagones, locomotora y grúa torre
    expect(siding).toHaveLength(2);
    expect(pieces.length).toBeGreaterThanOrEqual(8);
    const band = w.shipyard!.solids.filter((s) => s.kind !== "cone" && bounds(s).max.y < 0 && bounds(s).min.x < 198); // sin muelle ni bolardos
    expect(band.length).toBeGreaterThanOrEqual(40);
    for (const s of band) {
      const b = bounds(s), where = JSON.stringify(s).slice(0, 90);
      expect(b.min.y, where).toBeGreaterThanOrEqual(-60);
      for (const o of [...siding, ...pieces]) {
        expect(b.max.x <= o.min.x + 1e-9 || o.max.x <= b.min.x + 1e-9 || b.max.y <= o.min.y + 1e-9 || o.max.y <= b.min.y + 1e-9, where).toBe(true);
      }
    }
  });

  it("el landmark del Blog cae en la fosa y el sangrado existe solo con el mundo entero", () => {
    expect(worldZoneAt(LANDMARKS.blog.x, LANDMARKS.blog.y)).toBe("blog");
    expect(world(7).terrain.bleed.length).toBeGreaterThan(0);
    expect(world(7, { zones: ["portfolio"] }).terrain.bleed).toEqual([]);
  });

  it("Portfolio con fábrica supera 400 sólidos elevados y la fábrica queda en la columna oeste, el desvío con la grúa o la región nueva (#246)", () => {
    const w = world(7);
    const raised = w.solids.filter((s) => !isFlat(s) && worldZoneAt(bounds(s).min.x, bounds(s).min.y) === "portfolio");
    expect(raised.length).toBeGreaterThan(400);
    const west = (b: ReturnType<typeof bounds>) => b.max.x <= 0; // columna oeste
    const sidingAndCrane = (b: ReturnType<typeof bounds>) => b.min.y >= -13.1 && b.max.y <= -6.7; // desvío y grúa torre, que se quedan
    const inNewRegion = (b: ReturnType<typeof bounds>) => b.min.x >= 4 && b.max.x <= 98.7 && b.min.y >= -4 && b.max.y <= 99; // región que deja el astillero (#238); x ≤ 98.7 para todo sólido, más estricto que el issue (que lo pide para lo de más de 7 de alto)
    expect(w.factory!.solids.filter((s) => !west(bounds(s)) && !sidingAndCrane(bounds(s)) && !inNewRegion(bounds(s))).map((s) => JSON.stringify(s).slice(0, 90))).toEqual([]);
  });
});
