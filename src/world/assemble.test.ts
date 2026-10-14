import { describe, expect, it } from "vitest";
import { assembleWorld } from "./assemble";
import { ACCENT_DIM, focusAlphas } from "./veil";

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
});
