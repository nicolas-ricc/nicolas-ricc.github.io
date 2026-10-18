import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { createRng } from "../map/seed";
import { WINDOW_ALPHA } from "../city/lights";
import { city, type CityScene } from "./city";
import { ANTENNA_STEP_MS, MALECON_STEP_MS, NEON_STEP_MS, PAPER_RANGE, createCityAnim } from "./city-anim";

const setup = (reducedMotion = false) => {
  const scene = city(createRng(7), createRng(8), createRng(9));
  return { scene, tower: scene.tower, anim: createCityAnim(scene, createRng(3), { reducedMotion }) };
};
/** Saca de una capa `neon()` los acentos del neón de calle (los copia con otro alfa al titilar, pero conserva `pts`). */
const withoutStreet = (scene: CityScene, a: Accent[]): Accent[] => {
  const pts = new Set(scene.lights.neons.flatMap((n) => n.accents.flatMap((x) => (x.kind === "poly" ? [x.pts] : []))));
  return a.filter((x) => x.kind !== "poly" || !pts.has(x.pts));
};
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
    for (let t = 0; t < 5000; t += 33) expect(anim.tick(33)).toEqual({ lit: false, papers: false, antenna: false, neon: false, windows: false });
    expect(anim.lit()).toEqual(tower.litWindows);
    expect(JSON.stringify(anim.papers())).toBe(before); // el reguero queda congelado donde arrancó
  });

  it("neon frame 0: carteles en su color inicial y todas las luces del malecón; solo cian/magenta", () => {
    const { scene, anim } = setup();
    const own = withoutStreet(scene, anim.neon());
    expect(signsOf(own)).toEqual(scene.neon.signs);
    expect(lights(own).map((d) => d.at)).toEqual(scene.neon.malecon);
    for (const d of lights(own)) { expect(d.color).toBe("cyanMid"); expect(d.r).toBe(0.35); }
    for (const x of own) expect(x.color).toMatch(/^(cyan|magenta)/);
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
      const s = signsOf(withoutStreet(scene, anim.neon()));
      if (s.length < n) { blinked = true; expect(n - s.length).toBe(1); }
      if (s.length === n && mag(s) !== mag(scene.neon.signs)) colorChanged = true;
    }
    expect(colorChanged || blinked).toBe(true);
    expect(signsOf(withoutStreet(scene, anim.neon())).length).toBeGreaterThanOrEqual(n - 1);
  });

  it("un apagón dura un paso entero y el cartel vuelve con el mismo color", () => {
    const { scene, anim } = setup();
    const n = scene.neon.signs.length, dt = 10;
    let before = signsOf(withoutStreet(scene, anim.neon())), offMs = 0, blinks = 0;
    for (let t = 0; t < 120000; t += dt) {
      anim.tick(dt);
      const s = signsOf(withoutStreet(scene, anim.neon()));
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

  it("ventanas frame 0: las animables encendidas de lights, con su color y alfa 0.85", () => {
    const { scene, anim } = setup();
    const want = scene.lights.windows.filter((w) => w.animable && w.on).map((w) => ({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA }));
    expect(want.length).toBeGreaterThan(0);
    expect(anim.windows()).toEqual(want);
  });

  it("ventanas: en 60 s cambian ≥ 40 veces, siempre dentro de ±max(1, 5 %) del objetivo y solo entre las animables", () => {
    const { scene, anim } = setup();
    const animable = scene.lights.windows.filter((w) => w.animable);
    const pts = new Set(animable.map((w) => w.window.pts));
    const target = animable.filter((w) => w.on).length, tol = Math.max(1, Math.round(0.05 * animable.length));
    let changes = 0;
    const seen = new Set<string>();
    for (let t = 0; t < 60000; t += 100) {
      if (anim.tick(100).windows) changes++;
      const ws = anim.windows();
      expect(Math.abs(ws.length - target)).toBeLessThanOrEqual(tol);
      for (const w of ws) { expect(w.kind).toBe("poly"); if (w.kind === "poly") expect(pts.has(w.pts)).toBe(true); }
      seen.add(JSON.stringify(ws));
    }
    expect(changes).toBeGreaterThanOrEqual(40);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("ventanas: sin animables la capa queda vacía y nunca reporta cambio", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, lights: { ...scene.lights, windows: [] } }, createRng(3), { reducedMotion: false });
    expect(anim.windows()).toEqual([]);
    for (let t = 0; t < 10000; t += 100) expect(anim.tick(100).windows).toBe(false);
  });

  it("ventanas: con una o dos animables no hay excepción y la cantidad queda en objetivo ± 1", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const base = scene.lights.windows.filter((w) => w.animable);
    for (const ws of [[{ ...base[0]!, on: true }], [{ ...base[0]!, on: false }, { ...base[1]!, on: false }]]) {
      const target = ws.filter((w) => w.on).length;
      const anim = createCityAnim({ ...scene, lights: { ...scene.lights, windows: ws } }, createRng(3), { reducedMotion: false });
      let changes = 0;
      for (let t = 0; t < 10000; t += 100) {
        if (anim.tick(100).windows) changes++;
        expect(Math.abs(anim.windows().length - target)).toBeLessThanOrEqual(1);
      }
      expect(changes).toBeGreaterThan(0);
    }
  });

  it("ventanas con reduced-motion: quedan en el frame 0 y tick no reporta", () => {
    const { anim } = setup(true);
    const f0 = anim.windows();
    for (let t = 0; t < 5000; t += 100) expect(anim.tick(100).windows).toBe(false);
    expect(anim.windows()).toEqual(f0);
  });

  it("el neón de calle elegido está en la capa en el frame 0 tal cual, y ningún otro neón de calle", () => {
    const { scene, anim } = setup();
    const f = scene.lights.flicker!;
    expect(f).not.toBeNull();
    const layer = anim.neon();
    for (const a of scene.lights.neons[f]!.accents) expect(layer).toContainEqual(a);
    scene.lights.neons.forEach((n, i) => { if (i !== f) for (const a of n.accents) expect(layer.some((x) => x.kind === "poly" && a.kind === "poly" && x.pts === a.pts)).toBe(false); });
  });

  it("el neón titila ≥ 10 veces en 60 s: frente y halo a 0.3 un paso exacto, el charco igual, y vuelve a su alfa", () => {
    const { scene, anim } = setup();
    const n = scene.lights.neons[scene.lights.flicker!]!.accents;
    const front = n[1]!, halo = n[0]!, puddle = n.slice(2);
    expect(front).toMatchObject({ color: scene.lights.neons[scene.lights.flicker!]!.color, alpha: 1 });
    expect(halo).toMatchObject({ alpha: 0.6 });
    const find = (layer: Accent[], a: Accent) => layer.find((x) => x.kind === "poly" && a.kind === "poly" && x.pts === a.pts)!;
    const dt = 10;
    let flickers = 0, dimMs = 0;
    for (let t = 0; t < 60000; t += dt) {
      const c = anim.tick(dt);
      const layer = anim.neon(), f = find(layer, front), h = find(layer, halo);
      for (const p of puddle) expect(layer).toContainEqual(p);
      if (f.kind === "poly" && f.alpha === 0.3) {
        expect(h).toMatchObject({ alpha: 0.3 });
        if (dimMs === 0) expect(c.neon).toBe(true);
        dimMs += dt;
      } else {
        expect(f).toMatchObject({ alpha: 1 });
        expect(h).toMatchObject({ alpha: 0.6 });
        if (dimMs > 0) {
          expect(c.neon).toBe(true);
          expect(dimMs).toBeGreaterThanOrEqual(NEON_STEP_MS);
          expect(dimMs).toBeLessThanOrEqual(NEON_STEP_MS + dt);
          flickers++;
          dimMs = 0;
        }
      }
    }
    expect(flickers).toBeGreaterThanOrEqual(10);
  });

  it("sin neón que titile la capa neon es la de siempre: carteles y malecón", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, lights: { ...scene.lights, flicker: null } }, createRng(3), { reducedMotion: false });
    expect(signsOf(anim.neon())).toEqual(scene.neon.signs);
    expect(lights(anim.neon()).map((d) => d.at)).toEqual(scene.neon.malecon);
  });

  it("con reduced-motion el neón de calle nunca titila", () => {
    const { anim } = setup(true);
    const f0 = anim.neon();
    for (let t = 0; t < 10000; t += 100) expect(anim.tick(100).neon).toBe(false);
    expect(anim.neon()).toEqual(f0);
  });

  it("mismo rng → mismas capas tras los mismos ticks", () => {
    const a = setup().anim, b = setup().anim;
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33, 100, 100]) {
      expect(a.tick(dt)).toEqual(b.tick(dt));
      expect(a.windows()).toEqual(b.windows());
      expect(a.neon()).toEqual(b.neon());
      expect(a.papers()).toEqual(b.papers());
    }
  });
});
