import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { tech } from "./tech";
import { ALWAYS_LIT } from "./neighborhood";
import { HOMES_GAP_MS, SIGN_PERIOD_MS, SIGN_STEP_MS, createTechAnim } from "./tech-anim";

const setup = (reducedMotion = false) => { const scene = tech(createRng(7)); return { scene, anim: createTechAnim(scene, createRng(3), { reducedMotion }) }; };

describe("tech-anim", () => {
  it("frame 0: the signs are at alpha 1", () => {
    const { scene, anim } = setup();
    expect(scene.signs.length).toBeGreaterThan(0);
    expect(anim.signs().every((a) => a.kind === "poly" && a.alpha === 1)).toBe(true);
  });
  it("the signs pulse with a 3 s period, reported every 150 ms", () => {
    const { anim } = setup();
    const s0 = anim.signs()[0]!;
    const a0 = s0.kind === "poly" ? s0.alpha : 1;
    anim.tick(SIGN_PERIOD_MS / 2);
    const s1 = anim.signs()[0]!;
    const a1 = s1.kind === "poly" ? s1.alpha : 1;
    expect(a1).not.toBe(a0);
    expect(anim.tick(SIGN_STEP_MS).signs).toBe(true);
  });
  it("with reduced-motion nothing changes", () => {
    const { anim } = setup(true);
    for (let i = 0; i < 100; i++) expect(anim.tick(100)).toEqual({ signs: false, homes: false });
  });
});

describe("tech-anim: neighborhood windows (#249)", () => {
  const key = (pts: { x: number; y: number; z: number }[]) => JSON.stringify(pts);
  const litKeys = (anim: ReturnType<typeof createTechAnim>) => new Set(anim.homes().map((a) => (a.kind === "poly" ? key(a.pts) : "")));
  it("frame 0: exactly the lit HomeWindow of the scene, amber poly", () => {
    const { scene, anim } = setup();
    expect(scene.homes.length).toBeGreaterThan(0);
    expect(anim.homes()).toEqual(scene.homes.filter((h) => h.lit).map((h) => ({ kind: "poly", pts: h.pts, color: "amber", alpha: 1 })));
  });
  it("within HOMES_GAP_MS[1] + 100 ms some group changes; the windows of a group always share state", () => {
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
  it("chunking: one 60 s tick fires the same as 600 ticks of 100 ms", () => {
    const a = setup().anim, b = setup().anim;
    a.tick(60000);
    for (let i = 0; i < 600; i++) b.tick(100);
    expect(a.fired().homes).toBeGreaterThan(0);
    expect(a.fired().homes).toBe(b.fired().homes);
    expect(a.homes()).toEqual(b.homes());
  });
  it("the school staircase and the club gym never turn off", () => {
    const { scene, anim } = setup();
    const fixed = scene.homes.filter((h) => ALWAYS_LIT.has(h.group)).map((h) => key(h.pts));
    expect(fixed.length).toBeGreaterThanOrEqual(2);
    // the lit set only changes on a tick that reports `homes` (#496: recomputing it every tick made the test slow with the strip's windows)
    for (const k of fixed) expect(litKeys(anim).has(k)).toBe(true);
    for (let i = 0; i < 1200; i++) { if (!anim.tick(100).homes) continue; const lit = litKeys(anim); for (const k of fixed) expect(lit.has(k)).toBe(true); }
  }, 10_000);
  it("with reduced-motion or an invalid dt nothing changes", () => {
    const r = setup(true);
    const h0 = r.anim.homes();
    for (let i = 0; i < 100; i++) expect(r.anim.tick(100).homes).toBe(false);
    expect(r.anim.homes()).toEqual(h0);
    const { anim } = setup();
    const f0 = anim.homes();
    for (const dt of [NaN, Infinity, 0, -5]) expect(anim.tick(dt).homes).toBe(false);
    expect(anim.homes()).toEqual(f0);
    expect(anim.fired()).toEqual({ homes: 0 });
  });
  it("with no homes the layer returns [] and never reports changes", () => {
    const anim = createTechAnim({ ...tech(createRng(7)), homes: [] }, createRng(3), { reducedMotion: false });
    expect(anim.homes()).toEqual([]);
    for (let i = 0; i < 600; i++) expect(anim.tick(100).homes).toBe(false);
  });
});

describe("tech-anim: chunking (#125)", () => {
  const chunked = (dts: number[]) => {
    const anim = createTechAnim(tech(createRng(7)), createRng(3), { reducedMotion: false });
    for (const dt of dts) anim.tick(dt);
    return anim;
  };
  const repeat = (n: number, dt: number) => Array.from({ length: n }, () => dt);
  const same = (a: ReturnType<typeof createTechAnim>, b: ReturnType<typeof createTechAnim>) => {
    expect(a.fired()).toEqual(b.fired());
    expect(a.homes()).toEqual(b.homes());
  };
  it("one 60 s tick leaves the same as 600 ticks of 100 ms", () => same(chunked([60000]), chunked(repeat(600, 100))));
  it("one 10 min tick fires like 600 of 1 s", () => {
    const a = chunked([600000]), b = chunked(repeat(600, 1000));
    expect(a.fired().homes).toBeGreaterThanOrEqual(600000 / HOMES_GAP_MS[1] - 1);
    expect(a.fired().homes).toBeLessThanOrEqual(600000 / HOMES_GAP_MS[0]);
    same(a, b);
  });
  it("an irregular chunking leaves the same as its sum", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 12000];
    same(chunked(dts), chunked([dts.reduce((s, x) => s + x, 0)]));
  });
});

describe("tech-anim without the west (#479)", () => {
  it("techAnimator exposes only tech.signs and tech.homes", async () => {
    const { techAnimator } = await import("./tech-animator");
    const a = techAnimator(tech(createRng(7)), createRng(1), { reducedMotion: false });
    expect([...a.ids].sort()).toEqual(["tech.homes", "tech.signs"]);
  });
});
