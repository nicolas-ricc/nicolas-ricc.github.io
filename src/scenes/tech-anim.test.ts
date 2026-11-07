import { describe, expect, it } from "vitest";
import { fingerprint } from "../iso/fingerprint";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { tech } from "./tech";
import { ALWAYS_LIT } from "./neighborhood";
import { CROWN_FLIP_GAP_MS, CROWN_PERIOD_MS, HOMES_GAP_MS, NEON_STEP_MS, RING_STEP_MS, SIGN_PERIOD_MS, SIGN_STEP_MS, TECH_BLINK_GAP_MS, createTechAnim } from "./tech-anim";

const setup = (reducedMotion = false) => { const scene = tech(createRng(7)); return { scene, anim: createTechAnim(scene, createRng(3), { reducedMotion }) }; };
/** The scene with `tone` set on every tower box. */
const withTone = (tone: number) => { const s = tech(createRng(7)); return { ...s, towers: s.towers.map((t) => ({ ...t, box: { ...t.box, tone } })) }; };
const withoutTowers = () => { const s = tech(createRng(7)); return { ...s, towers: [], neon: { ...s.neon, crowns: [] } }; };

describe("tech-anim", () => {
  it("frame 0: each tower has a lit floor (amber windows on its visible faces), signs at alpha 1, telecom light", () => {
    const { scene, anim } = setup();
    const w = anim.windows();
    expect(w.length).toBeGreaterThanOrEqual(scene.towers.length);
    for (const a of w) expect(a).toMatchObject({ kind: "poly", color: "amber" });
    expect(anim.signs().every((a) => a.kind === "poly" && a.alpha === 1)).toBe(true);
    expect(anim.telecom()).toMatchObject({ kind: "dot", color: "amber" });
  });
  it("every 4..9 s a tower changes or turns off its floor; the signs pulse with a 3 s period; the light pulses every 100 ms", () => {
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
  it("with reduced-motion nothing changes", () => {
    const { anim } = setup(true);
    for (let i = 0; i < 100; i++) expect(anim.tick(100)).toEqual({ windows: false, signs: false, telecom: false, neon: false, homes: false });
  });
  it("neons frame 0: crowns at alpha 1 with their initial colors and the three lights of the mast", () => {
    const { scene, anim } = setup();
    const n = anim.neon(), crowns = n.slice(0, scene.towers.length), ring = n.slice(scene.towers.length);
    expect(crowns).toEqual(scene.neon.crowns);
    expect(ring).toEqual(scene.neon.mastRing.map((at) => ({ kind: "dot", at, r: 0.5, color: "magentaMid" })));
    for (const a of n) expect(["cyan", "cyanMid", "cyanBleed", "magenta", "magentaMid", "magentaBleed"]).toContain(a.color);
  });
  it("the crowns pulse 0.45..1 in steps of 150 ms and out of phase; the ring runs one light at a time every 200 ms", () => {
    const { scene, anim } = setup();
    expect(anim.tick(NEON_STEP_MS).neon).toBe(true);
    expect(anim.tick(1).neon).toBe(false); // same crown step and ring step
    anim.tick(CROWN_PERIOD_MS / 2 - NEON_STEP_MS - 1);
    const alphas = anim.neon().slice(0, scene.towers.length).map((a) => (a.kind === "poly" ? a.alpha! : 1));
    for (const a of alphas) { expect(a).toBeGreaterThanOrEqual(0.45); expect(a).toBeLessThanOrEqual(1); }
    expect(new Set(alphas).size).toBeGreaterThan(1);
    expect(Math.min(...alphas)).toBeCloseTo(0.45, 1);
    expect(anim.neon().slice(scene.towers.length)).toHaveLength(1);
  });
  it("every 6..12 s a crown swaps cyan ↔ magenta and stays that way", () => {
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
  it("with reduced-motion the neons stay at frame 0 as time passes", () => {
    const { scene, anim } = setup(true);
    for (let i = 0; i < 200; i++) anim.tick(100);
    expect(anim.neon()).toEqual([...scene.neon.crowns, ...scene.neon.mastRing.map((at) => ({ kind: "dot", at, r: 0.5, color: "magentaMid" }))]);
  });
  it("with no towers the windows stay still but signs, telecom and the mast ring go on", () => {
    const scene = withoutTowers(), anim = createTechAnim(scene, createRng(3), { reducedMotion: false });
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
  it("with no crowns, neon is reported only when the crown step or the ring step changes, never by the color swap", () => {
    const anim = createTechAnim(withoutTowers(), createRng(3), { reducedMotion: false });
    for (let t = 1; t <= CROWN_FLIP_GAP_MS[1] + 1000; t++) {
      const stepped = Math.floor(t / NEON_STEP_MS) !== Math.floor((t - 1) / NEON_STEP_MS) || Math.floor(t / RING_STEP_MS) !== Math.floor((t - 1) / RING_STEP_MS);
      expect(anim.tick(1).neon).toBe(stepped);
    }
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
    for (let i = 0; i < 1200; i++) { anim.tick(100); const lit = litKeys(anim); for (const k of fixed) expect(lit.has(k)).toBe(true); }
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
    expect(anim.fired()).toEqual({ homes: 0, windows: 0, crowns: 0 });
  });
  it("with no homes the layer returns [] and never reports changes", () => {
    const anim = createTechAnim({ ...tech(createRng(7)), homes: [] }, createRng(3), { reducedMotion: false });
    expect(anim.homes()).toEqual([]);
    for (let i = 0; i < 600; i++) expect(anim.tick(100).homes).toBe(false);
  });
  it("the neighborhood lights do not move the tower windows or the neons", () => {
    const s = tech(createRng(7));
    const a = createTechAnim(s, createRng(3), { reducedMotion: false }), b = createTechAnim({ ...s, homes: [] }, createRng(3), { reducedMotion: false });
    for (let i = 0; i < 300; i++) { a.tick(100); b.tick(100); }
    expect(a.windows()).toEqual(b.windows());
    expect(a.neon()).toEqual(b.neon());
  });
});

describe("tech-anim: chunking (#125)", () => {
  const chunked = (dts: number[], scene = tech(createRng(7))) => {
    const anim = createTechAnim(scene, createRng(3), { reducedMotion: false });
    for (const dt of dts) anim.tick(dt);
    return anim;
  };
  const repeat = (n: number, dt: number) => Array.from({ length: n }, () => dt);
  const same = (a: ReturnType<typeof createTechAnim>, b: ReturnType<typeof createTechAnim>) => {
    expect(a.fired()).toEqual(b.fired());
    expect(a.windows()).toEqual(b.windows());
    expect(a.neon()).toEqual(b.neon());
  };
  it("one 60 s tick leaves the same as 600 ticks of 100 ms", () => {
    const a = chunked([60000]), b = chunked(repeat(600, 100));
    expect(a.fired().windows).toBeGreaterThanOrEqual(60000 / TECH_BLINK_GAP_MS[1] - 1);
    expect(a.fired().crowns).toBeGreaterThanOrEqual(60000 / CROWN_FLIP_GAP_MS[1] - 1);
    same(a, b);
  });
  it("one 10 min tick fires like 600 of 1 s", () => {
    const a = chunked([600000]), b = chunked(repeat(600, 1000));
    expect(a.fired().windows).toBeGreaterThanOrEqual(600000 / TECH_BLINK_GAP_MS[1] - 1);
    expect(a.fired().windows).toBeLessThanOrEqual(600000 / TECH_BLINK_GAP_MS[0]);
    same(a, b);
  });
  it("an irregular chunking leaves the same as its sum", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 12000];
    same(chunked(dts), chunked([dts.reduce((s, x) => s + x, 0)]));
  });
  it("with no towers or crowns a long tick does not hang and does not count", () => {
    const anim = chunked([600000], withoutTowers());
    expect(anim.fired().windows).toBe(0);
    expect(anim.fired().crowns).toBe(0);
  });
});

describe("tech-anim: raw walls whatever the tone (#52)", () => {
  it("tone −1, 0 and 1 on the towers give the same windows, at frame 0 and after the blink", () => {
    const make = (tone: number) => createTechAnim(withTone(tone), createRng(3), { reducedMotion: false });
    const flat = make(0);
    const others = [-1, 1].map(make);
    expect(flat.windows()).toHaveLength(374);
    for (const a of others) expect(a.windows()).toEqual(flat.windows());
    for (let i = 0; i < 100; i++) for (const a of [flat, ...others]) a.tick(100);
    for (const a of others) expect(a.windows()).toEqual(flat.windows());
  });
  it("windows at frame 0 unchanged from main", () => {
    expect(fingerprint(setup().anim.windows() as unknown as Solid[])).toBe("b5014007");
  });
});
