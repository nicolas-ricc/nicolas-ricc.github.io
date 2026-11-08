import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { createRng } from "../map/seed";
import { WINDOW_ALPHA } from "../city/lights";
import { city, type CityScene } from "./city";
import { type CityAnim, ANTENNA_STEP_MS, BLINK_GAP_MS, FLICKER_ALPHA, FLICKER_GAP_MS, PROMENADE_STEP_MS, NEON_STEP_MS, PAPER_RANGE, PAPER_SIDE, PAPER_SPEED, SIGN_GAP_MS, WINDOW_GAP_MS, createCityAnim } from "./city-anim";

const setup = (reducedMotion = false) => {
  const scene = city(createRng(7), createRng(8), createRng(9));
  return { scene, tower: scene.tower, anim: createCityAnim(scene, createRng(3), { reducedMotion }) };
};
/** Removes the street neon accents from a `neon()` layer (it copies them with another alpha when flickering, but keeps `pts`). */
const withoutStreet = (scene: CityScene, a: Accent[]): Accent[] => {
  const pts = new Set(scene.lights.neons.flatMap((n) => n.accents.flatMap((x) => (x.kind === "poly" ? [x.pts] : []))));
  return a.filter((x) => x.kind !== "poly" || !pts.has(x.pts));
};
let chunkedScene: CityScene | undefined; // city() is expensive: a single scene for all the chunkings
const chunked = (dts: number[], seed = 3) => {
  const scene = (chunkedScene ??= city(createRng(7), createRng(8), createRng(9)));
  const anim = createCityAnim(scene, createRng(seed), { reducedMotion: false });
  for (const dt of dts) anim.tick(dt);
  return anim;
};
const repeat = (n: number, dt: number) => Array.from({ length: n }, () => dt);
type Kind<K> = Extract<Accent, { kind: K }>;
const lights = (a: Accent[]) => a.filter((x): x is Kind<"dot"> => x.kind === "dot");
const signsOf = (a: Accent[]) => a.filter((x): x is Kind<"poly"> => x.kind === "poly");
const dot = (a: Accent): Extract<Accent, { kind: "dot" }> => { if (a.kind !== "dot") throw new Error("expected dot"); return a; };

