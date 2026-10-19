import { describe, expect, it } from "vitest";
import { assembleWorld } from "./assemble";
import { worldZoneAt } from "../map/geo";
import { ACCENT_DIM, WORLD_ZONES, accentsByZone, focusAlphas } from "./veil";

describe("assembleWorld", () => {
  it("el mundo entero trae los siete animadores, cada uno con su zona; el agua no tiene zona", () => {
    const { scene, animators } = assembleWorld(undefined, { reducedMotion: true });
    expect(scene.terrain.bleed.length).toBeGreaterThan(0);
    const zones = animators.map((a) => a.zone);
    expect(zones.filter((z) => z === null)).toHaveLength(1);
    expect(zones.filter((z) => z === "portfolio")).toHaveLength(3); // astillero, fábrica, feria
    expect(zones.filter((z) => z === "cv")).toHaveLength(2);        // ciudad, tech
    expect(zones.filter((z) => z === "blog")).toHaveLength(1);      // mar
    const water = animators.find((a) => a.zone === null)!;
    expect(water.claims?.length ?? 0).toBeGreaterThan(0);
  });
  it("con reducedMotion ningún animador redibuja", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    for (const a of animators) expect(a.tick(1000).size).toBe(0);
  });
  it("con filtro de zonas solo vienen los animadores de esas zonas más el agua", () => {
    const { animators } = assembleWorld(["portfolio"], { reducedMotion: true });
    expect(new Set(animators.map((a) => a.zone))).toEqual(new Set([null, "portfolio"]));
    expect(animators.filter((a) => a.zone === "portfolio")).toHaveLength(2); // sin la feria (vive en el sangrado)
  });
  it("la capa tech.neon vive en un animador de Resume y se atenúa con el velo", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("tech.neon"));
    expect(a?.zone).toBe("cv");
    expect(focusAlphas("blog").cv.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").cv.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("la capa city.neon vive en un animador de Resume y se atenúa con el velo", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("city.neon"));
    expect(a?.zone).toBe("cv");
    expect(focusAlphas("blog").cv.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").cv.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("la capa sea.neon vive en un animador de Blog y se atenúa con el velo", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("sea.neon"));
    expect(a?.zone).toBe("blog");
    expect(focusAlphas("cv").blog.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").blog.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("la capa fair.neon vive en el animador de la feria, en Portfolio, y se atenúa con su velo", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("fair.neon"));
    expect(a?.zone).toBe("portfolio");
    expect(focusAlphas("cv").portfolio.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("blog").portfolio.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("cada luz animada fija (haz, neones) queda asignada a worldZoneAt de su posición", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: false });
    const sea = animators.find((a) => a.ids.includes("sea.beam"))!;
    let port = 0;
    for (let t = 0; t < 40; t++) {
      sea.tick(250);
      for (const id of ["sea.beam", "sea.neon"]) {
        const l = sea.layer(id);
        if (l.kind !== "accent") throw new Error(id);
        const byZone = accentsByZone(l.accents, l.zone);
        for (const z of WORLD_ZONES) for (const a of byZone[z]) {
          const p = a.kind === "dot" ? a.at : a.pts[0]!;
          expect(z).toBe(worldZoneAt(p.x, p.y));
          if (z === "portfolio") port++;
        }
      }
    }
    expect(port).toBeGreaterThan(0); // el haz y la galería están en Portfolio
  });
});
