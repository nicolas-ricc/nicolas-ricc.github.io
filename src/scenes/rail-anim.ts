import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { WEST_RAIL_X0 } from "./hinterland";
import { flip } from "./neon";
import { STREET_EDGE } from "./shipyard";
import { CROSSING, SIGNALS, STOP_X, TRACKS_Y } from "./station";
import { emu, trainLen } from "./train";

/**
 * Animated station, no Pixi: the four-car EMU enters from the west on track 3, brakes and
 * stops with its front at `STOP_X`, waits, leaves to the west and disappears; then the track stays
 * empty for a while. The cycle is `in → dwell → out → off`, of `CYCLE_MS` (≈ 101.7 s).
 *
 * Everything comes from closed-form piecewise formulas (nothing is integrated): the cycle time is enough to
 * know where the train is, so the state is a pure function of `ms` and there is nothing to
 * accumulate or draw. Entry: cruise at `LINE_SPEED` up to `STOP_X − BRAKE_U` (500 u) and uniform
 * braking over 5 s (a = 4.8 u/s²) until it stops right at the buffer. Exit: symmetric, the consist
 * accelerates 60 u in 5 s and cruises another 500 u until the tail reaches `ENTRY_X` (the
 * same edge it entered from), already invisible. `alpha` rises over the first `FADE_U` u of the front
 * and falls over the last, so the train appears and disappears with no cuts inside the bleed.
 *
 * Spec §7 deviations: the front stops 2 u from the buffer and not at ≈ 1 (`STOP_X` 158, buffer
 * 1.2 u tall); there is no rng, nothing is random (the spec asked for `createRng(SEED + n)`); and the
 * cycle lasts ≈ 101.7 s and not ≈ 120.
 *
 * Level crossing and signals hang off the same state. The level crossing blinks while the
 * consist cuts the `CROSSING` window widened by `CROSSING_NEAR_U` on each side, and during the dwell
 * only the last `PRE_DEPART_MS` (departure warning). Spec §7 deviation: there the level crossing
 * would keep flickering the whole dwell, but with the train stopped for 30 s it would be noise without information;
 * it stays dark except for the last 5 s. The entry signal turns red as soon as the front passes its post;
 * the exit, green from 5 s before departing until the tail leaves the street (`STREET_EDGE`).
 * Everything else, red.
 *
 * Spec: docs/superpowers/specs/2026-10-27-estacion-terminal-design.md §7 (deviations in §12).
 */
export const ENTRY_X = WEST_RAIL_X0;
export const LINE_SPEED = 24;       // u/s at cruise
export const BRAKE_U = 60;          // braking (and starting) distance before STOP_X
export const DWELL_MS = 30000, OFF_MS = 20000;
export const FADE_U = 30;
export const BLINK_MS = 500;
export const CROSSING_NEAR_U = 30;
export const PRE_DEPART_MS = 5000;
export const TRACK_Y = TRACKS_Y[2];
export const LEN = trainLen(4);

const CRUISE_U = STOP_X - BRAKE_U - ENTRY_X;                 // 500 u
const BRAKE_MS = 2 * BRAKE_U / LINE_SPEED * 1000;            // 5000 ms: v goes from 24 to 0 over 60 u
const BRAKE_A = LINE_SPEED * LINE_SPEED / (2 * BRAKE_U) / 1e6; // 4.8 u/s² in u/ms²
const CRUISE_MS = CRUISE_U / LINE_SPEED * 1000;              // 20,833.3 ms
export const IN_MS = CRUISE_MS + BRAKE_MS;
export const OUT_MS = IN_MS;
export const CYCLE_MS = IN_MS + DWELL_MS + OUT_MS + OFF_MS;

export type Phase = "in" | "dwell" | "out" | "off";
export type Aspect = "red" | "green";
export interface TrainState { phase: Phase; x0: number; lead: "e" | "w"; alpha: number }

const START: Record<Phase, number> = { in: 0, dwell: IN_MS, out: IN_MS + DWELL_MS, off: IN_MS + DWELL_MS + OUT_MS };
export const phaseStart = (phase: Phase): number => START[phase];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
// EPS: the cycle is built from float sums; a front within 1e-6 u of ENTRY_X is already "on the edge" (alpha exactly 0; at the end of `out` the float error was ~8e-10)
const EPS = 1e-6;
const fade = (front: number): number => (front - ENTRY_X <= EPS ? 0 : clamp01((front - ENTRY_X) / FADE_U));
const DWELL_X0 = STOP_X - LEN, END_X0 = ENTRY_X - LEN;

/** Distance covered since the train was stopped, in a braking (or start) of `t` ms, 0..BRAKE_U. */
const brakeU = (t: number): number => LINE_SPEED * t / 1000 - BRAKE_A * t * t / 2;