describe("city-anim", () => {
  it("frame 0: lit floor, papers staggered from the window, antenna at radius 1.1", () => {
    const { tower, anim } = setup();
    const w = tower.paperWindow;
    expect(anim.lit()).toEqual(tower.litWindows);
    expect(anim.papers().length).toBeGreaterThanOrEqual(5);
    expect(anim.papers().length).toBeLessThanOrEqual(8);
    // the trail starts at the window and stretches: one is exactly there and none passes PAPER_RANGE
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

  it("the floor goes off one tick at a time, never two in a row, and goes off at least 5 times in 60 s", () => {
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

  it("the papers never get farther than PAPER_RANGE from the window and drift to the NNE", () => {
    const { tower, anim } = setup();
    let driftedNNE = false;
    for (let t = 0; t < 20000; t += 33) {
      const c = anim.tick(33);
      expect(c.papers).toBe(true);
      for (const p of anim.papers()) {
        const d = dot(p);
        expect(Math.hypot(d.at.x - tower.paperWindow.x, d.at.y - tower.paperWindow.y)).toBeLessThanOrEqual(PAPER_RANGE + 2);
        expect(d.at.y).toBeLessThanOrEqual(tower.paperWindow.y + 2); // never goes down toward the south
        expect(d.r).toBeGreaterThanOrEqual(0.12 - 1e-6);
        expect(d.r).toBeLessThanOrEqual(0.4 + 1e-6);
        if (d.at.x > tower.paperWindow.x + 10 && d.at.y < tower.paperWindow.y - 10) driftedNNE = true;
      }
    }
    expect(driftedNNE).toBe(true);
  });

  it("the antenna pulses between 0.8 and 1.4 and reports a change only every ANTENNA_STEP_MS", () => {
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

  it("with reduced-motion nothing changes", () => {
    const { tower, anim } = setup(true);
    const before = JSON.stringify(anim.papers());
    for (let t = 0; t < 5000; t += 33) expect(anim.tick(33)).toEqual({ lit: false, papers: false, antenna: false, neon: false, windows: false });
    expect(anim.lit()).toEqual(tower.litWindows);
    expect(JSON.stringify(anim.papers())).toBe(before); // the trail stays frozen where it started
  });

  it("neon frame 0: signs in their initial color and all the lights of the promenade; only cyan/magenta", () => {
    const { scene, anim } = setup();
    const own = withoutStreet(scene, anim.neon());
    expect(signsOf(own)).toEqual(scene.neon.signs);
    expect(lights(own).map((d) => d.at)).toEqual(scene.neon.promenade);
    for (const d of lights(own)) { expect(d.color).toBe("cyanMid"); expect(d.r).toBe(0.35); }
    for (const x of own) expect(x.color).toMatch(/^(cyan|magenta)/);
  });

  it("neon with reduced-motion: tick does not report and the layer stays at frame 0", () => {
    const { anim } = setup(true);
    const f0 = anim.neon();
    expect(anim.tick(1000).neon).toBe(false);
    expect(anim.neon()).toEqual(f0);
  });

  it("the promenade runs: from step 1 there are exactly 2 lights on and they change per step", () => {
    const { anim } = setup();
    expect(anim.tick(PROMENADE_STEP_MS).neon).toBe(true);
    const a = lights(anim.neon());
    expect(a).toHaveLength(2);
    anim.tick(PROMENADE_STEP_MS);
    expect(lights(anim.neon())).toHaveLength(2);
    expect(lights(anim.neon())).not.toEqual(a);
  });

  it("signs: there are events; a color change persists and a blackout turns off a single sign", () => {
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

  it("a blackout lasts a whole step and the sign comes back with the same color", () => {
    const { scene, anim } = setup();
    const n = scene.neon.signs.length, dt = 10;
    let before = signsOf(withoutStreet(scene, anim.neon())), offMs = 0, blinks = 0;
    for (let t = 0; t < 120000; t += dt) {
      anim.tick(dt);
      const s = signsOf(withoutStreet(scene, anim.neon()));
      if (s.length === n - 1) offMs += dt;
      else if (offMs > 0) {
        blinks++;
        expect(offMs).toBeGreaterThanOrEqual(NEON_STEP_MS); // a whole step, not a frame
        expect(offMs).toBeLessThanOrEqual(NEON_STEP_MS + dt);
        expect(s).toEqual(before);
        offMs = 0;
      }
      if (s.length === n) before = s;
    }
    expect(blinks).toBeGreaterThan(0);
  });

  it("windows frame 0: the animatable lit ones from lights, with their color and alpha 0.85", () => {
    const { scene, anim } = setup();
    const want = scene.lights.windows.filter((w) => w.animable && w.on).map((w) => ({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA }));
    expect(want.length).toBeGreaterThan(0);
    expect(anim.windows()).toEqual(want);
  });

  it("windows: in 60 s they change ≥ 40 times, always within ±max(1, 5 %) of the target and only among the animatable ones", () => {
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

  it("windows: with no animatable ones the layer stays empty and never reports a change", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, lights: { ...scene.lights, windows: [] } }, createRng(3), { reducedMotion: false });
    expect(anim.windows()).toEqual([]);
    for (let t = 0; t < 10000; t += 100) expect(anim.tick(100).windows).toBe(false);
  });

  it("windows: with one or two animatable ones there is no exception and the count stays at target ± 1", () => {
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
      anim.tick(600000); // many events in one tick, each one within the band
      expect(Math.abs(anim.windows().length - target)).toBeLessThanOrEqual(1);
    }
  });

  it("windows with reduced-motion: they stay at frame 0 and tick does not report", () => {
    const { anim } = setup(true);
    const f0 = anim.windows();
    for (let t = 0; t < 5000; t += 100) expect(anim.tick(100).windows).toBe(false);
    expect(anim.windows()).toEqual(f0);
  });

  it("the chosen street neon is in the layer at frame 0 as is, and no other street neon", () => {
    const { scene, anim } = setup();
    const f = scene.lights.flicker!;
    expect(f).not.toBeNull();
    const layer = anim.neon();
    for (const a of scene.lights.neons[f]!.accents) expect(layer).toContainEqual(a);
    scene.lights.neons.forEach((n, i) => { if (i !== f) for (const a of n.accents) expect(layer.some((x) => x.kind === "poly" && a.kind === "poly" && x.pts === a.pts)).toBe(false); });
  });

  it("the neon flickers ≥ 10 times in 60 s: front and halo at 0.3 for exactly one step, the puddle unchanged, and it returns to its alpha", () => {
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

  it("with no neon to flicker the neon layer is the usual one: signs and promenade", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, lights: { ...scene.lights, flicker: null } }, createRng(3), { reducedMotion: false });
    expect(signsOf(anim.neon())).toEqual(scene.neon.signs);
    expect(lights(anim.neon()).map((d) => d.at)).toEqual(scene.neon.promenade);
  });

  it("with reduced-motion the street neon never flickers", () => {
    const { anim } = setup(true);
    const f0 = anim.neon();
    for (let t = 0; t < 10000; t += 100) expect(anim.tick(100).neon).toBe(false);
    expect(anim.neon()).toEqual(f0);
  });

  it("same rng → same layers after the same ticks", () => {
    const a = setup().anim, b = setup().anim;
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33, 100, 100]) {
      expect(a.tick(dt)).toEqual(b.tick(dt));
      expect(a.windows()).toEqual(b.windows());
      expect(a.neon()).toEqual(b.neon());
      expect(a.papers()).toEqual(b.papers());
    }
  });

  it("fired counts the floor blackouts and the sign events", () => {
    const { anim } = setup();
    expect(anim.fired()).toEqual({ lit: 0, neon: 0, papers: 0, windows: 0, flicker: 0 });
    let offs = 0;
    for (let t = 0; t < 60000; t += 33) { anim.tick(33); if (anim.lit().length === 0) offs++; }
    expect(anim.fired().lit).toBe(offs); // at 33 ms each firing is one tick off
    expect(anim.fired().neon).toBeGreaterThanOrEqual(60000 / 7000 - 1);
    expect(anim.fired().neon).toBeLessThanOrEqual(60000 / 3000);
  });

  it("fired counts nothing with reduced-motion, with dt <= 0 or with a non-finite dt", () => {
    const still = setup(true).anim;
    still.tick(60000);
    expect(still.fired()).toEqual({ lit: 0, neon: 0, papers: 0, windows: 0, flicker: 0 });
    const { anim } = setup();
    anim.tick(0); anim.tick(-5000);
    expect(anim.fired()).toEqual({ lit: 0, neon: 0, papers: 0, windows: 0, flicker: 0 });
    // without the guard, an infinite dt would never end the while (the lab already discards it in speedFromSearch)
    expect(anim.tick(Infinity)).toEqual({ lit: false, papers: false, antenna: false, neon: false, windows: false });
    expect(anim.tick(NaN)).toEqual({ lit: false, papers: false, antenna: false, neon: false, windows: false });
    expect(anim.fired()).toEqual({ lit: 0, neon: 0, papers: 0, windows: 0, flicker: 0 });
  });

  it("blink: tick(7000) and seven tick(1000) fire the same, and so do 60 s in one or in 60", () => {
    expect(chunked([7000]).fired().lit).toBe(chunked(repeat(7, 1000)).fired().lit);
    expect(chunked([60000]).fired().lit).toBe(chunked(repeat(60, 1000)).fired().lit);
    expect(chunked([60000]).fired().lit).toBe(chunked(repeat(60000 / 25, 25)).fired().lit);
  });

  it("blink: one 10 min tick fires many blackouts, like 600 of 1 s", () => {
    const long = chunked([600000]).fired().lit;
    expect(long).toBeGreaterThanOrEqual(600000 / BLINK_GAP_MS[1] - 1);
    expect(long).toBeLessThanOrEqual(600000 / BLINK_GAP_MS[0]);
    expect(long).toBe(chunked(repeat(600, 1000)).fired().lit);
  });

  it("blink: after a long tick that turns the floor off, the next short tick turns it on", () => {
    const { tower, anim } = setup();
    anim.tick(BLINK_GAP_MS[1]); // the first pause surely expires within this tick
    expect(anim.lit()).toEqual([]);
    anim.tick(33);
    expect(anim.lit()).toEqual(tower.litWindows);
  });

  it("tick(7000) and seven tick(1000) with the same seed leave the same floor and neon counters", () => {
    // in 7 s each timer fires at most once (pauses ≥ 4000 and ≥ 3000 ms), so this case
    // also gave the same result with the old reset; the 60 s and 10 min ones are what tell them apart
    for (let seed = 0; seed < 50; seed++) expect(chunked([7000], seed).fired()).toEqual(chunked(repeat(7, 1000), seed).fired());
  });

  it("signs: 60 s or 10 min at once fire the same as chunked", () => {
    expect(chunked([60000]).fired().neon).toBe(chunked(repeat(60, 1000)).fired().neon);
    const long = chunked([600000]).fired().neon;
    expect(long).toBeGreaterThanOrEqual(600000 / SIGN_GAP_MS[1] - 1);
    expect(long).toBeLessThanOrEqual(600000 / SIGN_GAP_MS[0]);
    expect(long).toBe(chunked(repeat(600, 1000)).fired().neon);
  });

  it("an irregular chunking leaves the same counters and colors as its sum in one tick", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33];
    const a = chunked(dts), b = chunked([dts.reduce((s, x) => s + x, 0)]);
    expect(a.fired()).toEqual(b.fired());
    expect(signsOf(a.neon()).map((s) => s.color)).toEqual(signsOf(b.neon()).map((s) => s.color));
  });

  it("with no signs a long tick does not hang and counts no events", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, neon: { ...scene.neon, signs: [] } }, createRng(3), { reducedMotion: false });
    anim.tick(600000);
    expect(anim.fired().neon).toBe(0);
  });
});

