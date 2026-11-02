import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { hullsIntersect, isBehind, overlaps, screenBounds, screenHull } from "../iso/depth";
import { bounds, tessellate } from "../iso/solids";
import {
  BLINK_MS, BRAKE_U, CROSSING_NEAR_U, CYCLE_MS, DWELL_MS, ENTRY_X, FADE_U, IN_MS, LEN, LINE_SPEED, OFF_MS, OUT_MS, PRE_DEPART_MS, TRACK_Y,
  createRailAnim, crossingActive, phaseStart, signalAspects, trainStateAt, type TrainState,
} from "./rail-anim";
import { STREET_EDGE } from "./shipyard";
import { BUFFER_X, CROSSING, SIGNALS, STOP_X, TRACKS_Y } from "./station";
import { trainBox, trainLen } from "./train";
import { world } from "./world";

/** East end: the front when entering and during the dwell, the tail when leaving. */
const east = (s: TrainState) => s.x0 + LEN;
const inPhase = (ms: number) => ms - phaseStart(trainStateAt(ms).phase);
/** First ms (in 1 ms steps) from `from` at which `pred` holds. */
const firstMs = (from: number, to: number, pred: (ms: number) => boolean): number => {
  for (let ms = from; ms < to; ms += 1) if (pred(ms)) return ms;
  throw new Error("never holds");
};
const samples = (step: number): number[] => { const out: number[] = []; for (let ms = 0; ms < CYCLE_MS; ms += step) out.push(ms); return out; };
/** Animator advanced to `ms` of the cycle (a single tick, which is the first). */
const animAt = (ms: number) => { const a = createRailAnim({ reducedMotion: false }); a.tick(ms); return a; };
const dots = (as: Accent[], color: string) => as.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot" && a.color === color);

describe("rail-anim: constants", () => {
  it("values from the issue", () => {
    expect([ENTRY_X, LINE_SPEED, BRAKE_U, DWELL_MS, OFF_MS, FADE_U, BLINK_MS, CROSSING_NEAR_U, PRE_DEPART_MS]).toEqual([-402, 24, 60, 30000, 20000, 30, 500, 30, 5000]);
    expect(TRACK_Y).toBe(TRACKS_Y[2]);
    expect(LEN).toBe(trainLen(4));
  });
  it("symmetric entry and exit: 500 u cruise plus 5 s of braking; cycle ≈ 101.7 s", () => {
    expect(IN_MS).toBeCloseTo(500 / 24 * 1000 + 5000, 6);
    expect(OUT_MS).toBeCloseTo(IN_MS, 6);
    expect(CYCLE_MS).toBeCloseTo(IN_MS + DWELL_MS + OUT_MS + OFF_MS, 6);
    expect([phaseStart("in"), phaseStart("dwell"), phaseStart("out"), phaseStart("off")]).toEqual([0, IN_MS, IN_MS + DWELL_MS, IN_MS + DWELL_MS + OUT_MS]);
  });
});

