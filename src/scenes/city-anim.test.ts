import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { createRng } from "../map/seed";
import { WINDOW_ALPHA } from "../city/lights";
import { city, type CityScene } from "./city";
import { HOTEL_SLAB } from "./sign-hotel";
import { type CityAnim, BLINK_GAP_MS, PAPER_DRIFT, ROOMS_BAND, FLICKER_ALPHA, FLICKER_GAP_MS, PROMENADE_STEP_MS, NEON_STEP_MS, PAPER_RANGE, PAPER_SIDE, PAPER_SPEED, SIGN_GAP_MS, WINDOW_GAP_MS, createCityAnim } from "./city-anim";

/** Sign accents injected by hand: since #472 the city makes no district signs (the modern belt lies west of the city edge), but city-anim still animates `neon.signs`. */
const SIGNS: Accent[] = [["cyan", 0], ["magenta", 10], ["cyan", 20], ["magenta", 30], ["cyan", 40], ["magenta", 50]].map(([color, x]) => ({
  kind: "poly", color: color as string, alpha: 1,
  pts: [{ x: x as number, y: 0, z: 2 }, { x: (x as number) + 4, y: 0, z: 2 }, { x: (x as number) + 4, y: 0, z: 3.6 }, { x: x as number, y: 0, z: 3.6 }],
} as Accent));
const withSigns = (scene: CityScene): CityScene => ({ ...scene, neon: { ...scene.neon, signs: SIGNS } });
const setup = (reducedMotion = false) => {
  const scene = withSigns(city(createRng(7), createRng(8), createRng(9)));
  return { scene, hotel: scene.hotel, anim: createCityAnim(scene, createRng(3), { reducedMotion }) };
};
/** Removes the street neon accents from a `neon()` layer (it copies them with another alpha when flickering, but keeps `pts`). */
const withoutStreet = (scene: CityScene, a: Accent[]): Accent[] => {
  const pts = new Set(scene.lights.neons.flatMap((n) => n.accents.flatMap((x) => (x.kind === "poly" ? [x.pts] : []))));
  return a.filter((x) => x.kind !== "poly" || !pts.has(x.pts));
};
let chunkedScene: CityScene | undefined; // city() is expensive: a single scene for all the chunkings
const chunked = (dts: number[], seed = 3) => {
  const scene = (chunkedScene ??= withSigns(city(createRng(7), createRng(8), createRng(9))));
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
  it("frame 0: some rooms lit, papers staggered from the window", () => {
    const { hotel, anim } = setup();
    const w = hotel.paperWindow;
    expect(anim.lit().length).toBeGreaterThan(0);
    expect(anim.lit().length).toBeLessThan(hotel.rooms.length);
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
  });

  it("one room toggles at a time, and at least 5 toggles happen in 60 s", () => {
    const { anim } = setup();
    const roomKey = (x: Accent) => (x.kind === "poly" ? JSON.stringify(x.pts) : "");
    let toggles = 0, prev = new Set(anim.lit().map(roomKey));
    for (let t = 0; t < 60000; t += 33) {
      anim.tick(33);
      const now = new Set(anim.lit().map(roomKey));
      const diff = [...now].filter((k) => !prev.has(k)).length + [...prev].filter((k) => !now.has(k)).length;
      expect(diff).toBeLessThanOrEqual(1);
      toggles += diff;
      prev = now;
    }
    expect(toggles).toBeGreaterThanOrEqual(5);
    expect(toggles).toBeLessThanOrEqual(16);
  });

  it("the papers never get farther than PAPER_RANGE from the window and drift along PAPER_DRIFT", () => {
    const { hotel, anim } = setup();
    let drifted = false;
    for (let t = 0; t < 20000; t += 33) {
      const c = anim.tick(33);
      expect(c.papers).toBe(true);
      for (const p of anim.papers()) {
        const d = dot(p);
        expect(Math.hypot(d.at.x - hotel.paperWindow.x, d.at.y - hotel.paperWindow.y)).toBeLessThanOrEqual(PAPER_RANGE + 2);
        expect(d.at.y).toBeLessThanOrEqual(hotel.paperWindow.y + 2); // never goes down toward the south
        expect(d.r).toBeGreaterThanOrEqual(0.12 - 1e-6);
        expect(d.r).toBeLessThanOrEqual(0.4 + 1e-6);
        if (d.at.x > hotel.paperWindow.x + 10 && d.at.y < hotel.paperWindow.y - 5) drifted = true;
      }
    }
    expect(drifted).toBe(true);
  });

  it("with reduced-motion nothing changes", () => {
    const { anim } = setup(true);
    const before = JSON.stringify(anim.papers()), rooms = JSON.stringify(anim.lit());
    for (let t = 0; t < 5000; t += 33) expect(anim.tick(33)).toEqual({ lit: false, papers: false, neon: false, windows: false });
    expect(JSON.stringify(anim.lit())).toBe(rooms);
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

  it("fired counts the room toggles and the sign events", () => {
    const { anim } = setup();
    expect(anim.fired()).toEqual({ lit: 0, neon: 0, papers: 0, windows: 0, flicker: 0 });
    let toggles = 0, prev = anim.lit().length;
    for (let t = 0; t < 60000; t += 33) { anim.tick(33); const n = anim.lit().length; toggles += Math.abs(n - prev); prev = n; }
    expect(anim.fired().lit).toBe(toggles); // at 33 ms each firing is one toggle, and a toggle moves the lit count by one
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
    expect(anim.tick(Infinity)).toEqual({ lit: false, papers: false, neon: false, windows: false });
    expect(anim.tick(NaN)).toEqual({ lit: false, papers: false, neon: false, windows: false });
    expect(anim.fired()).toEqual({ lit: 0, neon: 0, papers: 0, windows: 0, flicker: 0 });
  });

  it("blink: tick(7000) and seven tick(1000) toggle the same, and so do 60 s in one or in 60", () => {
    expect(chunked([7000]).fired().lit).toBe(chunked(repeat(7, 1000)).fired().lit);
    expect(chunked([60000]).fired().lit).toBe(chunked(repeat(60, 1000)).fired().lit);
    expect(chunked([60000]).fired().lit).toBe(chunked(repeat(60000 / 25, 25)).fired().lit);
  });

  it("blink: one 10 min tick toggles many rooms, like 600 of 1 s", () => {
    const long = chunked([600000]).fired().lit;
    expect(long).toBeGreaterThanOrEqual(600000 / BLINK_GAP_MS[1] - 1);
    expect(long).toBeLessThanOrEqual(600000 / BLINK_GAP_MS[0]);
    expect(long).toBe(chunked(repeat(600, 1000)).fired().lit);
  });

  it("blink: a long tick and the same time in short ticks leave the same lit rooms", () => {
    const rooms = (a: CityAnim) => JSON.stringify(a.lit());
    for (const seed of [1, 2, 3]) {
      expect(rooms(chunked([BLINK_GAP_MS[1]], seed))).toBe(rooms(chunked(repeat(BLINK_GAP_MS[1] / 100, 100), seed)));
      expect(rooms(chunked([600000], seed))).toBe(rooms(chunked(repeat(600, 1000), seed)));
    }
  });

  it("blink: after 10 min the lit-room count is within ROOMS_BAND of the initial one", () => {
    for (const seed of [1, 2, 3]) expect(Math.abs(chunked([600000], seed).lit().length - chunked([], seed).lit().length)).toBeLessThanOrEqual(ROOMS_BAND);
  });

  it("tick(7000) and seven tick(1000) with the same seed leave the same room and neon counters", () => {
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
    const w = setup().hotel.paperWindow;
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
      expect(once).toBeLessThanOrEqual(total / WINDOW_GAP_MS[0]);
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

describe("city-anim: the hotel rooms and the papers along the facade (#474)", () => {
  const build = (reducedMotion = false) => { const scene = withSigns(city(createRng(7), createRng(8), createRng(9))); return { scene, anim: createCityAnim(scene, createRng(3), { reducedMotion }) }; };
  const key = (a: Accent) => (a.kind === "poly" ? JSON.stringify(a.pts) : "");
  const R2 = Math.SQRT1_2, C = HOTEL_SLAB.center;
  /** Inside `slabFootprint()` grown by 0.5: |t| ≤ half + 0.5 along U and |n| ≤ thick/2 + 0.5 along N. */
  const inSlab = (p: { x: number; y: number; z: number }) => {
    const t = (p.x - C.x) * R2 - (p.y - C.y) * R2, n = (p.x - C.x) * R2 + (p.y - C.y) * R2;
    return Math.abs(t) <= HOTEL_SLAB.half + 0.5 && Math.abs(n) <= HOTEL_SLAB.thick / 2 + 0.5 && p.z < HOTEL_SLAB.z1;
  };

  it("frame 0 shows the initial lit rooms: a subset of scene.hotel.rooms, about 40 % of them", () => {
    const { scene, anim } = build(), rooms = new Set(scene.hotel.rooms.map(key)), lit = anim.lit();
    expect(lit.length).toBeGreaterThan(0);
    for (const a of lit) expect(rooms.has(key(a))).toBe(true);
    expect(lit.length / scene.hotel.rooms.length).toBeGreaterThan(0.25);
    expect(lit.length / scene.hotel.rooms.length).toBeLessThan(0.55);
  });

  it("in 60 s at least 5 rooms change and the lit set stays within ±5 rooms of the initial one", () => {
    const { anim } = build(), n0 = anim.lit().length;
    let changes = 0, prev = new Set(anim.lit().map(key));
    for (let t = 0; t < 60000; t += 100) {
      anim.tick(100);
      const now = new Set(anim.lit().map(key));
      changes += [...now].filter((k) => !prev.has(k)).length + [...prev].filter((k) => !now.has(k)).length;
      expect(Math.abs(now.size - n0)).toBeLessThanOrEqual(5);
      prev = now;
    }
    expect(changes).toBeGreaterThanOrEqual(5);
    expect(anim.fired().lit).toBeGreaterThanOrEqual(5);
  });

  it("with reduced-motion the rooms do not change", () => {
    const { anim } = build(true), before = anim.lit().map(key);
    for (let t = 0; t < 20000; t += 100) anim.tick(100);
    expect(anim.lit().map(key)).toEqual(before);
  });

  it("PAPER_DRIFT is (0.88, −0.47): the papers drift along it, out of the hotel's slab", () => {
    expect(PAPER_DRIFT).toEqual({ x: 0.88, y: -0.47 });
    const { scene, anim } = build(), w = scene.hotel.paperWindow;
    let drifted = false;
    for (let t = 0; t < 60000; t += 100) {
      anim.tick(100);
      for (const p of anim.papers().map(dot)) {
        expect(inSlab(p.at), JSON.stringify(p.at)).toBe(false);
        const dx = p.at.x - w.x, dy = p.at.y - w.y, dist = Math.hypot(dx, dy);
        if (dist > 10) {
          expect((dx * PAPER_DRIFT.x + dy * PAPER_DRIFT.y) / dist / Math.hypot(PAPER_DRIFT.x, PAPER_DRIFT.y)).toBeGreaterThan(0.9);
          drifted = true;
        }
      }
    }
    expect(drifted).toBe(true);
  });
});

describe("city-anim: the TELECOM mast (#479)", () => {
  const tip = { x: -95, y: 244.5, z: 22.5 };
  const ring = [3, 6, 9].map((dz) => ({ x: tip.x, y: tip.y + 0.6, z: tip.z - dz }));
  const base = city(createRng(7), createRng(8), createRng(9));
  const mast = (s: CityScene, on: boolean) => ({ ...s, telecom: on ? tip : null, neon: { ...s.neon, signs: [], mastRing: on ? ring : [] } }) as CityScene;
  const ringDots = (a: Accent[]) => lights(a).filter((d) => d.color === "magentaMid" && ring.some((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z));
  const tipDot = (a: Accent[]) => lights(a).find((d) => d.color === "amber" && d.at.x === tip.x && d.at.y === tip.y && d.at.z === tip.z);

  it("the mast ring runs one light per step from step 1, all on at frame 0", async () => {
    const { RING_STEP_MS } = await import("./city-anim");
    expect(RING_STEP_MS).toBe(200);
    const anim = createCityAnim(mast(base, true), createRng(3), { reducedMotion: false });
    expect(ringDots(anim.neon())).toHaveLength(3);
    for (const d of ringDots(anim.neon())) expect(d.r).toBe(0.5);
    const seen = new Set<number>();
    for (let k = 1; k <= 6; k++) {
      anim.tick(RING_STEP_MS);
      const on = ringDots(anim.neon());
      expect(on, `step ${k}`).toHaveLength(1);
      seen.add(on[0]!.at.z);
    }
    expect(seen.size).toBe(3);
  });

  it("the tip light breathes: r = 0.8 + 0.3·(1 + sine of clock / 1200), amber", () => {
    const anim = createCityAnim(mast(base, true), createRng(3), { reducedMotion: false });
    expect(tipDot(anim.neon())?.r).toBeCloseTo(1.1, 9);
    anim.tick(1000);
    expect(tipDot(anim.neon())?.r).toBeCloseTo(0.8 + 0.3 * (1 + Math.sin(1000 / 1200)), 9);
  });

  it("with reduced motion the ring stays all on and the tip at r 1.1", () => {
    const anim = createCityAnim(mast(base, true), createRng(3), { reducedMotion: true });
    for (let i = 0; i < 5; i++) anim.tick(250);
    expect(ringDots(anim.neon())).toHaveLength(3);
    expect(tipDot(anim.neon())?.r).toBeCloseTo(1.1, 9);
  });

  it("without TELECOM there is no ring or tip, and neon changes only on the existing steps", async () => {
    const { RING_STEP_MS, TELECOM_STEP_MS } = await import("./city-anim");
    const anim = createCityAnim(mast(base, false), createRng(3), { reducedMotion: false });
    expect(ringDots(anim.neon())).toHaveLength(0);
    expect(tipDot(anim.neon())).toBeUndefined();
    const withMast = createCityAnim(mast(base, true), createRng(3), { reducedMotion: false });
    expect(withMast.tick(TELECOM_STEP_MS).neon).toBe(true);
    expect(anim.tick(Math.min(RING_STEP_MS, TELECOM_STEP_MS)).neon).toBe(false);
  });
});
