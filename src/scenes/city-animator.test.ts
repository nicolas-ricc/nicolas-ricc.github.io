import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { city } from "./city";
import { cityAnimator } from "./city-animator";

describe("city-animator", () => {
  it("expone cuatro capas de acentos y solo devuelve las que cambiaron", () => {
    const a = cityAnimator(city(createRng(7), createRng(8)), createRng(3), { reducedMotion: false });
    expect([...a.ids].sort()).toEqual(["city.antenna", "city.lit", "city.neon", "city.papers"]);
    for (const id of a.ids) expect(a.layer(id).kind).toBe("accent");
    const changed = a.tick(33);
    expect(changed.has("city.papers")).toBe(true);
    expect(changed.has("city.lit")).toBe(false); // primer tick: todavía encendido
  });
  it("con reduced-motion no devuelve ids", () => {
    const a = cityAnimator(city(createRng(7), createRng(8)), createRng(3), { reducedMotion: true });
    expect(a.tick(1000).size).toBe(0);
  });
  it("city.neon es una capa de acentos cian/magenta que cambia al avanzar el reloj", () => {
    const a = cityAnimator(city(createRng(7), createRng(8)), createRng(3), { reducedMotion: false });
    const l0 = a.layer("city.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    let seen = false;
    for (let i = 0; i < 20; i++) if (a.tick(100).has("city.neon")) seen = true;
    expect(seen).toBe(true);
    expect(a.layer("city.neon")).not.toEqual(l0);
  });
  it("mismo seed → misma secuencia", () => {
    const mk = () => cityAnimator(city(createRng(7), createRng(8)), createRng(3), { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
});
