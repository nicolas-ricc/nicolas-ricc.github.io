import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import { bounds, wheelPoint } from "../iso/solids";
import { createRng } from "../map/seed";
import { DROP, WHEEL, coasterAt, coasterLength, fair } from "./fair";
import { DROP_CYCLE_MS, DROP_RISE_MS, NEON_STEP_MS, WHEEL_LIGHT_STEP_MS, WHEEL_PERIOD_MS, WHEEL_STEP_MS, createFairAnim } from "./fair-anim";

const setup = (reducedMotion = false) => createFairAnim(fair(createRng(7)), { reducedMotion });

describe("fair-anim", () => {
  it("the wheel turns once in 40 s and redraws every 250 ms; four rim lights lit at once", () => {
    const a = setup();
    expect(a.angle()).toBe(0);
    expect(a.tick(WHEEL_STEP_MS).wheel).toBe(true); expect(a.tick(50).wheel).toBe(false);
    // The clock stays between 300 ms and 40 000 ms: it never completes the turn.
    for (let t = WHEEL_STEP_MS + 50; t + 500 < WHEEL_PERIOD_MS; t += 500) a.tick(500);
    expect(a.angle()).toBeGreaterThan(6.2); expect(a.angle()).toBeLessThan(2 * Math.PI);
    expect(a.wheelLights()).toHaveLength(4);
    // The lights run more often than the wheel (150 ms versus 250 ms): after a light step without a wheel
    // step, the wheel on screen is still the one drawn before (`drawn`), so the lights have to
    // land on their gondolas, i.e. read the wheel's quantized angle and not the continuous clock.
    const drawn = a.wheel()[0]!;
    if (drawn.kind !== "wheel") throw new Error("the wheel is not kind wheel");
    expect(a.tick(WHEEL_LIGHT_STEP_MS).wheel).toBe(false);
    const slots = Array.from({ length: WHEEL.sides }, (_, k) => wheelPoint(drawn.at, drawn.angle + (2 * Math.PI * (k + 0.5)) / WHEEL.sides, WHEEL.r - 0.6));
    for (const l of a.wheelLights()) {
      expect(l.kind).toBe("dot");
      const at = l.kind === "dot" ? l.at : drawn.at;
      expect(slots.some((s) => Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z) < 1e-9)).toBe(true);
    }
  });
  it("the train never leaves the track, climbs slowly and descends fast", () => {
    const a = setup();
    const L = coasterLength();
    let prev = a.trainDist(), prevSeg = coasterAt(prev).seg;
    for (let t = 0; t < 60; t++) {
      a.tick(1000);
      const d = a.trainDist(), p = coasterAt(d);
      const moved = ((d - prev) % L + L) % L; prev = d;
      expect(moved).toBeGreaterThan(0); expect(moved).toBeLessThanOrEqual(9.01);
      if (prevSeg < 6 && p.seg < 6) expect(moved).toBeLessThanOrEqual(3.01); // the speed is decided at the start of the tick
      prevSeg = p.seg;
      // The real profile reaches 4.16 (track + 1.45 of the seat) between the lead car and the tail car (5.2 behind) on the steepest descent: 3 is not enough.
      for (const s of a.train()) { const b = bounds(s); expect(Math.abs((b.min.z + b.max.z) / 2 - p.z)).toBeLessThan(4.2); }
    }
  });
  it("the gondola rises for 6 s, waits 1 s, falls in 0.6 s and returns to the base at the end of the cycle", () => {
    const a = setup();
    expect(a.dropZ()).toBe(1);
    for (let t = 0; t < 6000; t += 100) a.tick(100);
    expect(a.dropZ()).toBeCloseTo(DROP.h - 3, 1);
    a.tick(1000); expect(a.dropZ()).toBeCloseTo(DROP.h - 3, 1);
    a.tick(600); expect(a.dropZ()).toBeCloseTo(1, 1);
    a.tick(DROP_CYCLE_MS - 7600); expect(a.dropZ()).toBeCloseTo(1, 1);
    expect(a.drop()).toHaveLength(9);
  });
  it("the hall's signs alternate every 500 ms; with reduced-motion nothing changes and the wheel has its 4 fixed lights", () => {
    const a = setup();
    const s0 = a.signs()[0]!.color; a.tick(500); expect(a.signs()[0]!.color).not.toBe(s0);
    const r = setup(true);
    expect(r.tick(1000)).toEqual({ wheel: false, lights: false, train: false, drop: false, signs: false, neon: false });
    expect(r.wheelLights()).toHaveLength(4); expect(r.angle()).toBe(0);
  });
});

