import { describe, expect, it } from "vitest";
import { DWELL_MS, IN_MS } from "./rail-anim";
import { railAnimator } from "./rail-animator";

const IDS = ["rail.train", "rail.lights", "rail.crossing", "rail.signals"];

describe("railAnimator", () => {
  it("ids y capa desconocida", () => {
    const a = railAnimator({ reducedMotion: false });
    expect([...a.ids]).toEqual(IDS);
    expect(() => a.layer("rail.nada")).toThrow(new Error("Capa desconocida en railAnimator: rail.nada"));
  });
  it("rail.train es sólida; las tres de luces declaran zone portfolio; tren y luces con el mismo alpha", () => {
    const a = railAnimator({ reducedMotion: false });
    a.tick(15000);
    const train = a.layer("rail.train"), lights = a.layer("rail.lights");
    expect(train.kind).toBe("solid");
    for (const id of ["rail.lights", "rail.crossing", "rail.signals"]) {
      const l = a.layer(id);
      expect(l.kind, id).toBe("accent");
      if (l.kind === "accent") expect(l.zone, id).toBe("portfolio");
    }
    if (train.kind !== "solid" || lights.kind !== "accent") throw new Error("kinds");
    expect(train.solids.length).toBeGreaterThan(0);
    expect(train.alpha).toBeGreaterThan(0);
    expect(lights.alpha).toBe(train.alpha);
  });
  it("el primer tick marca los cuatro; a mitad de la espera, ninguno", () => {
    const a = railAnimator({ reducedMotion: false });
    expect([...a.tick(IN_MS + DWELL_MS / 2)].sort()).toEqual([...IDS].sort());
    expect(a.tick(100).size).toBe(0);
  });
  it("entrando marca tren y luces juntos", () => {
    const a = railAnimator({ reducedMotion: false });
    a.tick(5000);
    const c = a.tick(33);
    expect(c.has("rail.train")).toBe(true);
    expect(c.has("rail.lights")).toBe(true);
  });
  it("con reducedMotion no marca nada y el tren está detenido", () => {
    const a = railAnimator({ reducedMotion: true });
    expect(a.tick(1000).size).toBe(0);
    const t = a.layer("rail.train");
    expect(t.kind === "solid" && t.solids.length > 0 && t.alpha === 1).toBe(true);
  });
});
