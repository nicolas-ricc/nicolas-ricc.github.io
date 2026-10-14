import { describe, expect, it } from "vitest";
import { seaAnimator } from "./sea-animator";
import { world } from "./world";

describe("seaAnimator", () => {
  it("expone las capas del mar (barcos, haz, boyas) y con reduced-motion no devuelve ids", () => {
    const w = world(7);
    const a = seaAnimator(w.sea!, { reducedMotion: false });
    expect(a.ids).toEqual(expect.arrayContaining(["sea.ship0", "sea.wake2", "sea.lights1", "sea.beam", "sea.buoys", "sea.ferry", "sea.ferryWake", "sea.ferryLights", "sea.neon"]));
    expect(a.layer("sea.ship0").kind).toBe("solid");
    expect(a.layer("sea.wake0")).toMatchObject({ kind: "water", alpha: 0 }); // fase 0: en la bahía, aún invisible: no hace falta redibujarlo
    const ids = a.tick(100);
    expect(ids.has("sea.ship0")).toBe(true); expect(ids.has("sea.beam")).toBe(true);
    const r = seaAnimator(w.sea!, { reducedMotion: true });
    expect(r.tick(1000).size).toBe(0);
  });
  it("sea.neon es una capa de acentos cian/magenta que cambia al avanzar el reloj", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const l0 = a.layer("sea.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(a.tick(200).has("sea.neon")).toBe(true);
    expect(a.layer("sea.neon")).not.toEqual(l0);
    expect(seaAnimator(world(7).sea!, { reducedMotion: true }).tick(1000).has("sea.neon")).toBe(false);
  });
  it("mismo seed → misma secuencia", () => {
    const mk = () => seaAnimator(world(7).sea!, { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
});
