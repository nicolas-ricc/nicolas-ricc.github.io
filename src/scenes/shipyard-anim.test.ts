import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { createRng } from "../map/seed";
import { shipyard } from "./shipyard";
import { SPARK_GAP_MS, TROLLEY_CYCLE_MS, TROLLEY_PAUSE_MS, createShipyardAnim } from "./shipyard-anim";

const setup = (reducedMotion = false) => {
  const scene = shipyard(createRng(7));
  return { scene, anim: createShipyardAnim(scene, createRng(3), { reducedMotion }) };
};

/** Los acentos de este escenario siempre son puntos; angosta el tipo para los tests. */
const dot = (a: Accent): Extract<Accent, { kind: "dot" }> => {
  if (a.kind !== "dot") throw new Error("se esperaba un acento de tipo dot");
  return a;
};

describe("shipyard-anim", () => {
  it("el carro nunca sale de la viga y vuelve al inicio tras un ciclo", () => {
    const { scene, anim } = setup();
    const [y0, y1] = scene.trolleyRange;
    for (let t = 0; t < TROLLEY_CYCLE_MS; t += 33) {
      anim.tick(33);
      expect(scene.trolley.at.y).toBeGreaterThanOrEqual(y0 - 1e-9);
      expect(scene.trolley.at.y).toBeLessThanOrEqual(y1 + 1e-9);
    }
    anim.tick(TROLLEY_CYCLE_MS - (Math.floor(TROLLEY_CYCLE_MS / 33) * 33));
    expect(scene.trolley.at.y).toBeCloseTo(y0, 3);
  });

  it("durante la pausa inicial el carro no se mueve y tick no reporta cambio", () => {
    const { scene, anim } = setup();
    const y = scene.trolley.at.y;
    const c = anim.tick(TROLLEY_PAUSE_MS / 2);
    expect(scene.trolley.at.y).toBe(y);
    expect(c.trolley).toBe(false);
  });

  it("a mitad de ciclo el carro está en el otro extremo", () => {
    const { scene, anim } = setup();
    anim.tick(TROLLEY_CYCLE_MS / 2);
    expect(scene.trolley.at.y).toBeCloseTo(scene.trolleyRange[1], 3);
    expect(dot(anim.trolleyLamp()).at.y).toBeCloseTo(scene.trolleyRange[1] + 2, 3);
    expect(dot(anim.trolleyLamp()).at.z).toBeLessThan(scene.trolley.at.z);
  });

  it("las chispas aparecen en una cuaderna, duran tres frames y desaparecen", () => {
    const { scene, anim } = setup();
    let seen = 0, maxFrames = 0, run = 0;
    let runSpot: { x: number; y: number } | null = null;
    for (let t = 0; t < 20000; t += 100) {
      anim.tick(100);
      const s = anim.sparks();
      if (s.length > 0) {
        seen++; run++; maxFrames = Math.max(maxFrames, run);
        expect(s.length).toBeGreaterThanOrEqual(4);
        expect(s.length).toBeLessThanOrEqual(6);
        expect(scene.weldSpots.some((w) => Math.abs(w.x - dot(s[0]!).at.x) < 3 && Math.abs(w.y - dot(s[0]!).at.y) < 3)).toBe(true);
        if (run === 1) {
          // primera frame del evento: fija la cuaderna que todo el flicker debe respetar.
          // Se promedia la frame para cancelar el jitter y se toma la cuaderna más
          // cercana (no la primera que matchee un umbral, porque hay varias a <3u).
          const cx = s.reduce((sum, a) => sum + dot(a).at.x, 0) / s.length;
          const cy = s.reduce((sum, a) => sum + dot(a).at.y, 0) / s.length;
          runSpot = scene.weldSpots.reduce((best, w) => {
            const d = Math.hypot(w.x - cx, w.y - cy);
            return d < best.d ? { w, d } : best;
          }, { w: scene.weldSpots[0]!, d: Infinity }).w;
        } else if (runSpot) {
          // frames siguientes del mismo evento: todas las chispas cerca de la MISMA cuaderna
          for (const a of s) {
            expect(Math.abs(dot(a).at.x - runSpot.x)).toBeLessThan(3);
            expect(Math.abs(dot(a).at.y - runSpot.y)).toBeLessThan(3);
          }
        }
      } else { run = 0; runSpot = null; }
    }
    expect(seen).toBeGreaterThan(5);
    expect(maxFrames).toBeLessThanOrEqual(3);
  });

  it("con reduced-motion nada cambia nunca", () => {
    const { scene, anim } = setup(true);
    const y = scene.trolley.at.y;
    for (let i = 0; i < 100; i++) {
      const c = anim.tick(200);
      expect(c).toEqual({ trolley: false, sparks: false });
    }
    expect(scene.trolley.at.y).toBe(y);
    expect(anim.sparks()).toEqual([]);
  });
});

describe("shipyard-anim: troceo (#125)", () => {
  const troceado = (dts: number[]) => {
    const { scene, anim } = setup();
    for (const dt of dts) anim.tick(dt);
    return { y: scene.trolley.at.y, anim };
  };
  const veces = (n: number, dt: number) => Array.from({ length: n }, () => dt);
  it("un tick de 60 s deja lo mismo que 600 ticks de 100 ms", () => {
    const a = troceado([60000]), b = troceado(veces(600, 100));
    expect(a.anim.fired().sparks).toBeGreaterThan(0);
    expect(a.anim.fired()).toEqual(b.anim.fired());
    expect(a.anim.sparks()).toEqual(b.anim.sparks());
    expect(a.y).toBe(b.y);
  });
  it("un troceo irregular deja lo mismo que su suma", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 1234];
    const a = troceado(dts), b = troceado([dts.reduce((s, x) => s + x, 0)]);
    expect(a.anim.fired()).toEqual(b.anim.fired());
    expect(a.anim.sparks()).toEqual(b.anim.sparks());
  });
  it("un tick largo que termina a mitad de un evento muestra el mismo cuadro", () => {
    const b = setup().anim;
    let t = 0;
    while (b.sparks().length === 0) { b.tick(100); t += 100; }
    b.tick(100); t += 100; // segundo cuadro del evento
    const a = setup().anim;
    a.tick(t);
    expect(b.sparks().length).toBeGreaterThan(0);
    expect(a.sparks()).toEqual(b.sparks());
  });
  it("10 min de una vez: tantos eventos como 6000 ticks de 100 ms", () => {
    const largo = troceado([600000]).anim.fired().sparks;
    expect(largo).toBeGreaterThanOrEqual(600000 / (SPARK_GAP_MS[1] + 300) - 1);
    expect(largo).toBeLessThanOrEqual(600000 / SPARK_GAP_MS[0]);
    expect(largo).toBe(troceado(veces(6000, 100)).anim.fired().sparks);
  });
  it("dt no válido no cambia nada", () => {
    const { scene, anim } = setup();
    const y = scene.trolley.at.y;
    for (const dt of [0, -5, NaN, Infinity]) expect(anim.tick(dt)).toEqual({ trolley: false, sparks: false });
    expect(anim.fired().sparks).toBe(0);
    expect(scene.trolley.at.y).toBe(y);
  });
});