describe("rail-anim: cycle", () => {
  it("at ms 0 the front appears at ENTRY_X, invisible, with headlights to the east", () => {
    const s = trainStateAt(0);
    expect(s.phase).toBe("in");
    expect(east(s)).toBeCloseTo(ENTRY_X, 9);
    expect(s.alpha).toBe(0);
    expect(s.lead).toBe("e");
  });
  it("cruise at LINE_SPEED and uniform braking until stopping with the front at STOP_X", () => {
    expect(east(trainStateAt(1000))).toBeCloseTo(ENTRY_X + 24, 6);
    const brake = IN_MS - 5000;
    expect(east(trainStateAt(brake))).toBeCloseTo(STOP_X - BRAKE_U, 6);
    // halfway through the braking (2.5 s, a = 4.8): 24·2.5 − 4.8·2.5²/2 = 45
    expect(east(trainStateAt(brake + 2500))).toBeCloseTo(STOP_X - BRAKE_U + 45, 6);
    expect(trainStateAt(IN_MS - 1).phase).toBe("in");
  });
  it("at IN_MS it stops with the front exactly at STOP_X and alpha 1", () => {
    const s = trainStateAt(IN_MS);
    expect(s.phase).toBe("dwell");
    expect(Math.abs(east(s) - STOP_X)).toBeLessThan(1e-6);
    expect(s.alpha).toBe(1);
  });
  it("the whole dwell stays at STOP_X − LEN with headlights to the east", () => {
    for (let ms = IN_MS; ms < IN_MS + DWELL_MS; ms += 1000) {
      const s = trainStateAt(ms);
      expect(s.phase).toBe("dwell");
      expect(s.x0).toBeCloseTo(STOP_X - LEN, 9);
      expect(s.lead).toBe("e");
    }
  });
  it("leaves to the west with headlights to the west and ends with the tail at ENTRY_X, invisible", () => {
    const mid = trainStateAt(phaseStart("out") + 10000);
    expect(mid.phase).toBe("out");
    expect(mid.lead).toBe("w");
    expect(mid.x0).toBeLessThan(STOP_X - LEN);
    const end = trainStateAt(phaseStart("off") - 1e-6);
    expect(east(end)).toBeLessThanOrEqual(ENTRY_X + 1e-6);
    expect(end.alpha).toBe(0);
  });
  it("in off alpha 0; the last ms of the cycle is off", () => {
    for (let ms = phaseStart("off"); ms < CYCLE_MS; ms += 1000) expect(trainStateAt(ms).alpha).toBe(0);
    expect(trainStateAt(CYCLE_MS - 1).phase).toBe("off");
  });
  it("continuity at phase boundaries", () => {
    for (const p of ["dwell", "out", "off"] as const) {
      const t = phaseStart(p), a = trainStateAt(t - 1e-6), b = trainStateAt(t);
      expect(b.phase, p).toBe(p);
      expect(Math.abs(a.x0 - b.x0), p).toBeLessThan(1e-6);
    }
    expect(trainStateAt(IN_MS).lead).toBe("e");
    const off = trainStateAt(phaseStart("off"));
    expect(off.alpha).toBe(0);
    expect(off.lead).toBe("w");
    expect(east(off)).toBeCloseTo(ENTRY_X, 6);
  });
});