describe("city-anim: papers with wall time (#124, #125)", () => {
  const same = (a: CityAnim, b: CityAnim) => {
    expect(a.fired()).toEqual(b.fired());
    const pa = a.papers().map(dot), pb = b.papers().map(dot);
    expect(pa).toHaveLength(pb.length);
    pa.forEach((p, i) => {
      const q = pb[i]!;
      expect(p.at.x).toBeCloseTo(q.at.x, 6); expect(p.at.y).toBeCloseTo(q.at.y, 6); expect(p.at.z).toBeCloseTo(q.at.z, 6);
      expect(p.r).toBeCloseTo(q.r, 6);
    });
  };
  it("papers: one 60 s tick leaves the papers where 600 of 100 ms do", () => {
    const a = chunked([60000]), b = chunked(repeat(600, 100));
    expect(a.fired().papers).toBeGreaterThan(0);
    same(a, b);
  });
  it("papers: an irregular chunking and its sum leave the same", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 20000];
    same(chunked(dts), chunked([dts.reduce((s, x) => s + x, 0)]));
  });
  it("papers: after 10 min at once they are still within the path", () => {
    const { tower } = setup(), w = tower.paperWindow;
    const anim = chunked([600000]), n = anim.papers().length;
    expect(anim.fired().papers).toBeGreaterThanOrEqual(n * 600000 / (PAPER_RANGE / (PAPER_SPEED * 0.8)) - n); // minimum speed: each paper recycles at least once every PAPER_RANGE / (PAPER_SPEED · 0.8) ms
    for (const p of anim.papers().map(dot)) expect(Math.hypot(p.at.x - w.x, p.at.y - w.y)).toBeLessThanOrEqual(PAPER_RANGE + PAPER_SIDE);
  });
});