const dots = (a: Accent[]) => a.flatMap((x) => (x.kind === "dot" ? [x] : []));
const on = (pts: Vec3[], a: Accent[]) => dots(a).filter((d) => pts.some((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z));

describe("fair-anim neon", () => {
  it("frame 0 and reduced motion: 4 marquee, 2 climb, whole column in magentaBleed; only cyan/magenta", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false }), r = createFairAnim(s, { reducedMotion: true });
    const f0 = a.neon();
    expect(on(s.neon.marquee, f0)).toHaveLength(4);
    expect(on(s.neon.lift, f0)).toHaveLength(2);
    expect(on(s.neon.column, f0).map((d) => [d.color, d.r])).toEqual(Array(6).fill(["magentaBleed", 0.25]));
    for (const x of f0) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(r.neon()).toEqual(f0);
    expect(r.tick(1000).neon).toBe(false);
    expect(r.neon()).toEqual(f0);
  });
  it("the marquee runs every 200 ms and each position keeps its color (even cyan, odd magenta)", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    const m0 = on(s.neon.marquee, a.neon());
    expect(a.tick(NEON_STEP_MS).neon).toBe(true);
    const m1 = on(s.neon.marquee, a.neon());
    expect(m1).toHaveLength(4); expect(m1).not.toEqual(m0);
    for (let t = 0; t < 16; t++) {
      for (const d of on(s.neon.marquee, a.neon())) {
        const k = s.neon.marquee.findIndex((p) => p.x === d.at.x);
        expect(d.color).toBe(k % 2 === 0 ? "cyan" : "magenta"); expect(d.r).toBe(0.35);
      }
      a.tick(NEON_STEP_MS);
    }
  });
  it("the column redraws on every gondola step, even if the neon step does not change", () => {
    const a = createFairAnim(fair(createRng(7)), { reducedMotion: false });
    const c = a.tick(100);
    expect(c.drop).toBe(true); expect(c.neon).toBe(true);
  });
  it("the climb runs upward with two cyanMid lights", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    const idx = () => on(s.neon.lift, a.neon()).map((d) => s.neon.lift.findIndex((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z)).sort((x, y) => x - y);
    expect(idx()).toEqual([0, 1]);
    a.tick(NEON_STEP_MS); expect(idx()).toEqual([1, 2]);
    for (const d of on(s.neon.lift, a.neon())) expect(d.color).toBe("cyanMid");
  });
  it("the column rises with the gondola: at the top the five lower ones in magenta, at the base none", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    for (let t = 0; t < DROP_RISE_MS + 500; t += 100) a.tick(100);
    // the gondola reaches DROP.h − 3 = 21 and the last light is at drop.h − 2 = 22: it never lights up
    expect(on(s.neon.column, a.neon()).map((d) => d.color)).toEqual([...Array(5).fill("magenta"), "magentaBleed"]);
    for (let t = 0; t < DROP_CYCLE_MS - DROP_RISE_MS - 500 + 100; t += 100) a.tick(100);
    expect(on(s.neon.column, a.neon()).every((d) => d.color === "magentaBleed")).toBe(true);
    const b = createFairAnim(s, { reducedMotion: false });
    for (let t = 0; t < DROP_RISE_MS / 2; t += 100) b.tick(100);
    expect(new Set(on(s.neon.column, b.neon()).map((d) => d.color))).toEqual(new Set(["magenta", "magentaBleed"]));
  });
});
