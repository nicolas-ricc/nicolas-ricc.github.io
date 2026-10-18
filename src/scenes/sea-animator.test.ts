import { describe, expect, it } from "vitest";
import { LANE_SPEED, SHIPS, createSeaAnim, laneLength } from "./sea-anim";
import { seaAnimator } from "./sea-animator";
import { world } from "./world";

describe("seaAnimator", () => {
  it("expone las capas del mar (barcos, haz, boyas) y con reduced-motion no devuelve ids", () => {
    const w = world(7);
    const a = seaAnimator(w.sea!, { reducedMotion: false });
    expect(a.ids).toEqual(expect.arrayContaining(["sea.ship0", "sea.wake2", "sea.lights1", "sea.beam", "sea.buoys", "sea.ferry", "sea.ferryWake", "sea.ferryLights", "sea.neon"]));
    expect(a.layer("sea.ship0").kind).toBe("solid");
    expect(a.layer("sea.wake0")).toMatchObject({ kind: "water", alpha: 0 }); // fase 0: zarpa en la bocana, desvanecido
    expect(a.layer("sea.ship2")).toMatchObject({ kind: "solid", alpha: 1 }); // fase ⅔: a mitad de la vuelta
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
  it("al pasar a offscreen la capa del barco se marca para redibujar y queda vacía", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const toEnd = (laneLength("out") / LANE_SPEED) * 1000;
    a.tick(toEnd - 10);
    const ids = a.tick(1000);
    expect(ids.has("sea.ship0")).toBe(true); expect(ids.has("sea.wake0")).toBe(true); expect(ids.has("sea.lights0")).toBe(true);
    expect(a.layer("sea.ship0")).toEqual({ kind: "solid", solids: [], alpha: 0 });
  });
  it("las capas de los barcos llevan el rumbo del barco para ordenar en su marco; la lancha no", () => {
    const sea = world(7).sea!, a = seaAnimator(sea, { reducedMotion: false }), ref = createSeaAnim(sea, { reducedMotion: false });
    let seen = 0;
    for (let k = 0; k < SHIPS.length; k++) {
      const l = a.layer(`sea.ship${k}`), st = ref.state(k);
      expect(l.kind).toBe("solid");
      if (l.kind === "solid" && st.lane !== "offscreen") { expect(l.heading).toBe(st.heading); seen++; }
    }
    expect(seen).toBeGreaterThan(0);
    const f = a.layer("sea.ferry");
    expect(f.kind).toBe("solid");
    if (f.kind === "solid") expect(f.heading).toBeUndefined();
  });
  it("mismo seed → misma secuencia", () => {
    const mk = () => seaAnimator(world(7).sea!, { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
});
