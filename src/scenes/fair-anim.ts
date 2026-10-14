import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import type { AccentColor } from "../map/palette-iso";
import { wheelPoint, type Solid } from "../iso/solids";
import { chase, flip } from "./neon";
import { DROP, LIFT_SEGMENTS, WHEEL, coasterAt, coasterLength, dropSolids, trainSolids, wheelSolid, type FairScene } from "./fair";

/**
 * La feria en movimiento, sin Pixi: la vuelta al mundo gira (una vuelta cada
 * 40 s) con cuatro luces que corren por la llanta, el tren recorre el
 * circuito (lento en la subida, rápido después), la góndola de la torre sube,
 * espera y cae, los dos carteles del salón alternan y los neones corren:
 * marquesina, subida y columna de la torre (que sigue a la góndola). Frame 0 =
 * rueda en 0, tren en la estación, góndola abajo, cuatro luces fijas, cartel
 * magenta y neones en su paso 0 (cuatro luces de marquesina, dos de subida,
 * columna en reposo).
 */
export const WHEEL_PERIOD_MS = 40000, WHEEL_STEP_MS = 250, WHEEL_LIGHT_STEP_MS = 150, WHEEL_LIT = 4;
export const TRAIN_SPEED = 9, TRAIN_LIFT_SPEED = 3;
export const DROP_CYCLE_MS = 8000, DROP_STEP_MS = 100, DROP_RISE_MS = 6000, DROP_HOLD_MS = 1000, DROP_FALL_MS = 600;
export const SIGN_ALT_MS = 500, NEON_STEP_MS = 200, NEON_R = 0.35, NEON_OFF_R = 0.25;

export interface FairChanges { wheel: boolean; lights: boolean; train: boolean; drop: boolean; signs: boolean; neon: boolean }
export interface FairAnim { wheel(): Solid[]; wheelLights(): Accent[]; train(): Solid[]; drop(): Solid[]; signs(): Accent[]; neon(): Accent[]; angle(): number; trainDist(): number; dropZ(): number; tick(dtMs: number): FairChanges }

/** Altura de la góndola sobre la base dentro del ciclo: subida lineal, pausa, caída cuadrática, pausa. */
export function dropEase(ms: number): number {
  const t = ms % DROP_CYCLE_MS;
  if (t < DROP_RISE_MS) return t / DROP_RISE_MS;
  if (t < DROP_RISE_MS + DROP_HOLD_MS) return 1;
  const f = (t - DROP_RISE_MS - DROP_HOLD_MS) / DROP_FALL_MS;
  return f < 1 ? 1 - f * f : 0;
}

export function createFairAnim(scene: FairScene, opts: { reducedMotion: boolean }): FairAnim {
  const L = coasterLength(), base = scene.drop.at.z, top = DROP.h - 3;
  let clock = 0, wheelStep = 0, lightStep = 0, dropStep = 0, signStep = 0, neonStep = 0, dist = 0;
  // La rueda se redibuja cada WHEEL_STEP_MS, así que su ángulo se cuantiza al último paso. Las luces
  // de la llanta corren más seguido (WHEEL_LIGHT_STEP_MS) y leen este mismo ángulo: si usaran el reloj
  // continuo se adelantarían hasta un paso entero y quedarían fuera de la llanta dibujada.
  const angle = () => (opts.reducedMotion ? 0 : (2 * Math.PI * ((wheelStep * WHEEL_STEP_MS) % WHEEL_PERIOD_MS)) / WHEEL_PERIOD_MS);
  const dropZ = () => base + (top - base) * (opts.reducedMotion ? 0 : dropEase(clock));
  const run = (pts: Vec3[], lit: number, color: (k: number) => AccentColor): Accent[] => chase(pts.length, neonStep, lit).flatMap((o, k) => (o ? [{ kind: "dot" as const, at: pts[k]!, r: NEON_R, color: color(k) }] : []));
  return {
    wheel: () => [wheelSolid(angle())],
    wheelLights: () => Array.from({ length: WHEEL.sides }, (_, k) => k).filter((k) => (k + lightStep) % WHEEL.sides < WHEEL_LIT).map((k) => { const p = wheelPoint(scene.wheelAxis, angle() + (2 * Math.PI * (k + 0.5)) / WHEEL.sides, WHEEL.r - 0.6); return { kind: "dot" as const, at: p, r: 0.4, color: "magenta" as const }; }),
    train: () => trainSolids(dist),
    drop: () => dropSolids(dropZ()),
    signs: () => [scene.arcadeSigns[signStep % 2]!],
    // La columna se enciende (magenta) por debajo de la góndola; por encima queda en reposo (magentaBleed).
    neon: () => {
      const z = dropZ();
      return [
        ...run(scene.neon.marquee, 4, (k) => flip(k, "cyan", "magenta")),
        ...run(scene.neon.lift, 2, () => "cyanMid"),
        ...scene.neon.column.map((at) => (at.z <= z ? { kind: "dot" as const, at, r: NEON_R, color: "magenta" as const } : { kind: "dot" as const, at, r: NEON_OFF_R, color: "magentaBleed" as const })),
      ];
    },
    angle, trainDist: () => dist, dropZ,
    tick(dtMs) {
      const c: FairChanges = { wheel: false, lights: false, train: false, drop: false, signs: false, neon: false };
      if (opts.reducedMotion || dtMs <= 0) return c;
      clock += dtMs;
      const ws = Math.floor(clock / WHEEL_STEP_MS); if (ws !== wheelStep) { wheelStep = ws; c.wheel = true; c.lights = true; }
      const ls = Math.floor(clock / WHEEL_LIGHT_STEP_MS); if (ls !== lightStep) { lightStep = ls; c.lights = true; }
      const speed = coasterAt(dist).seg < LIFT_SEGMENTS ? TRAIN_LIFT_SPEED : TRAIN_SPEED;
      dist = (dist + (speed * dtMs) / 1000) % L; c.train = true;
      const ds = Math.floor(clock / DROP_STEP_MS); if (ds !== dropStep) { dropStep = ds; c.drop = true; }
      const ss = Math.floor(clock / SIGN_ALT_MS); if (ss !== signStep) { signStep = ss; c.signs = true; }
      const ns = Math.floor(clock / NEON_STEP_MS); if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      if (c.drop) c.neon = true; // la columna sigue a la góndola
      return c;
    },
  };
}
