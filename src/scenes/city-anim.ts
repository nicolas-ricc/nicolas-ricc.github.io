import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { WINDOW_ALPHA } from "../city/lights";
import { createRng, type Rng } from "../map/seed";
import type { CityScene } from "./city";
import { chase } from "./neon";

/**
 * The city animations, without Pixi and with their own state: the lit floor
 * blinks (it goes off for one tick every 4..9 s), papers fly out of a window
 * toward the NNE, the antenna light pulses and the district neons change: a
 * sign every 3..7 s changes color or goes off for a step, and two lights run
 * along the promenade. Also, windows of the buildings turn on and off, and a
 * street neon on the quay flickers. Pauses are measured in wall time, not in
 * ticks; the paper that reaches the end is reborn at the window and continues
 * with the leftover time. Frame 0 = everything still and on; with
 * reduced-motion it stays there.
 */
export const BLINK_GAP_MS: [number, number] = [4000, 9000];
export const PAPER_SPEED = 4 / 1000; // u per ms
export const PAPER_RANGE = 30;
export const PAPER_AMP = 1.5;
export const PAPER_PERIOD_MS = 2000;
export const ANTENNA_STEP_MS = 100;
export const PAPER_R = 0.4, PAPER_R_END = 0.12; // the paper thins in the last third, so there is no "pop" when recycling
export const PAPER_FADE_FROM = 2 / 3; // fraction of PAPER_RANGE where it starts to thin
export const PAPER_LIFT = 0.15; // z it gains per unit traveled (the wind lifts it)
export const PAPER_SIDE = 1.5; // maximum lateral deviation, perpendicular to the drift
export const PAPER_SIDE_RAMP = 5; // in how many units the deviation fully comes in
export const NEON_STEP_MS = 150; // how long a sign blackout lasts
export const SIGN_GAP_MS: [number, number] = [3000, 7000];
export const PROMENADE_STEP_MS = 250;
export const WINDOW_GAP_MS: [number, number] = [300, 900]; // between one window change and the next
export const FLICKER_GAP_MS: [number, number] = [1000, 3000]; // between one flicker of the street neon and the next
export const FLICKER_ALPHA = 0.3; // halo and front of the street neon while it flickers
export const PROMENADE_R = 0.35;
const SEED_MAX = 2 ** 32 - 1; // seed of a derived Rng (no 0x… literal: the palette guard would take it for a color)
const ANTENNA_BASE_R = 0.8, ANTENNA_PULSE_R = 0.3, ANTENNA_PERIOD = 1200; // r = 0.8 + 0.3·(1 + Math.sin(t / 1200))
const NNE = { x: 0.45, y: -0.893 }; // unit: north-northeast (y grows to the south); on screen it goes up to the right
const PERP = { x: -NNE.y, y: NNE.x }; // perpendicular to the drift: opens the fan

export interface CityAnimChanges { lit: boolean; papers: boolean; antenna: boolean; neon: boolean; windows: boolean }
export interface CityAnim { lit(): Accent[]; papers(): Accent[]; antenna(): Accent; neon(): Accent[]; windows(): Accent[]; tick(dtMs: number): CityAnimChanges; fired(): { lit: number; neon: number; papers: number; windows: number; flicker: number } }

const NONE: CityAnimChanges = { lit: false, papers: false, antenna: false, neon: false, windows: false };

