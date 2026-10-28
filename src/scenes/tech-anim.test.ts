import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { tech } from "./tech";
import { ALWAYS_LIT } from "./barrio";
import { CROWN_FLIP_GAP_MS, CROWN_PERIOD_MS, HOMES_GAP_MS, NEON_STEP_MS, RING_STEP_MS, SIGN_PERIOD_MS, SIGN_STEP_MS, TECH_BLINK_GAP_MS, createTechAnim } from "./tech-anim";

const setup = (reducedMotion = false) => { const scene = tech(createRng(7)); return { scene, anim: createTechAnim(scene, createRng(3), { reducedMotion }) }; };
const sinTorres = () => { const s = tech(createRng(7)); return { ...s, towers: [], neon: { ...s.neon, crowns: [] } }; };

describe("tech-anim", () => {
  it("frame 0: cada torre tiene un piso encendido (ventanas ámbar en sus caras visibles), carteles a alpha 1, luz de telecom", () => {
    const { scene, anim } = setup();
    const w = anim.windows();
    expect(w.length).toBeGreaterThanOrEqual(scene.towers.length);
    for (const a of w) expect(a).toMatchObject({ kind: "poly", color: "amber" });
    expect(anim.signs().every((a) => a.kind === "poly" && a.alpha === 1)).toBe(true);
    expect(anim.telecom()).toMatchObject({ kind: "dot", color: "amber" });
  });
  it("cada 4..9 s una torre cambia o apaga su piso; los carteles pulsan con período 3 s; la luz pulsa cada 100 ms", () => {
    const { anim } = setup();
    const before = JSON.stringify(anim.windows());
    let changed = false;
    for (let t = 0; t < TECH_BLINK_GAP_MS[1] + 100; t += 100) if (anim.tick(100).windows) changed = true;
    expect(changed).toBe(true);
    expect(JSON.stringify(anim.windows())).not.toBe(before);
    const s0 = anim.signs()[0]!;
    const a0 = s0.kind === "poly" ? s0.alpha : 1;
    anim.tick(SIGN_PERIOD_MS / 2);
    const s1 = anim.signs()[0]!;
    const a1 = s1.kind === "poly" ? s1.alpha : 1;
    expect(a1).not.toBe(a0);
    expect(anim.tick(SIGN_STEP_MS).signs).toBe(true);
    expect(anim.tick(100).telecom).toBe(true);
  });
  it("con reduced-motion no cambia nada", () => {
    const { anim } = setup(true);
    for (let i = 0; i < 100; i++) expect(anim.tick(100)).toEqual({ windows: false, signs: false, telecom: false, neon: false, homes: false });
  });
  it("neones frame 0: coronas a alpha 1 con sus colores iniciales y las tres luces del mástil", () => {
    const { scene, anim } = setup();
    const n = anim.neon(), crowns = n.slice(0, scene.towers.length), ring = n.slice(scene.towers.length);
    expect(crowns).toEqual(scene.neon.crowns);
    expect(ring).toEqual(scene.neon.mastRing.map((at) => ({ kind: "dot", at, r: 0.5, color: "magentaMid" })));
    for (const a of n) expect(["cyan", "cyanMid", "cyanBleed", "magenta", "magentaMid", "magentaBleed"]).toContain(a.color);
  });
  it("las coronas pulsan 0.45..1 en pasos de 150 ms y desfasadas; el anillo corre de a una luz cada 200 ms", () => {
    const { scene, anim } = setup();
    expect(anim.tick(NEON_STEP_MS).neon).toBe(true);
    expect(anim.tick(1).neon).toBe(false); // mismo paso de corona y de anillo
    anim.tick(CROWN_PERIOD_MS / 2 - NEON_STEP_MS - 1);
    const alphas = anim.neon().slice(0, scene.towers.length).map((a) => (a.kind === "poly" ? a.alpha! : 1));
    for (const a of alphas) { expect(a).toBeGreaterThanOrEqual(0.45); expect(a).toBeLessThanOrEqual(1); }
    expect(new Set(alphas).size).toBeGreaterThan(1);
    expect(Math.min(...alphas)).toBeCloseTo(0.45, 1);
    expect(anim.neon().slice(scene.towers.length)).toHaveLength(1);
  });
  it("cada 6..12 s una corona cambia cian ↔ magenta y se queda así", () => {
    const { scene, anim } = setup();
    const magentas = () => anim.neon().slice(0, scene.towers.length).filter((a) => a.color === "magenta").length;
    const m0 = magentas();
    let t = 0;
    while (magentas() === m0 && t <= CROWN_FLIP_GAP_MS[1] + 100) { anim.tick(100); t += 100; }
    expect(t).toBeGreaterThanOrEqual(CROWN_FLIP_GAP_MS[0] - 100);
    expect(t).toBeLessThanOrEqual(CROWN_FLIP_GAP_MS[1] + 100);
    const m1 = magentas();
    expect(Math.abs(m1 - m0)).toBe(1);
    for (let i = 0; i < CROWN_FLIP_GAP_MS[0] / 100 - 2; i++) { anim.tick(100); expect(magentas()).toBe(m1); }
  });
  it("con reduced-motion los neones quedan en el frame 0 aunque pase el tiempo", () => {
    const { scene, anim } = setup(true);
    for (let i = 0; i < 200; i++) anim.tick(100);
    expect(anim.neon()).toEqual([...scene.neon.crowns, ...scene.neon.mastRing.map((at) => ({ kind: "dot", at, r: 0.5, color: "magentaMid" }))]);
  });
  it("sin torres las ventanas quedan quietas pero carteles, telecom y anillo del mástil siguen", () => {
    const scene = sinTorres(), anim = createTechAnim(scene, createRng(3), { reducedMotion: false });
    expect(scene.signs.length).toBeGreaterThan(0);
    const seen = { windows: false, signs: false, telecom: false, neon: false, homes: false };
    for (let t = 0; t < TECH_BLINK_GAP_MS[1] + 1000; t += 100) {
      const c = anim.tick(100);
      for (const k of Object.keys(seen) as (keyof typeof seen)[]) if (c[k]) seen[k] = true;
    }
    expect(seen).toEqual({ windows: false, signs: true, telecom: true, neon: true, homes: true });
    expect(anim.windows()).toEqual([]);
    expect(anim.neon().every((a) => a.kind === "dot")).toBe(true);
  });
  it("sin coronas, neon solo se reporta cuando cambia el paso de corona o de anillo, nunca por el cambio de color", () => {
    const anim = createTechAnim(sinTorres(), createRng(3), { reducedMotion: false });
    for (let t = 1; t <= CROWN_FLIP_GAP_MS[1] + 1000; t++) {
      const paso = Math.floor(t / NEON_STEP_MS) !== Math.floor((t - 1) / NEON_STEP_MS) || Math.floor(t / RING_STEP_MS) !== Math.floor((t - 1) / RING_STEP_MS);
      expect(anim.tick(1).neon).toBe(paso);
    }
  });
});

