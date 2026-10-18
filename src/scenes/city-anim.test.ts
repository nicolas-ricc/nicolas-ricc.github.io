import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { createRng } from "../map/seed";
import { city } from "./city";
import { ANTENNA_STEP_MS, BLINK_GAP_MS, MALECON_STEP_MS, NEON_STEP_MS, PAPER_RANGE, SIGN_GAP_MS, createCityAnim } from "./city-anim";

const setup = (reducedMotion = false) => {
  const scene = city(createRng(7), createRng(8));
  return { scene, tower: scene.tower, anim: createCityAnim(scene.tower, scene.neon, createRng(3), { reducedMotion }) };
};
const troceado = (dts: number[], seed = 3) => {
  const scene = city(createRng(7), createRng(8));
  const anim = createCityAnim(scene.tower, scene.neon, createRng(seed), { reducedMotion: false });
  for (const dt of dts) anim.tick(dt);
  return anim;
};
const veces = (n: number, dt: number) => Array.from({ length: n }, () => dt);
type Kind<K> = Extract<Accent, { kind: K }>;
const lights = (a: Accent[]) => a.filter((x): x is Kind<"dot"> => x.kind === "dot");
const signsOf = (a: Accent[]) => a.filter((x): x is Kind<"poly"> => x.kind === "poly");
const dot = (a: Accent): Extract<Accent, { kind: "dot" }> => { if (a.kind !== "dot") throw new Error("se esperaba dot"); return a; };