describe("rail-anim: invariants every 250 ms", () => {
  it("never east of the buffers; alpha in 0..1", () => {
    for (const ms of samples(250)) {
      const s = trainStateAt(ms);
      expect(east(s), `ms ${ms}`).toBeLessThanOrEqual(BUFFER_X);
      expect(s.alpha).toBeGreaterThanOrEqual(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });
  it("alpha rises over the first FADE_U u of the entry and falls over the last of the exit", () => {
    let prev = -1;
    for (let ms = 0; east(trainStateAt(ms)) <= ENTRY_X + FADE_U + 5; ms += 250) {
      const a = trainStateAt(ms).alpha;
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    expect(prev).toBe(1);
    prev = 2;
    for (let ms = phaseStart("out"); ms < phaseStart("off"); ms += 250) {
      const s = trainStateAt(ms);
      if (east(s) > ENTRY_X + FADE_U + 5) continue;
      expect(s.alpha).toBeLessThanOrEqual(prev);
      prev = s.alpha;
    }
    expect(prev).toBeLessThan(0.2);
  });
  it("all the train solids over RAIL_Y (y 130.8..134.2) and at z 0..5.7", () => {
    const a = createRailAnim({ reducedMotion: false });
    a.tick(1);
    for (let k = 0; k < CYCLE_MS / 250; k++) {
      for (const s of a.train().solids) {
        const b = bounds(s);
        expect(b.min.y).toBeGreaterThanOrEqual(130.8 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(134.2 + 1e-9);
        expect(b.min.z).toBeGreaterThanOrEqual(-1e-9); expect(b.max.z).toBeLessThanOrEqual(5.7 + 1e-9);
        expect(b.max.x).toBeLessThanOrEqual(BUFFER_X);
      }
      a.tick(250);
    }
  });
});

describe("rail-anim: active level crossing", () => {
  const near0 = CROSSING.x0 - CROSSING_NEAR_U, near1 = CROSSING.x1 + CROSSING_NEAR_U; // 70, 138
  it("the window is [70, 138]", () => { expect([near0, near1]).toEqual([70, 138]); });
  it("inactive with the train off screen and during the dwell, except the last 5 s", () => {
    expect(crossingActive(trainStateAt(0), 0)).toBe(false);
    expect(crossingActive(trainStateAt(IN_MS), 0)).toBe(false);
    const mid = IN_MS + DWELL_MS / 2;
    expect(crossingActive(trainStateAt(mid), inPhase(mid))).toBe(false);
    const pre = IN_MS + DWELL_MS - PRE_DEPART_MS;
    expect(crossingActive(trainStateAt(pre - 1), inPhase(pre - 1))).toBe(false);
    expect(crossingActive(trainStateAt(pre), inPhase(pre))).toBe(true);
    for (let ms = phaseStart("off"); ms < CYCLE_MS; ms += 1000) expect(crossingActive(trainStateAt(ms), inPhase(ms))).toBe(false);
  });
  it("entering: it activates when the front reaches x 70", () => {
    const on = firstMs(0, IN_MS, (ms) => crossingActive(trainStateAt(ms), inPhase(ms)));
    expect(east(trainStateAt(on))).toBeGreaterThanOrEqual(near0);
    expect(east(trainStateAt(on - 1))).toBeLessThan(near0);
    for (let ms = on; ms < IN_MS; ms += 100) expect(crossingActive(trainStateAt(ms), inPhase(ms))).toBe(true);
  });
  it("leaving: active while the consist cuts [70, 138] and it turns off when the tail passes x 70", () => {
    const out = phaseStart("out");
    expect(crossingActive(trainStateAt(out), 0)).toBe(true);
    const off = firstMs(out, phaseStart("off"), (ms) => !crossingActive(trainStateAt(ms), inPhase(ms)));
    expect(east(trainStateAt(off))).toBeLessThan(near0);
    expect(east(trainStateAt(off - 1))).toBeGreaterThanOrEqual(near0);
  });
});

describe("rail-anim: signals", () => {
  const asp = (ms: number) => signalAspects(trainStateAt(ms), inPhase(ms));
  it("entry green at the start of the entry and red when the front passes x 96", () => {
    expect(asp(0).in).toBe("green");
    const red = firstMs(0, IN_MS, (ms) => asp(ms).in === "red");
    expect(east(trainStateAt(red))).toBeGreaterThanOrEqual(SIGNALS.in.x);
    expect(east(trainStateAt(red - 1))).toBeLessThan(SIGNALS.in.x);
  });
  it("exit red during the dwell until 5 s before departing, green from then on", () => {
    const pre = IN_MS + DWELL_MS - PRE_DEPART_MS;
    expect(asp(IN_MS).out).toBe("red");
    expect(asp(pre - 1).out).toBe("red");
    expect(asp(pre).out).toBe("green");
    expect(asp(phaseStart("out")).out).toBe("green");
  });
  it("exit red when the tail leaves x 108", () => {
    const red = firstMs(phaseStart("out"), phaseStart("off"), (ms) => asp(ms).out === "red");
    expect(east(trainStateAt(red))).toBeLessThan(STREET_EDGE);
    expect(east(trainStateAt(red - 1))).toBeGreaterThanOrEqual(STREET_EDGE);
  });
  it("everything else red: exit during the entry, entry during the dwell and the exit, both in off", () => {
    for (let ms = 0; ms < IN_MS; ms += 500) expect(asp(ms).out).toBe("red");
    for (let ms = IN_MS; ms < phaseStart("off"); ms += 500) expect(asp(ms).in).toBe("red");
    for (let ms = phaseStart("off"); ms < CYCLE_MS; ms += 500) expect(asp(ms)).toEqual({ in: "red", out: "red" });
  });
});

describe("createRailAnim: train lights", () => {
  const ends = (ms: number) => {
    const t = animAt(ms).train();
    const xs = t.solids.flatMap((s) => { const b = bounds(s); return [b.min.x, b.max.x]; });
    return { t, west: Math.min(...xs), east: Math.max(...xs) };
  };
  it("entering: cyan headlights on the east end, magenta red lights on the west; amber sign on both", () => {
    const { t, west, east } = ends(15000);
    const cyan = dots(t.lights, "cyan"), mag = dots(t.lights, "magenta");
    expect(cyan.length).toBe(2); expect(mag.length).toBe(2);
    for (const d of cyan) expect(Math.abs(d.at.x - east)).toBeLessThan(1);
    for (const d of mag) expect(Math.abs(d.at.x - west)).toBeLessThan(1);
    const amber = t.lights.filter((a) => a.color === "amber").map((a) => (a.kind === "poly" ? a.pts[0]!.x : a.at.x));
    expect(amber.some((x) => Math.abs(x - east) < 1)).toBe(true);
    expect(amber.some((x) => Math.abs(x - west) < 1)).toBe(true);
  });
  it("leaving: reversed", () => {
    const { t, west, east } = ends(phaseStart("out") + 8000);
    for (const d of dots(t.lights, "cyan")) expect(Math.abs(d.at.x - west)).toBeLessThan(1);
    for (const d of dots(t.lights, "magenta")) expect(Math.abs(d.at.x - east)).toBeLessThan(1);
  });
  it("saloon lit and state alpha", () => {
    const a = animAt(15000);
    expect(a.train().lights.some((l) => l.color === "cyanBleed")).toBe(true);
    expect(a.train().alpha).toBe(a.state().alpha);
    expect(a.state()).toEqual(trainStateAt(15000));
  });
});

describe("createRailAnim: level crossing and signals (accents)", () => {
  const pre = IN_MS + DWELL_MS - PRE_DEPART_MS;
  it("active: one magenta dot r 0.45 per post at z h − 0.4, alternating 1 u in y every BLINK_MS", () => {
    const a = animAt(pre + 10);
    const c0 = a.crossing();
    expect(c0).toHaveLength(2);
    const posts = [CROSSING.north, CROSSING.south];
    c0.forEach((d, k) => {
      if (d.kind !== "dot") throw new Error("dot");
      const p = posts[k]!;
      expect(d.color).toBe("magenta"); expect(d.r).toBe(0.45);
      expect(d.at.z).toBeCloseTo(p.h - 0.4, 9);
      expect(d.at.x).toBeCloseTo(p.x + 0.15, 9);
      expect(Math.abs(d.at.y - (p.y + 0.15))).toBeCloseTo(0.5, 9);
    });
    a.tick(BLINK_MS);
    const c1 = a.crossing();
    c1.forEach((d, k) => {
      const d0 = c0[k]!;
      if (d.kind !== "dot" || d0.kind !== "dot") throw new Error("dot");
      expect(d.at.x).toBe(d0.at.x);
      expect(Math.abs(d.at.y - d0.at.y)).toBeCloseTo(1, 9);
    });
  });
  it("inactive: empty", () => {
    expect(animAt(IN_MS + 1000).crossing()).toEqual([]);
  });
  it("signals: red magenta r 0.4 at z 4.4, green cyanMid r 0.4 at z 3.9, at the center of the post", () => {
    const check = (ms: number, want: { in: "red" | "green"; out: "red" | "green" }) => {
      const s = animAt(ms).signals();
      expect(s).toHaveLength(2);
      [SIGNALS.in, SIGNALS.out].forEach((p, k) => {
        const d = s[k]!, red = (k === 0 ? want.in : want.out) === "red";
        if (d.kind !== "dot") throw new Error("dot");
        expect(d.color).toBe(red ? "magenta" : "cyanMid");
        expect(d.r).toBe(0.4);
        expect(d.at).toEqual({ x: p.x + 0.25, y: p.y + 0.25, z: red ? 4.4 : 3.9 });
      });
    };
    check(1000, { in: "green", out: "red" });
    check(pre + 10, { in: "red", out: "green" });
  });
});

describe("createRailAnim: tick", () => {
  it("the first tick marks everything", () => {
    expect(createRailAnim({ reducedMotion: false }).tick(16)).toEqual({ train: true, crossing: true, signals: true });
  });
  it("an initial tick(0) neither marks nor consumes the first; a later tick(0) does not mark either", () => {
    const a = createRailAnim({ reducedMotion: false });
    expect(a.tick(0)).toEqual({ train: false, crossing: false, signals: false });
    expect(a.tick(100)).toEqual({ train: true, crossing: true, signals: true });
    expect(a.tick(0)).toEqual({ train: false, crossing: false, signals: false });
  });
  it("mid-dwell it marks nothing", () => {
    const a = animAt(IN_MS + 5000);
    expect(a.tick(100)).toEqual({ train: false, crossing: false, signals: false });
  });
  it("while entering, the train marks on every tick", () => {
    const a = animAt(5000);
    for (let k = 0; k < 10; k++) expect(a.tick(33).train).toBe(true);
  });
  it("with the level crossing active, crossing marks when the blink step changes and not in between", () => {
    const pre = IN_MS + DWELL_MS - PRE_DEPART_MS;
    const start = Math.ceil(pre / BLINK_MS) * BLINK_MS + 10; // 10 ms after a step change, already active
    const a = animAt(start);
    expect(a.tick(100).crossing).toBe(false);
    expect(a.tick(BLINK_MS - 100).crossing).toBe(true);
  });
  it("a dt of several laps wraps around with modulo", () => {
    const a = createRailAnim({ reducedMotion: false });
    a.tick(CYCLE_MS * 3 + 1234);
    const s = a.state(), t = trainStateAt(1234);
    expect(s.phase).toBe(t.phase); expect(s.lead).toBe(t.lead);
    expect(s.x0).toBeCloseTo(t.x0, 6); expect(s.alpha).toBeCloseTo(t.alpha, 6);
  });
});

describe("createRailAnim: reducedMotion", () => {
  it("fixed state in the dwell, saloon lit, level crossing off, red signals, tick without changes", () => {
    const a = createRailAnim({ reducedMotion: true });
    for (const dt of [16, 1000, CYCLE_MS]) expect(a.tick(dt)).toEqual({ train: false, crossing: false, signals: false });
    expect(a.state()).toEqual({ phase: "dwell", x0: STOP_X - LEN, lead: "e", alpha: 1 });
    const t = a.train();
    expect(t.alpha).toBe(1);
    expect(t.lights.some((l) => l.color === "cyanBleed")).toBe(true);
    expect(a.crossing()).toEqual([]);
    expect(a.signals().map((d) => d.color)).toEqual(["magenta", "magenta"]);
  });
});

describe("createRailAnim: face cap", () => {
  it("rail.train tessellates in ≤ 600 faces over 20 samples of the cycle", () => {
    for (let k = 0; k < 20; k++) {
      const faces = animAt((k + 0.5) * CYCLE_MS / 20).train().solids.flatMap(tessellate).length;
      expect(faces, `sample ${k}`).toBeLessThanOrEqual(600);
    }
  });
});

describe("createRailAnim: occlusion with real positions", () => {
  it("with the train visible, no tall static solid that overlaps it on screen is in front", () => {
    const statics = world(7).solids.map((s) => { const b = bounds(s); return { s, b, sb: screenBounds(b), sh: screenHull(b) }; })
      .filter((o) => o.b.max.z - o.b.min.z > 0.4);
    let checked = 0;
    for (const ms of samples(500)) {
      const st = trainStateAt(ms);
      if (st.alpha <= 0) continue;
      const tb = trainBox(st.x0, TRACK_Y, 4), sb = screenBounds(tb), sh = screenHull(tb);
      for (const o of statics) {
        if (!overlaps(sb, o.sb) || !hullsIntersect(sh, o.sh)) continue;
        checked++;
        expect(isBehind(tb, o.b), `ms ${ms}: ${JSON.stringify(o.s).slice(0, 160)}`).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