/** Train state at `ms` of the cycle (0 ≤ ms < CYCLE_MS). `x0` is the west end: in `in`/`dwell` the front is `x0 + LEN`; in `out` the front is `x0` and the tail `x0 + LEN`. */
export function trainStateAt(ms: number): TrainState {
  if (ms < IN_MS) {
    const front = ms < CRUISE_MS ? ENTRY_X + LINE_SPEED * ms / 1000 : STOP_X - BRAKE_U + brakeU(ms - CRUISE_MS);
    return { phase: "in", x0: front - LEN, lead: "e", alpha: fade(front) };
  }
  if (ms < START.out) return { phase: "dwell", x0: DWELL_X0, lead: "e", alpha: 1 };
  if (ms < START.off) {
    const t = ms - START.out;
    // start symmetric to the braking: 60 u accelerating and then cruise; the tail is x0 + LEN (the front goes west)
    const run = t < BRAKE_MS ? BRAKE_U - brakeU(BRAKE_MS - t) : BRAKE_U + LINE_SPEED * (t - BRAKE_MS) / 1000;
    const x0 = DWELL_X0 - run;
    return { phase: "out", x0, lead: "w", alpha: fade(x0 + LEN) };
  }
  return { phase: "off", x0: END_X0, lead: "w", alpha: 0 };
}

/** Is the level crossing blinking? `msInPhase` is the ms since `phaseStart(s.phase)`. */
export function crossingActive(s: TrainState, msInPhase: number): boolean {
  if (s.phase === "off") return false;
  // stopped, the train always cuts [70, 138]: only the departure warning counts
  if (s.phase === "dwell") return msInPhase >= DWELL_MS - PRE_DEPART_MS - EPS;
  const a = CROSSING.x0 - CROSSING_NEAR_U, b = CROSSING.x1 + CROSSING_NEAR_U;
  return s.x0 <= b && s.x0 + LEN >= a;
}

/** Aspect of the two signals: entry (post at x 96) and exit (x 118, which clears at `STREET_EDGE`). */
export function signalAspects(s: TrainState, msInPhase: number): { in: Aspect; out: Aspect } {
  const east = s.x0 + LEN; // front in `in`, tail in `out`
  const inGreen = s.phase === "in" && east < SIGNALS.in.x;
  const outGreen = (s.phase === "dwell" && msInPhase >= DWELL_MS - PRE_DEPART_MS - EPS) || (s.phase === "out" && east >= STREET_EDGE);
  return { in: inGreen ? "green" : "red", out: outGreen ? "green" : "red" };
}

export interface RailChanges { train: boolean; crossing: boolean; signals: boolean }
export interface RailAnim {
  train(): { solids: Solid[]; lights: Accent[]; alpha: number };
  crossing(): Accent[];
  signals(): Accent[];
  state(): TrainState;
  tick(dtMs: number): RailChanges;
}

const CROSSING_R_DOT = 0.45, SIGNAL_R_DOT = 0.4;

export function createRailAnim(opts: { reducedMotion: boolean }): RailAnim {
  // without motion the train stays stopped at the station, with the saloon lit (`dwell` from its start)
  let ms = opts.reducedMotion ? phaseStart("dwell") : 0, first = true;
  let s = trainStateAt(ms);
  const inPhase = (): number => ms - phaseStart(s.phase);
  const active = (): boolean => crossingActive(s, inPhase());
  const aspects = () => signalAspects(s, inPhase());
  const blinkStep = (): number => Math.floor(ms / BLINK_MS);

  // single-slot memo: in `dwell`, `off` and between equal frames the cars are not re-tessellated
  let memo: { x0: number; lead: "e" | "w"; solids: Solid[]; lights: Accent[] } | null = null;
  const built = () => {
    if (!memo || memo.x0 !== s.x0 || memo.lead !== s.lead) memo = { x0: s.x0, lead: s.lead, ...emu(s.x0, TRACK_Y, { cars: 4, lead: s.lead, lit: true }) };
    return memo;
  };

  return {
    train: () => { const b = built(); return { solids: b.solids, lights: b.lights, alpha: s.alpha }; },
    crossing: () => {
      if (!active()) return [];
      const step = blinkStep();
      // a single light per post, alternating sides: the two are never lit at once
      return [CROSSING.north, CROSSING.south].map((p): Accent => ({ kind: "dot", at: v3(p.x + 0.15, p.y + 0.15 + flip(step, -0.5, 0.5), p.h - 0.4), r: CROSSING_R_DOT, color: "magenta" }));
    },
    signals: () => {
      const a = aspects();
      const dot = (p: { x: number; y: number }, asp: Aspect): Accent => {
        const red = asp === "red";
        return { kind: "dot", at: v3(p.x + 0.25, p.y + 0.25, red ? 4.4 : 3.9), r: SIGNAL_R_DOT, color: red ? "magenta" : "cyanMid" };
      };
      return [dot(SIGNALS.in, a.in), dot(SIGNALS.out, a.out)];
    },
    state: () => s,
    tick(dtMs) {
      if (opts.reducedMotion || dtMs <= 0) return { train: false, crossing: false, signals: false };
      const all = first; first = false;
      const prev = s, wasActive = active(), prevStep = blinkStep(), prevAsp = aspects();
      ms = (ms + dtMs) % CYCLE_MS; s = trainStateAt(ms);
      const asp = aspects(), nowActive = active();
      return {
        train: all || s.x0 !== prev.x0 || s.lead !== prev.lead || s.alpha !== prev.alpha,
        crossing: all || nowActive !== wasActive || (nowActive && blinkStep() !== prevStep),
        signals: all || asp.in !== prevAsp.in || asp.out !== prevAsp.out,
      };
    },
  };
}