describe("city-anim", () => {
  it("frame 0: piso encendido, papeles escalonados desde la ventana, antena a radio 1.1", () => {
    const { tower, anim } = setup();
    const w = tower.paperWindow;
    expect(anim.lit()).toEqual(tower.litWindows);
    expect(anim.papers().length).toBeGreaterThanOrEqual(5);
    expect(anim.papers().length).toBeLessThanOrEqual(8);
    // el reguero arranca en la ventana y se estira: uno está exactamente ahí y ninguno pasa PAPER_RANGE
    expect(anim.papers().some((p) => dot(p).at.x === w.x && dot(p).at.y === w.y && dot(p).at.z === w.z)).toBe(true);
    for (const p of anim.papers()) {
      const d = dot(p);
      expect(Math.hypot(d.at.x - w.x, d.at.y - w.y)).toBeLessThanOrEqual(PAPER_RANGE + 2);
      expect(d.r).toBeGreaterThanOrEqual(0.12 - 1e-6);
      expect(d.r).toBeLessThanOrEqual(0.4 + 1e-6);
    }
    expect(dot(anim.antenna()).r).toBeCloseTo(1.1, 6);
    expect(dot(anim.antenna()).color).toBe("amberMid");
  });

  it("el piso se apaga de a un tick, nunca dos seguidos, y se apaga al menos 5 veces en 60 s", () => {
    const { anim } = setup();
    let offs = 0, prevOff = false;
    for (let t = 0; t < 60000; t += 33) {
      anim.tick(33);
      const off = anim.lit().length === 0;
      expect(off && prevOff).toBe(false);
      if (off) offs++;
      prevOff = off;
    }
    expect(offs).toBeGreaterThanOrEqual(5);
    expect(offs).toBeLessThanOrEqual(16);
  });

  it("los papeles nunca se alejan más de PAPER_RANGE de la ventana y derivan al NNE", () => {
    const { tower, anim } = setup();
    let driftedNNE = false;
    for (let t = 0; t < 20000; t += 33) {
      const c = anim.tick(33);
      expect(c.papers).toBe(true);
      for (const p of anim.papers()) {
        const d = dot(p);
        expect(Math.hypot(d.at.x - tower.paperWindow.x, d.at.y - tower.paperWindow.y)).toBeLessThanOrEqual(PAPER_RANGE + 2);
        expect(d.at.y).toBeLessThanOrEqual(tower.paperWindow.y + 2); // nunca baja hacia el sur
        expect(d.r).toBeGreaterThanOrEqual(0.12 - 1e-6);
        expect(d.r).toBeLessThanOrEqual(0.4 + 1e-6);
        if (d.at.x > tower.paperWindow.x + 10 && d.at.y < tower.paperWindow.y - 10) driftedNNE = true;
      }
    }
    expect(driftedNNE).toBe(true);
  });

  it("la antena pulsa entre 0.8 y 1.4 y solo reporta cambio cada ANTENNA_STEP_MS", () => {
    const { anim } = setup();
    let changes = 0;
    for (let t = 0; t < 10000; t += 33) {
      if (anim.tick(33).antenna) changes++;
      const r = dot(anim.antenna()).r;
      expect(r).toBeGreaterThanOrEqual(0.8 - 1e-6); expect(r).toBeLessThanOrEqual(1.4 + 1e-6);
    }
    expect(changes).toBeGreaterThan(10000 / ANTENNA_STEP_MS - 5);
    expect(changes).toBeLessThanOrEqual(10000 / ANTENNA_STEP_MS + 1);
  });

  it("con reduced-motion nada cambia", () => {
    const { tower, anim } = setup(true);
    const before = JSON.stringify(anim.papers());
    for (let t = 0; t < 5000; t += 33) expect(anim.tick(33)).toEqual({ lit: false, papers: false, antenna: false, neon: false });
    expect(anim.lit()).toEqual(tower.litWindows);
    expect(JSON.stringify(anim.papers())).toBe(before); // el reguero queda congelado donde arrancó
  });

  it("neon frame 0: carteles en su color inicial y todas las luces del malecón; solo cian/magenta", () => {
    const { scene, anim } = setup();
    expect(signsOf(anim.neon())).toEqual(scene.neon.signs);
    expect(lights(anim.neon()).map((d) => d.at)).toEqual(scene.neon.malecon);
    for (const d of lights(anim.neon())) { expect(d.color).toBe("cyanMid"); expect(d.r).toBe(0.35); }
    for (const x of anim.neon()) expect(x.color).toMatch(/^(cyan|magenta)/);
  });

  it("neon con reduced-motion: tick no reporta y la capa queda en el frame 0", () => {
    const { anim } = setup(true);
    const f0 = anim.neon();
    expect(anim.tick(1000).neon).toBe(false);
    expect(anim.neon()).toEqual(f0);
  });

  it("el malecón corre: desde el paso 1 hay exactamente 2 luces encendidas y cambian por paso", () => {
    const { anim } = setup();
    expect(anim.tick(MALECON_STEP_MS).neon).toBe(true);
    const a = lights(anim.neon());
    expect(a).toHaveLength(2);
    anim.tick(MALECON_STEP_MS);
    expect(lights(anim.neon())).toHaveLength(2);
    expect(lights(anim.neon())).not.toEqual(a);
  });

  it("carteles: hay eventos; un cambio de color persiste y un apagón apaga un solo cartel", () => {
    const { scene, anim } = setup();
    const n = scene.neon.signs.length, mag = (a: Accent[]) => signsOf(a).filter((s) => s.color === "magenta").length;
    let colorChanged = false, blinked = false;
    for (let t = 0; t < 20000; t += 50) {
      anim.tick(50);
      const s = signsOf(anim.neon());
      if (s.length < n) { blinked = true; expect(n - s.length).toBe(1); }
      if (s.length === n && mag(s) !== mag(scene.neon.signs)) colorChanged = true;
    }
    expect(colorChanged || blinked).toBe(true);
    expect(signsOf(anim.neon()).length).toBeGreaterThanOrEqual(n - 1);
  });

  it("un apagón dura un paso entero y el cartel vuelve con el mismo color", () => {
    const { scene, anim } = setup();
    const n = scene.neon.signs.length, dt = 10;
    let before = signsOf(anim.neon()), offMs = 0, blinks = 0;
    for (let t = 0; t < 120000; t += dt) {
      anim.tick(dt);
      const s = signsOf(anim.neon());
      if (s.length === n - 1) offMs += dt;
      else if (offMs > 0) {
        blinks++;
        expect(offMs).toBeGreaterThanOrEqual(NEON_STEP_MS); // un paso entero, no un frame
        expect(offMs).toBeLessThanOrEqual(NEON_STEP_MS + dt);
        expect(s).toEqual(before);
        offMs = 0;
      }
      if (s.length === n) before = s;
    }
    expect(blinks).toBeGreaterThan(0);
  });
  it("fired cuenta los apagones del piso y los eventos de carteles", () => {
    const { anim } = setup();
    expect(anim.fired()).toEqual({ lit: 0, neon: 0 });
    let offs = 0;
    for (let t = 0; t < 60000; t += 33) { anim.tick(33); if (anim.lit().length === 0) offs++; }
    expect(anim.fired().lit).toBe(offs); // a 33 ms cada disparo es un tick apagado
    expect(anim.fired().neon).toBeGreaterThanOrEqual(60000 / 7000 - 1);
    expect(anim.fired().neon).toBeLessThanOrEqual(60000 / 3000);
  });

  it("fired no cuenta nada con reduced-motion, con dt <= 0 ni con dt no finito", () => {
    const quieto = setup(true).anim;
    quieto.tick(60000);
    expect(quieto.fired()).toEqual({ lit: 0, neon: 0 });
    const { anim } = setup();
    anim.tick(0); anim.tick(-5000);
    expect(anim.fired()).toEqual({ lit: 0, neon: 0 });
    // ?speed=Infinity en el lab llega acá: sin el guard, el while no terminaría
    expect(anim.tick(Infinity)).toEqual({ lit: false, papers: false, antenna: false, neon: false });
    expect(anim.tick(NaN)).toEqual({ lit: false, papers: false, antenna: false, neon: false });
    expect(anim.fired()).toEqual({ lit: 0, neon: 0 });
  });

  it("parpadeo: tick(7000) y siete tick(1000) disparan lo mismo, y también 60 s en uno o en 60", () => {
    expect(troceado([7000]).fired().lit).toBe(troceado(veces(7, 1000)).fired().lit);
    expect(troceado([60000]).fired().lit).toBe(troceado(veces(60, 1000)).fired().lit);
    expect(troceado([60000]).fired().lit).toBe(troceado(veces(60000 / 25, 25)).fired().lit);
  });

  it("parpadeo: un tick de 10 min dispara muchos apagones, como 600 de 1 s", () => {
    const largo = troceado([600000]).fired().lit;
    expect(largo).toBeGreaterThanOrEqual(600000 / BLINK_GAP_MS[1] - 1);
    expect(largo).toBeLessThanOrEqual(600000 / BLINK_GAP_MS[0]);
    expect(largo).toBe(troceado(veces(600, 1000)).fired().lit);
  });

  it("parpadeo: tras un tick largo que apaga el piso, el siguiente tick corto lo enciende", () => {
    const { tower, anim } = setup();
    anim.tick(BLINK_GAP_MS[1]); // la primera pausa vence seguro dentro de este tick
    expect(anim.lit()).toEqual([]);
    anim.tick(33);
    expect(anim.lit()).toEqual(tower.litWindows);
  });

  it("tick(7000) y siete tick(1000) con la misma semilla dejan los mismos contadores de pisos y neones", () => {
    // en 7 s cada temporizador dispara a lo sumo una vez (pausas ≥ 4000 y ≥ 3000 ms), así que este caso
    // también daba igual con el reinicio viejo; los de 60 s y 10 min son los que lo distinguen
    for (let seed = 0; seed < 50; seed++) expect(troceado([7000], seed).fired()).toEqual(troceado(veces(7, 1000), seed).fired());
  });

  it("carteles: 60 s o 10 min de una vez disparan lo mismo que troceados", () => {
    expect(troceado([60000]).fired().neon).toBe(troceado(veces(60, 1000)).fired().neon);
    const largo = troceado([600000]).fired().neon;
    expect(largo).toBeGreaterThanOrEqual(600000 / SIGN_GAP_MS[1] - 1);
    expect(largo).toBeLessThanOrEqual(600000 / SIGN_GAP_MS[0]);
    expect(largo).toBe(troceado(veces(600, 1000)).fired().neon);
  });

  it("un troceo irregular deja los mismos contadores y colores que su suma en un tick", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33];
    const a = troceado(dts), b = troceado([dts.reduce((s, x) => s + x, 0)]);
    expect(a.fired()).toEqual(b.fired());
    expect(signsOf(a.neon()).map((s) => s.color)).toEqual(signsOf(b.neon()).map((s) => s.color));
  });

  it("sin carteles un tick largo no se cuelga y no cuenta eventos", () => {
    const scene = city(createRng(7), createRng(8));
    const anim = createCityAnim(scene.tower, { ...scene.neon, signs: [] }, createRng(3), { reducedMotion: false });
    anim.tick(600000);
    expect(anim.fired().neon).toBe(0);
  });
});
