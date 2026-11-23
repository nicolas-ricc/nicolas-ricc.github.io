import type { Accent } from "../iso/accent";
import { createRng, type Rng } from "../map/seed";
import { ALWAYS_LIT } from "./neighborhood";
import type { TechScene } from "./tech";

/**
 * The tech district at night, without Pixi: the amber signs pulse (alpha
 * 0.6..1, period 3 s) and the windows of the neighborhood (`homes`) turn on
 * and off per group with their own wall clock, except those of
 * `ALWAYS_LIT`. Frame 0 = everything on and still.
 */
export const SIGN_PERIOD_MS = 3000, SIGN_STEP_MS = 150;
export const HOMES_GAP_MS: [number, number] = [3000, 7000];
const SEED_MAX = 2 ** 32 - 1; // seed of a derived Rng (no 0x… literal: the palette guard would take it for a color)

export interface TechAnimChanges { signs: boolean; homes: boolean }
export interface TechAnim { signs(): Accent[]; homes(): Accent[]; fired(): { homes: number }; tick(dtMs: number): TechAnimChanges }

export function createTechAnim(scene: TechScene, rng: Rng, opts: { reducedMotion: boolean }): TechAnim {
  let clock = 0, signStep = 0;
  // neighborhood lights: own stream, derived from the rng
  const homesRng = createRng(rng.int(0, SEED_MAX));
  const groupLit = new Map<string, boolean>(); for (const h of scene.homes) if (!groupLit.has(h.group)) groupLit.set(h.group, h.lit);
  const flipGroups = [...groupLit.keys()].filter((g) => !ALWAYS_LIT.has(g));
  let homesTimer = homesRng.int(HOMES_GAP_MS[0], HOMES_GAP_MS[1]), homesFired = 0;
  const signAlpha = () => 0.8 + 0.2 * Math.cos((2 * Math.PI * (clock % SIGN_PERIOD_MS)) / SIGN_PERIOD_MS); // clock 0 → alpha 1 (frame 0 still and on)
  return {
    signs: () => scene.signs.map((a) => (a.kind === "poly" ? { ...a, alpha: opts.reducedMotion ? 1 : signAlpha() } : a)),
    homes: () => scene.homes.filter((h) => groupLit.get(h.group)).map((h): Accent => ({ kind: "poly", pts: h.pts, color: "amber", alpha: 1 })),
    fired: () => ({ homes: homesFired }),
    tick(dtMs) {
      const c: TechAnimChanges = { signs: false, homes: false };
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return c;
      clock += dtMs;
      const ss = Math.floor(clock / SIGN_STEP_MS); if (ss !== signStep) { signStep = ss; c.signs = true; }
      homesTimer -= dtMs;
      while (homesTimer <= 0 && flipGroups.length > 0) { homesTimer += homesRng.int(HOMES_GAP_MS[0], HOMES_GAP_MS[1]); const g = flipGroups[homesRng.int(0, flipGroups.length - 1)]!; groupLit.set(g, !groupLit.get(g)); homesFired++; c.homes = true; }
      return c;
    },
  };
}
