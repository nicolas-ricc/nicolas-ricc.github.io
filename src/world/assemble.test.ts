import { describe, expect, it } from "vitest";
import { assembleWorld } from "./assemble";
import { worldZoneAt } from "../map/geo";
import { ACCENT_DIM, WORLD_ZONES, accentsByZone, focusAlphas } from "./veil";

describe("assembleWorld", () => {
  it("the whole world brings the eight animators, each with its zone; the water has no zone", () => {
    const { scene, animators } = assembleWorld(undefined, { reducedMotion: true });
    expect(scene.terrain.bleed.length).toBeGreaterThan(0);
    const zones = animators.map((a) => a.zone);
    expect(zones.filter((z) => z === null)).toHaveLength(1);
    expect(zones.filter((z) => z === "portfolio")).toHaveLength(4); // shipyard, train, factory, fair
    expect(zones.filter((z) => z === "cv")).toHaveLength(2);        // city, tech
    expect(zones.filter((z) => z === "blog")).toHaveLength(1);      // sea
    const water = animators.find((a) => a.zone === null)!;
    expect(water.claims?.length ?? 0).toBeGreaterThan(0);
  });
  it("with reducedMotion no animator redraws", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    for (const a of animators) expect(a.tick(1000).size).toBe(0);
  });
  it("with a zone filter only the animators of those zones plus the water come", () => {
    const { animators } = assembleWorld(["portfolio"], { reducedMotion: true });
    expect(new Set(animators.map((a) => a.zone))).toEqual(new Set([null, "portfolio"]));
    expect(animators.filter((a) => a.zone === "portfolio")).toHaveLength(3); // shipyard, train and factory: without the fair (it lives in the bleed)
  });
  it("the train lives in a Portfolio animator and its three light layers declare zone portfolio", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("rail.train"));
    expect(a?.zone).toBe("portfolio");
    for (const id of ["rail.lights", "rail.crossing", "rail.signals"]) {
      const l = a!.layer(id);
      expect(l.kind === "accent" && l.zone, id).toBe("portfolio");
    }
  });
  it("with the [\"portfolio\"] filter the train is still assembled", () => {
    const { animators } = assembleWorld(["portfolio"], { reducedMotion: true });
    expect(animators.some((x) => x.ids.includes("rail.train"))).toBe(true);
  });
  it("the tech.neon layer lives in a Resume animator and is dimmed by the veil", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("tech.neon"));
    expect(a?.zone).toBe("cv");
    expect(focusAlphas("blog").cv.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").cv.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("the city.neon layer lives in a Resume animator and is dimmed by the veil", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("city.neon"));
    expect(a?.zone).toBe("cv");
    expect(a!.ids).toContain("city.windows");
    expect(focusAlphas("blog").cv.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").cv.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("the sea.neon layer lives in a Blog animator and is dimmed by the veil", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("sea.neon"));
    expect(a?.zone).toBe("blog");
    expect(focusAlphas("cv").blog.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").blog.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("the fair.neon layer lives in the fair animator, in Portfolio, and is dimmed by its veil", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("fair.neon"));
    expect(a?.zone).toBe("portfolio");
    expect(focusAlphas("cv").portfolio.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("blog").portfolio.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
  it("each fixed animated light (beam, neons) is assigned to worldZoneAt of its position", () => {
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
    expect(port).toBeGreaterThan(0); // the beam and the gallery are in Portfolio
  });
});