describe("city-anim: windows and street neon with wall time (#192)", () => {
  const irregular = (total: number) => { // irregular chunks that add up to `total`
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 2571];
    const out: number[] = [];
    for (let left = total, i = 0; left > 0; i++) { const dt = Math.min(left, dts[i % dts.length]!); out.push(dt); left -= dt; }
    return out;
  };
  const frontOf = (scene: CityScene, layer: Accent[]) => {
    const front = scene.lights.neons[scene.lights.flicker!]!.accents[1]!;
    return layer.find((x) => x.kind === "poly" && front.kind === "poly" && x.pts === front.pts)!;
  };

  it("windows: 60 s and 10 min at once fire the same as chunked into 1000 ms, 100 ms and irregularly", () => {
    for (const total of [60000, 600000]) {
      const once = chunked([total]).fired().windows;
      expect(once).toBeGreaterThanOrEqual(total / WINDOW_GAP_MS[1] - 1);
      expect(chunked(repeat(total / 1000, 1000)).fired().windows).toBe(once);
      expect(chunked(repeat(total / 100, 100)).fired().windows).toBe(once);
      expect(chunked(irregular(total)).fired().windows).toBe(once);
    }
  });

  it("windows: with 50 seeds, windows() after [7000] equals after 7 × 1000 ms", () => {
    for (let seed = 0; seed < 50; seed++) expect(chunked([7000], seed).windows()).toEqual(chunked(repeat(7, 1000), seed).windows());
  });

  it("windows: after 10 min the lit count stays within target ± tol, at once and chunked", () => {
    const anim = chunked([0]); // builds the shared scene
    const animable = chunkedScene!.lights.windows.filter((w) => w.animable);
    const target = animable.filter((w) => w.on).length, tol = Math.max(1, Math.round(0.05 * animable.length));
    expect(anim.windows()).toHaveLength(target);
    for (const a of [chunked([600000]), chunked(repeat(6000, 100))]) expect(Math.abs(a.windows().length - target)).toBeLessThanOrEqual(tol);
  });

  it("windows: a long tick with no animatable windows does not hang and counts nothing", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, lights: { ...scene.lights, windows: [] } }, createRng(3), { reducedMotion: false });
    expect(anim.tick(600000).windows).toBe(false);
    expect(anim.fired().windows).toBe(0);
  });

  it("flicker: 60 s and 10 min at once fire the same as chunked into 1000 ms, 100 ms and irregularly", () => {
    for (const total of [60000, 600000]) {
      const once = chunked([total]).fired().flicker;
      expect(once).toBeGreaterThanOrEqual(total / FLICKER_GAP_MS[1] - 1);
      expect(once).toBeLessThanOrEqual(total / FLICKER_GAP_MS[0]);
      expect(chunked(repeat(total / 1000, 1000)).fired().flicker).toBe(once);
      expect(chunked(repeat(total / 100, 100)).fired().flicker).toBe(once);
      expect(chunked(irregular(total)).fired().flicker).toBe(once);
    }
  });

  it("flicker: a long tick with no street neon does not hang and counts nothing", () => {
    const scene = city(createRng(7), createRng(8), createRng(9));
    const anim = createCityAnim({ ...scene, lights: { ...scene.lights, flicker: null } }, createRng(3), { reducedMotion: false });
    anim.tick(600000);
    expect(anim.fired().flicker).toBe(0);
  });

  it("flicker: after a long tick that fires, the street neon is dim, and one NEON_STEP_MS later it is back", () => {
    let restored = 0;
    for (let seed = 0; seed < 20; seed++) {
      const anim = chunked([FLICKER_GAP_MS[1]], seed); // the first pause surely runs out within this tick
      expect(anim.fired().flicker).toBeGreaterThan(0);
      expect(frontOf(chunkedScene!, anim.neon())).toMatchObject({ alpha: FLICKER_ALPHA });
      const n = anim.fired().flicker;
      expect(anim.tick(NEON_STEP_MS).neon).toBe(true);
      if (anim.fired().flicker === n) { expect(frontOf(chunkedScene!, anim.neon())).toMatchObject({ alpha: 1 }); restored++; }
    }
    expect(restored).toBeGreaterThan(0);
  });
});