describe("tech-anim: ventanas del barrio (#249)", () => {
  const key = (pts: { x: number; y: number; z: number }[]) => JSON.stringify(pts);
  const litKeys = (anim: ReturnType<typeof createTechAnim>) => new Set(anim.homes().map((a) => (a.kind === "poly" ? key(a.pts) : "")));
  it("frame 0: exactamente las HomeWindow encendidas de la escena, poly ámbar", () => {
    const { scene, anim } = setup();
    expect(scene.homes.length).toBeGreaterThan(0);
    expect(anim.homes()).toEqual(scene.homes.filter((h) => h.lit).map((h) => ({ kind: "poly", pts: h.pts, color: "amber", alpha: 1 })));
  });
  it("en HOMES_GAP_MS[1] + 100 ms algún grupo cambia; las ventanas de un grupo siempre comparten estado", () => {
    const { scene, anim } = setup();
    const groups = new Map<string, string[]>();
    for (const h of scene.homes) groups.set(h.group, [...(groups.get(h.group) ?? []), key(h.pts)]);
    let changed = false;
    for (let t = 0; t < HOMES_GAP_MS[1] + 100; t += 100) {
      if (anim.tick(100).homes) changed = true;
      const lit = litKeys(anim);
      for (const ks of groups.values()) expect(new Set(ks.map((k) => lit.has(k))).size).toBe(1);
    }
    expect(changed).toBe(true);
    expect(anim.fired().homes).toBeGreaterThanOrEqual(1);
  });
  it("troceado: un tick de 60 s dispara lo mismo que 600 ticks de 100 ms", () => {
    const a = setup().anim, b = setup().anim;
    a.tick(60000);
    for (let i = 0; i < 600; i++) b.tick(100);
    expect(a.fired().homes).toBeGreaterThan(0);
    expect(a.fired().homes).toBe(b.fired().homes);
    expect(a.homes()).toEqual(b.homes());
  });
  it("la escalera de la escuela y el gimnasio del club nunca se apagan", () => {
    const { scene, anim } = setup();
    const fixed = scene.homes.filter((h) => ALWAYS_LIT.has(h.group)).map((h) => key(h.pts));
    expect(fixed.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 1200; i++) { anim.tick(100); const lit = litKeys(anim); for (const k of fixed) expect(lit.has(k)).toBe(true); }
  });
  it("con reduced-motion o dt no válido no cambia nada", () => {
    const r = setup(true);
    const h0 = r.anim.homes();
    for (let i = 0; i < 100; i++) expect(r.anim.tick(100).homes).toBe(false);
    expect(r.anim.homes()).toEqual(h0);
    const { anim } = setup();
    const f0 = anim.homes();
    for (const dt of [NaN, Infinity, 0, -5]) expect(anim.tick(dt).homes).toBe(false);
    expect(anim.homes()).toEqual(f0);
    expect(anim.fired().homes).toBe(0);
  });
  it("sin homes la capa devuelve [] y nunca reporta cambios", () => {
    const anim = createTechAnim({ ...tech(createRng(7)), homes: [] }, createRng(3), { reducedMotion: false });
    expect(anim.homes()).toEqual([]);
    for (let i = 0; i < 600; i++) expect(anim.tick(100).homes).toBe(false);
  });
  it("las luces del barrio no mueven las ventanas de las torres ni los neones", () => {
    const s = tech(createRng(7));
    const a = createTechAnim(s, createRng(3), { reducedMotion: false }), b = createTechAnim({ ...s, homes: [] }, createRng(3), { reducedMotion: false });
    for (let i = 0; i < 300; i++) { a.tick(100); b.tick(100); }
    expect(a.windows()).toEqual(b.windows());
    expect(a.neon()).toEqual(b.neon());
  });
});