export function createCityAnim(scene: Pick<CityScene, "tower" | "neon" | "lights">, rng: Rng, opts: { reducedMotion: boolean }): CityAnim {
  const { tower, neon } = scene;
  const w = tower.paperWindow;
  // own stream: sharing `rng` with the papers would make the drawn pause depend on the chunking
  const blinkRng = createRng(rng.int(0, SEED_MAX));
  const nextGap = (): number => blinkRng.int(BLINK_GAP_MS[0], BLINK_GAP_MS[1]);

  let clock = 0;
  let off = false;
  let blinkTimer = nextGap();
  let antennaStep = 0;
  interface Paper { dist: number; phase: number; side: number; speed: number }
  const respawn = (p: Paper, r: Rng): void => {
    p.dist = 0;
    p.phase = r.next() * Math.PI * 2;
    p.side = (r.next() * 2 - 1) * PAPER_SIDE;
    p.speed = 0.8 + r.next() * 0.4;
  };
  // staggered start: paper i is born already at (i / n)·PAPER_RANGE from the
  // window, so frame 0 (and reduced-motion) shows a trail and not a point.
  const n = rng.int(5, 8);
  const papers: Paper[] = Array.from({ length: n }, (_, i) => {
    const p: Paper = { dist: 0, phase: 0, side: 0, speed: 1 };
    respawn(p, rng);
    p.dist = (i / n) * PAPER_RANGE;
    return p;
  });
  // neons: they come after the state of the papers so as not to reorder their draws
  const signs = neon.signs.map((a) => ({ a, color: a.color, offUntil: -1 }));
  const signRng = createRng(rng.int(0, SEED_MAX)); // own stream, for the same reason as blinkRng
  let signTimer = signRng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
  const paperRngs = papers.map(() => createRng(rng.int(0, SEED_MAX))); // one per paper, last: the recycling does not depend on the chunking
  let promenadeStep = 0;
  let blinks = 0, signEvents = 0, recycled = 0; // firings since construction, for fired()
  // windows: after papers and signs so as not to reorder their draws
  const wins = scene.lights.windows.filter((x) => x.animable).map((x) => ({ w: x, on: x.on }));
  const target = wins.filter((x) => x.on).length, tol = Math.max(1, Math.round(0.05 * wins.length));
  const windowRng = createRng(rng.int(0, SEED_MAX)); // own stream, for the same reason as blinkRng
  let windowTimer = windowRng.int(WINDOW_GAP_MS[0], WINDOW_GAP_MS[1]);
  let windowEvents = 0;
  // street neon: after the windows so as not to reorder their draws
  const flickerRng = createRng(rng.int(0, SEED_MAX)); // own stream; derived even with no street neon, so the shared rng does not depend on it
  let flickers = 0;
  const street = scene.lights.flicker === null ? null : scene.lights.neons[scene.lights.flicker]!;
  let flickerTimer = street ? flickerRng.int(FLICKER_GAP_MS[0], FLICKER_GAP_MS[1]) : 0;
  let flickerUntil = -1;

  const paperAt = (p: Paper): Accent => {
    const lateral = p.side * Math.min(1, p.dist / PAPER_SIDE_RAMP);
    const wave = p.dist === 0 ? 0 : PAPER_AMP * Math.sin((clock / PAPER_PERIOD_MS) * Math.PI * 2 + p.phase);
    const fade = Math.max(0, p.dist / PAPER_RANGE - PAPER_FADE_FROM) / (1 - PAPER_FADE_FROM);
    return {
      kind: "dot",
      at: v3(w.x + NNE.x * p.dist + PERP.x * lateral, w.y + NNE.y * p.dist + PERP.y * lateral, w.z + wave + p.dist * PAPER_LIFT),
      r: PAPER_R + (PAPER_R_END - PAPER_R) * Math.min(1, fade),
      color: "amberMid",
    };
  };
  const antennaR = (): number => ANTENNA_BASE_R + ANTENNA_PULSE_R * (1 + Math.sin((antennaStep * ANTENNA_STEP_MS) / ANTENNA_PERIOD));

  return {
    lit: () => (off ? [] : [...tower.litWindows]), // copy: the consumer cannot touch the scene
    papers: () => papers.map(paperAt),
    antenna: () => ({ kind: "dot", at: tower.antenna, r: antennaR(), color: "amberMid" }),
    neon: () => {
      const on = signs.filter((s) => s.offUntil <= clock).map((s) => ({ ...s.a, color: s.color }));
      const lit = promenadeStep === 0 ? null : chase(neon.promenade.length, promenadeStep, 2);
      const lights = neon.promenade.filter((_, k) => !lit || lit[k]).map((at): Accent => ({ kind: "dot", at, r: PROMENADE_R, color: "cyanMid" }));
      const dim = flickerUntil > clock; // halo and front (the first two); the puddle does not change
      const st = street ? street.accents.map((a, k): Accent => (dim && k < 2 && a.kind === "poly" ? { ...a, alpha: FLICKER_ALPHA } : a)) : [];
      return [...on, ...lights, ...st];
    },
    windows: () => wins.filter((x) => x.on).map(({ w: lw }): Accent => ({ kind: "poly", pts: lw.window.pts, color: lw.color, alpha: WINDOW_ALPHA })),
    fired: () => ({ lit: blinks, neon: signEvents, papers: recycled, windows: windowEvents, flicker: flickers }),
    tick(dtMs) {
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return NONE; // NaN or Infinity would hang the while loops
      clock += dtMs;
      const c: CityAnimChanges = { lit: false, papers: true, antenna: false, neon: false, windows: false };

      // blink: one tick off (two in a row only with ticks ≥ 4 s); the next pause counts from the
      // firing, and a long tick can fire several
      if (off) { off = false; c.lit = true; }
      blinkTimer -= dtMs;
      while (blinkTimer <= 0) { blinkTimer += nextGap(); blinks++; off = true; c.lit = true; }

      papers.forEach((p, i) => { // by time, not by distance: the speed changes when recycling
        let left = dtMs;
        for (;;) {
          const v = PAPER_SPEED * p.speed, toEnd = (PAPER_RANGE - p.dist) / v;
          if (toEnd > left) { p.dist += v * left; break; }
          left -= toEnd; respawn(p, paperRngs[i]!); recycled++;
        }
      });

      const step = Math.floor(clock / ANTENNA_STEP_MS);
      if (step !== antennaStep) { antennaStep = step; c.antenna = true; }

      for (const s of signs) if (s.offUntil >= 0 && clock >= s.offUntil) { s.offUntil = -1; c.neon = true; } // the tube comes back
      signTimer -= dtMs;
      while (signTimer <= 0 && signs.length > 0) { // a long tick can bring several events
        const s = signs[signRng.int(0, signs.length - 1)]!;
        if (signRng.chance(0.5)) s.color = s.color === "cyan" ? "magenta" : "cyan";
        else if (s.offUntil < 0) s.offUntil = clock + NEON_STEP_MS;
        signTimer += signRng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
        signEvents++;
        c.neon = true; // a color change or a blackout is always visible (SIGN_GAP_MS ≥ 3000 > NEON_STEP_MS)
      }
      const mStep = Math.floor(clock / PROMENADE_STEP_MS);
      if (mStep !== promenadeStep) { promenadeStep = mStep; c.neon = true; }

      // windows: one turns on or off; if that takes the count out of the band, one of the other state changes
      windowTimer -= dtMs;
      while (windowTimer <= 0 && wins.length > 0) { // a long tick can bring several changes
        let x = wins[windowRng.int(0, wins.length - 1)]!;
        const lit = wins.filter((y) => y.on).length;
        if (Math.abs(lit + (x.on ? -1 : 1) - target) > tol) { const other = wins.filter((y) => y.on !== x.on); x = other[windowRng.int(0, other.length - 1)]!; }
        x.on = !x.on;
        windowTimer += windowRng.int(WINDOW_GAP_MS[0], WINDOW_GAP_MS[1]);
        windowEvents++;
        c.windows = true;
      }

      // street neon: flickers for a step (FLICKER_GAP_MS ≥ 1000 > NEON_STEP_MS: one flicker does not step on the next)
      if (street) {
        if (flickerUntil >= 0 && clock >= flickerUntil) { flickerUntil = -1; c.neon = true; }
        flickerTimer -= dtMs;
        while (flickerTimer <= 0) { // a long tick can bring several flickers; they share one dim step
          flickerUntil = clock + NEON_STEP_MS;
          flickerTimer += flickerRng.int(FLICKER_GAP_MS[0], FLICKER_GAP_MS[1]);
          flickers++;
          c.neon = true;
        }
      }
      return c;
    },
  };
}
