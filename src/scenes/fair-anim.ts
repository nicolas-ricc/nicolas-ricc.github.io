import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import type { AccentColor } from "../map/palette-iso";
import { wheelPoint, type Solid } from "../iso/solids";
import { chase, flip } from "./neon";
import { DROP, LIFT_SEGMENTS, WHEEL, coasterAt, coasterLength, dropSolids, flumeAt, flumeLength, logSolids, trainSolids, wheelSolid, type FairScene } from "./fair";

/**
 * The fair in motion, without Pixi: the Ferris wheel turns (one turn every
 * 40 s) with four lights running along the rim, the train runs the
 * circuit (slow on the climb, fast afterwards), the tower gondola rises,
 * waits and falls, the hall's two signs alternate, the two logs ride the
 * flume (2 u/s on the lift, 4 on the flat, 12 down the drop, then back to
 * the station) and the neons run: marquee, climb, tower column (which
 * follows the gondola), ghost train and mirror house. Frame 0 = wheel at 0,
 * train and logs at the station, gondola down, four fixed lights, magenta
 * sign and neons at their step 0 (four marquee lights, two climb lights,
 * column at rest, four ghost lights, two mirror lights).
 */
export const WHEEL_PERIOD_MS = 40000, WHEEL_STEP_MS = 250, WHEEL_LIGHT_STEP_MS = 150, WHEEL_LIT = 4;
export const TRAIN_SPEED = 9, TRAIN_LIFT_SPEED = 3;
export const LOG_SPEED = 4, LOG_LIFT_SPEED = 2, LOG_DROP_SPEED = 12;
export const DROP_CYCLE_MS = 8000, DROP_STEP_MS = 100, DROP_RISE_MS = 6000, DROP_HOLD_MS = 1000, DROP_FALL_MS = 600;
export const SIGN_ALT_MS = 500, NEON_STEP_MS = 200, NEON_R = 0.35, NEON_OFF_R = 0.25;

export interface FairChanges { wheel: boolean; lights: boolean; train: boolean; drop: boolean; signs: boolean; neon: boolean; logs: boolean }
export interface FairAnim { wheel(): Solid[]; wheelLights(): Accent[]; train(): Solid[]; drop(): Solid[]; signs(): Accent[]; neon(): Accent[]; logs(): Solid[]; angle(): number; trainDist(): number; logDist(): number; dropZ(): number; tick(dtMs: number): FairChanges }

/** Height of the gondola above the base within the cycle: linear rise, pause, quadratic fall, pause. */
export function dropEase(ms: number): number {
  const t = ms % DROP_CYCLE_MS;
  if (t < DROP_RISE_MS) return t / DROP_RISE_MS;
  if (t < DROP_RISE_MS + DROP_HOLD_MS) return 1;
  const f = (t - DROP_RISE_MS - DROP_HOLD_MS) / DROP_FALL_MS;
  return f < 1 ? 1 - f * f : 0;
}

export function createFairAnim(scene: FairScene, opts: { reducedMotion: boolean }): FairAnim {
  const L = coasterLength(), base = scene.drop.at.z, top = DROP.h - 3;
  let clock = 0, wheelStep = 0, lightStep = 0, dropStep = 0, signStep = 0, neonStep = 0, dist = 0, logD = 0;
  const LL = flumeLength();
  // The wheel is redrawn every WHEEL_STEP_MS, so its angle is quantized to the last step. The rim
  // lights run more often (WHEEL_LIGHT_STEP_MS) and read this same angle: if they used the continuous
  // clock they would get ahead by up to a whole step and end up off the drawn rim.
  const angle = () => (opts.reducedMotion ? 0 : (2 * Math.PI * ((wheelStep * WHEEL_STEP_MS) % WHEEL_PERIOD_MS)) / WHEEL_PERIOD_MS);
  const dropZ = () => base + (top - base) * (opts.reducedMotion ? 0 : dropEase(clock));
  const run = (pts: Vec3[], lit: number, color: (k: number) => AccentColor): Accent[] => chase(pts.length, neonStep, lit).flatMap((o, k) => (o ? [{ kind: "dot" as const, at: pts[k]!, r: NEON_R, color: color(k) }] : []));
  return {
    wheel: () => [wheelSolid(angle())],
    wheelLights: () => Array.from({ length: WHEEL.sides }, (_, k) => k).filter((k) => (k + lightStep) % WHEEL.sides < WHEEL_LIT).map((k) => { const p = wheelPoint(scene.wheelAxis, angle() + (2 * Math.PI * (k + 0.5)) / WHEEL.sides, WHEEL.r - 0.6); return { kind: "dot" as const, at: p, r: 0.4, color: "magenta" as const }; }),
    train: () => trainSolids(dist),
    logs: () => logSolids(logD),
    drop: () => dropSolids(dropZ()),
    signs: () => [scene.arcadeSigns[signStep % 2]!],
    // The column lights up (magenta) below the gondola; above it stays at rest (magentaBleed).
    neon: () => {
      const z = dropZ();
      return [
        ...run(scene.neon.marquee, 4, (k) => flip(k, "cyan", "magenta")),
        ...run(scene.neon.ghost, 4, (k) => flip(k, "magenta", "magentaMid")),
        ...run(scene.neon.mirror, 2, () => "cyan"),
        ...run(scene.neon.lift, 2, () => "cyanMid"),
        ...scene.neon.column.map((at) => (at.z <= z ? { kind: "dot" as const, at, r: NEON_R, color: "magenta" as const } : { kind: "dot" as const, at, r: NEON_OFF_R, color: "magentaBleed" as const })),
      ];
    },
    angle, trainDist: () => dist, logDist: () => logD, dropZ,
    tick(dtMs) {
      const c: FairChanges = { wheel: false, lights: false, train: false, drop: false, signs: false, neon: false, logs: false };
      if (opts.reducedMotion || dtMs <= 0) return c;
      clock += dtMs;
      const ws = Math.floor(clock / WHEEL_STEP_MS); if (ws !== wheelStep) { wheelStep = ws; c.wheel = true; c.lights = true; }
      const ls = Math.floor(clock / WHEEL_LIGHT_STEP_MS); if (ls !== lightStep) { lightStep = ls; c.lights = true; }
      const speed = coasterAt(dist).seg < LIFT_SEGMENTS ? TRAIN_LIFT_SPEED : TRAIN_SPEED;
      dist = (dist + (speed * dtMs) / 1000) % L; c.train = true;
      const logSpeed = [LOG_LIFT_SPEED, LOG_SPEED, LOG_DROP_SPEED][flumeAt(logD).seg]!;
      logD = (logD + (logSpeed * dtMs) / 1000) % LL; c.logs = true;
      const ds = Math.floor(clock / DROP_STEP_MS); if (ds !== dropStep) { dropStep = ds; c.drop = true; }
      const ss = Math.floor(clock / SIGN_ALT_MS); if (ss !== signStep) { signStep = ss; c.signs = true; }
      const ns = Math.floor(clock / NEON_STEP_MS); if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      if (c.drop) c.neon = true; // the column follows the gondola
      return c;
    },
  };
}
