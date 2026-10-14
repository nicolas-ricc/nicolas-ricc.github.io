import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import { bounds, wheelPoint } from "../iso/solids";
import { createRng } from "../map/seed";
import { DROP, WHEEL, coasterAt, coasterLength, fair } from "./fair";
import { DROP_CYCLE_MS, DROP_RISE_MS, NEON_STEP_MS, WHEEL_LIGHT_STEP_MS, WHEEL_PERIOD_MS, WHEEL_STEP_MS, createFairAnim } from "./fair-anim";

const setup = (reducedMotion = false) => createFairAnim(fair(createRng(7)), { reducedMotion });

describe("fair-anim", () => {
  it("la rueda da una vuelta en 40 s y se redibuja cada 250 ms; cuatro luces de la llanta encendidas a la vez", () => {
    const a = setup();
    expect(a.angle()).toBe(0);
    expect(a.tick(WHEEL_STEP_MS).wheel).toBe(true); expect(a.tick(50).wheel).toBe(false);
    // El reloj queda entre 300 ms y 40 000 ms: nunca llega a completar la vuelta.
    for (let t = WHEEL_STEP_MS + 50; t + 500 < WHEEL_PERIOD_MS; t += 500) a.tick(500);
    expect(a.angle()).toBeGreaterThan(6.2); expect(a.angle()).toBeLessThan(2 * Math.PI);
    expect(a.wheelLights()).toHaveLength(4);
    // Las luces corren más seguido que la rueda (150 ms contra 250 ms): tras un paso de luces sin paso
    // de rueda, la rueda en pantalla sigue siendo la dibujada antes (`drawn`), así que las luces tienen
    // que caer en sus góndolas, o sea leer el ángulo cuantizado de la rueda y no el reloj continuo.
    const drawn = a.wheel()[0]!;
    if (drawn.kind !== "wheel") throw new Error("la rueda no es kind wheel");
    expect(a.tick(WHEEL_LIGHT_STEP_MS).wheel).toBe(false);
    const slots = Array.from({ length: WHEEL.sides }, (_, k) => wheelPoint(drawn.at, drawn.angle + (2 * Math.PI * (k + 0.5)) / WHEEL.sides, WHEEL.r - 0.6));
    for (const l of a.wheelLights()) {
      expect(l.kind).toBe("dot");
      const at = l.kind === "dot" ? l.at : drawn.at;
      expect(slots.some((s) => Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z) < 1e-9)).toBe(true);
    }
  });
  it("el tren nunca sale de la vía, sube despacio y baja rápido", () => {
    const a = setup();
    const L = coasterLength();
    let prev = a.trainDist(), prevSeg = coasterAt(prev).seg;
    for (let t = 0; t < 60; t++) {
      a.tick(1000);
      const d = a.trainDist(), p = coasterAt(d);
      const moved = ((d - prev) % L + L) % L; prev = d;
      expect(moved).toBeGreaterThan(0); expect(moved).toBeLessThanOrEqual(9.01);
      if (prevSeg < 6 && p.seg < 6) expect(moved).toBeLessThanOrEqual(3.01); // la velocidad se decide al arrancar el tick
      prevSeg = p.seg;
      // El perfil real llega a 4.16 (vía + 1.45 del asiento) entre el auto de punta y el de cola (5.2 atrás) en la bajada más brusca: 3 no alcanza.
      for (const s of a.train()) { const b = bounds(s); expect(Math.abs((b.min.z + b.max.z) / 2 - p.z)).toBeLessThan(4.2); }
    }
  });
  it("la góndola sube 6 s, espera 1 s, cae en 0.6 s y vuelve a la base al final del ciclo", () => {
    const a = setup();
    expect(a.dropZ()).toBe(1);
    for (let t = 0; t < 6000; t += 100) a.tick(100);
    expect(a.dropZ()).toBeCloseTo(DROP.h - 3, 1);
    a.tick(1000); expect(a.dropZ()).toBeCloseTo(DROP.h - 3, 1);
    a.tick(600); expect(a.dropZ()).toBeCloseTo(1, 1);
    a.tick(DROP_CYCLE_MS - 7600); expect(a.dropZ()).toBeCloseTo(1, 1);
    expect(a.drop()).toHaveLength(9);
  });
  it("los carteles del salón alternan cada 500 ms; con reduced-motion nada cambia y la rueda tiene sus 4 luces fijas", () => {
    const a = setup();
    const s0 = a.signs()[0]!.color; a.tick(500); expect(a.signs()[0]!.color).not.toBe(s0);
    const r = setup(true);
    expect(r.tick(1000)).toEqual({ wheel: false, lights: false, train: false, drop: false, signs: false, neon: false });
    expect(r.wheelLights()).toHaveLength(4); expect(r.angle()).toBe(0);
  });
});

