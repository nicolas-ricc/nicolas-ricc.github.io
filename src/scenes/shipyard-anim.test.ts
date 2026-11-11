import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { createRng } from "../map/seed";
import { shipyard } from "./shipyard";
import { SPARK_GAP_MS, TROLLEY_CYCLE_MS, TROLLEY_PAUSE_MS, createShipyardAnim } from "./shipyard-anim";

const setup = (reducedMotion = false) => {
  const scene = shipyard(createRng(7));
  return { scene, anim: createShipyardAnim(scene, createRng(3), { reducedMotion }) };
};

/** The accents in this scene are always dots; narrows the type for the tests. */
const dot = (a: Accent): Extract<Accent, { kind: "dot" }> => {
  if (a.kind !== "dot") throw new Error("expected an accent of kind dot");
  return a;
};

describe("shipyard-anim", () => {
  it("the trolley never leaves the beam and returns to the start after a cycle", () => {
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

  it("during the initial pause the trolley does not move and tick reports no change", () => {
    const { scene, anim } = setup();
    const y = scene.trolley.at.y;
    const c = anim.tick(TROLLEY_PAUSE_MS / 2);
    expect(scene.trolley.at.y).toBe(y);
    expect(c.trolley).toBe(false);
  });

  it("at mid-cycle the trolley is at the other end", () => {
    const { scene, anim } = setup();
    anim.tick(TROLLEY_CYCLE_MS / 2);
    expect(scene.trolley.at.y).toBeCloseTo(scene.trolleyRange[1], 3);
    expect(dot(anim.trolleyLamp()).at.y).toBeCloseTo(scene.trolleyRange[1] + 2, 3);
    expect(dot(anim.trolleyLamp()).at.z).toBeLessThan(scene.trolley.at.z);
  });

  it("the sparks appear at a rib, last three frames and disappear", () => {
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
          // first frame of the event: fixes the rib that the whole flicker must respect.
          // The frame is averaged to cancel the jitter and the nearest rib
          // is taken (not the first that matches a threshold, because several are within <3u).
          const cx = s.reduce((sum, a) => sum + dot(a).at.x, 0) / s.length;
          const cy = s.reduce((sum, a) => sum + dot(a).at.y, 0) / s.length;
          runSpot = scene.weldSpots.reduce((best, w) => {
            const d = Math.hypot(w.x - cx, w.y - cy);
            return d < best.d ? { w, d } : best;
          }, { w: scene.weldSpots[0]!, d: Infinity }).w;
        } else if (runSpot) {
          // following frames of the same event: all the sparks near the SAME rib
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

  it("the sparks are spark dots of r 0.6", () => {
    const { anim } = setup();
    let seen = 0;
    for (let t = 0; t < 20000; t += 100) {
      anim.tick(100);
      for (const a of anim.sparks()) { seen++; expect(a).toMatchObject({ kind: "dot", r: 0.6, color: "spark" }); }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it("with reduced-motion nothing ever changes", () => {
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

describe("shipyard-anim: chunking (#125)", () => {
  const chunked = (dts: number[]) => {
    const { scene, anim } = setup();
    for (const dt of dts) anim.tick(dt);
    return { y: scene.trolley.at.y, anim };
  };
  const repeat = (n: number, dt: number) => Array.from({ length: n }, () => dt);
  it("one 60 s tick leaves the same as 600 ticks of 100 ms", () => {
    const a = chunked([60000]), b = chunked(repeat(600, 100));
    expect(a.anim.fired().sparks).toBeGreaterThan(0);
    expect(a.anim.fired()).toEqual(b.anim.fired());
    expect(a.anim.sparks()).toEqual(b.anim.sparks());
    expect(a.y).toBe(b.y);
  });
  it("an irregular chunking leaves the same as its sum", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 1234];
    const a = chunked(dts), b = chunked([dts.reduce((s, x) => s + x, 0)]);
    expect(a.anim.fired()).toEqual(b.anim.fired());
    expect(a.anim.sparks()).toEqual(b.anim.sparks());
  });
  it("a long tick that ends mid-event shows the same frame", () => {
    const b = setup().anim;
    let t = 0;
    while (b.sparks().length === 0) { b.tick(100); t += 100; }
    b.tick(100); t += 100; // second frame of the event
    const a = setup().anim;
    a.tick(t);
    expect(b.sparks().length).toBeGreaterThan(0);
    expect(a.sparks()).toEqual(b.sparks());
  });
  it("10 min at once: as many events as 6000 ticks of 100 ms", () => {
    const long = chunked([600000]).anim.fired().sparks;
    expect(long).toBeGreaterThanOrEqual(600000 / (SPARK_GAP_MS[1] + 300) - 1);
    expect(long).toBeLessThanOrEqual(600000 / SPARK_GAP_MS[0]);
    expect(long).toBe(chunked(repeat(6000, 100)).anim.fired().sparks);
  });
  it("an entire event inside a long tick reports no spark change", () => {
    const b = setup().anim;
    let t = 0;
    while (b.sparks().length === 0) { b.tick(10); t += 10; }
    while (b.sparks().length > 0) { b.tick(10); t += 10; }
    const a = setup().anim;
    expect(a.tick(t).sparks).toBe(false); // empty before and after: nothing to redraw
    expect(a.fired().sparks).toBe(1);
  });
  it("an invalid dt changes nothing", () => {
    const { scene, anim } = setup();
    const y = scene.trolley.at.y;
    for (const dt of [0, -5, NaN, Infinity]) expect(anim.tick(dt)).toEqual({ trolley: false, sparks: false });
    expect(anim.fired().sparks).toBe(0);
    expect(scene.trolley.at.y).toBe(y);
  });
});
