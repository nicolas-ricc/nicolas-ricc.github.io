import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { tech } from "./tech";
import { CROWN_FLIP_GAP_MS, CROWN_PERIOD_MS, NEON_STEP_MS, SIGN_PERIOD_MS, SIGN_STEP_MS, TECH_BLINK_GAP_MS, createTechAnim } from "./tech-anim";

const setup = (reducedMotion = false) => { const scene = tech(createRng(7)); return { scene, anim: createTechAnim(scene, createRng(3), { reducedMotion }) }; };

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
    for (let i = 0; i < 100; i++) expect(anim.tick(100)).toEqual({ windows: false, signs: false, telecom: false, neon: false });
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
});
