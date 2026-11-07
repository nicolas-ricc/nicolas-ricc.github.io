import { v3, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { excavatorWheel } from "./excavator";

/**
 * Chimney smoke: for each mouth, PUFFS puffs (gray cylinders) that
 * rise, drift NNE with a lateral sine, grow and are recycled at the mouth.
 * They start staggered, so frame 0 (and reduced-motion) shows a column
 * and not a dot. No Pixi.
 */
export const PUFFS = 5;
export const PUFF_RANGE = 28;
export const PUFF_SPEED = 2 / 1000; // u per ms
export const PUFF_LIFT = 0.25;      // z gained per unit traveled
export const PUFF_SIDE = 1.5;
export const PUFF_PERIOD_MS = 2500;
export const PUFF_R0 = 1.2, PUFF_R1 = 3, PUFF_H = 1.2;
const NNE = { x: 0.45, y: -0.893 };
const PERP = { x: -NNE.y, y: NNE.x };

export const WHEEL_SPEED = 0.5, WHEEL_STEP_MS = 100; // rad/s; the wheel is redrawn every step

export interface FactoryAnim { puffs(stack: number): Solid[]; wheel(): Solid[]; angle(): number; tick(dtMs: number): { smoke: boolean; wheel: boolean } }

export function createFactoryAnim(stacks: readonly Vec3[], rng: Rng, opts: { reducedMotion: boolean }): FactoryAnim {
  interface Puff { dist: number; phase: number; speed: number }
  const fresh = (): Puff => ({ dist: 0, phase: rng.next() * Math.PI * 2, speed: 0.8 + rng.next() * 0.4 });
  const all = stacks.map(() => Array.from({ length: PUFFS }, (_, i) => ({ ...fresh(), dist: (i / PUFFS) * PUFF_RANGE })));
  let clock = 0, wheelStep = 0;
  // The angle is quantized to the last step: what is drawn is what was marked as changed.
  const angle = () => (opts.reducedMotion ? 0 : ((WHEEL_SPEED * wheelStep * WHEEL_STEP_MS) / 1000) % (2 * Math.PI));
  const puffAt = (s: Vec3, p: Puff): Solid => {
    const t = p.dist / PUFF_RANGE;
    const side = p.dist === 0 ? 0 : PUFF_SIDE * Math.sin((clock / PUFF_PERIOD_MS) * Math.PI * 2 + p.phase) * Math.min(1, p.dist / 5);
    return { kind: "cylinder", at: v3(s.x + NNE.x * p.dist + PERP.x * side, s.y + NNE.y * p.dist + PERP.y * side, s.z + p.dist * PUFF_LIFT), r: PUFF_R0 + (PUFF_R1 - PUFF_R0) * t, h: PUFF_H, mat: "concrete", sides: 6 };
  };
  return {
    puffs: (k) => all[k]!.map((p) => puffAt(stacks[k]!, p)),
    wheel: () => [excavatorWheel(angle())],
    angle,
    tick(dtMs) {
      if (opts.reducedMotion || dtMs <= 0) return { smoke: false, wheel: false };
      clock += dtMs;
      for (const ps of all) for (const p of ps) {
        p.dist += PUFF_SPEED * p.speed * dtMs;
        if (p.dist >= PUFF_RANGE) Object.assign(p, fresh(), { dist: p.dist - PUFF_RANGE });
      }
      const ws = Math.floor(clock / WHEEL_STEP_MS), wheel = ws !== wheelStep; wheelStep = ws;
      return { smoke: true, wheel };
    },
  };
}