const dots = (a: Accent[]) => a.flatMap((x) => (x.kind === "dot" ? [x] : []));
const on = (pts: Vec3[], a: Accent[]) => dots(a).filter((d) => pts.some((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z));

describe("fair-anim neon", () => {
  it("frame 0 y reduced motion: 4 de marquesina, 2 de subida, columna entera en magentaBleed; solo cyan/magenta", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false }), r = createFairAnim(s, { reducedMotion: true });
    const f0 = a.neon();
    expect(on(s.neon.marquee, f0)).toHaveLength(4);
    expect(on(s.neon.lift, f0)).toHaveLength(2);
    expect(on(s.neon.column, f0).map((d) => [d.color, d.r])).toEqual(Array(6).fill(["magentaBleed", 0.25]));
    for (const x of f0) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(r.neon()).toEqual(f0);
    expect(r.tick(1000).neon).toBe(false);
    expect(r.neon()).toEqual(f0);
  });
  it("la marquesina corre cada 200 ms y cada posición conserva su color (par cyan, impar magenta)", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    const m0 = on(s.neon.marquee, a.neon());
    expect(a.tick(NEON_STEP_MS).neon).toBe(true);
    const m1 = on(s.neon.marquee, a.neon());
    expect(m1).toHaveLength(4); expect(m1).not.toEqual(m0);
    for (let t = 0; t < 16; t++) {
      for (const d of on(s.neon.marquee, a.neon())) {
        const k = s.neon.marquee.findIndex((p) => p.x === d.at.x);
        expect(d.color).toBe(k % 2 === 0 ? "cyan" : "magenta"); expect(d.r).toBe(0.35);
      }
      a.tick(NEON_STEP_MS);
    }
  });
  it("la subida corre hacia arriba con dos luces cyanMid", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    const idx = () => on(s.neon.lift, a.neon()).map((d) => s.neon.lift.findIndex((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z)).sort((x, y) => x - y);
    expect(idx()).toEqual([0, 1]);
    a.tick(NEON_STEP_MS); expect(idx()).toEqual([1, 2]);
    for (const d of on(s.neon.lift, a.neon())) expect(d.color).toBe("cyanMid");
  });
  it("la columna sube con la góndola: en la cima las cinco de abajo en magenta, en la base ninguna", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    for (let t = 0; t < DROP_RISE_MS + 500; t += 100) a.tick(100);
    // la góndola llega a DROP.h − 3 = 21 y la última luz está en drop.h − 2 = 22: nunca se enciende
    expect(on(s.neon.column, a.neon()).map((d) => d.color)).toEqual([...Array(5).fill("magenta"), "magentaBleed"]);
    for (let t = 0; t < DROP_CYCLE_MS - DROP_RISE_MS - 500 + 100; t += 100) a.tick(100);
    expect(on(s.neon.column, a.neon()).every((d) => d.color === "magentaBleed")).toBe(true);
    const b = createFairAnim(s, { reducedMotion: false });
    for (let t = 0; t < DROP_RISE_MS / 2; t += 100) b.tick(100);
    expect(new Set(on(s.neon.column, b.neon()).map((d) => d.color))).toEqual(new Set(["magenta", "magentaBleed"]));
  });
});
