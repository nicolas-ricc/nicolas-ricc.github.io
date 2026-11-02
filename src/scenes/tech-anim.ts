import type { Accent } from "../iso/accent";
import { facadeAccents } from "../iso/facade";
import { v3 } from "../iso/geometry";
import { visibleWalls } from "../iso/solids";
import { createRng, type Rng } from "../map/seed";
import { ALWAYS_LIT } from "./neighborhood";
import { chase, pulse } from "./neon";
import type { TechScene } from "./tech";

/**
 * The tech district at night, without Pixi: each tower has one lit floor
 * and every 4..9 s a random tower moves it to another floor or turns it off;
 * the amber signs pulse (alpha 0.6..1, period 3 s) and the light of the
 * telecommunications tower breathes. The neon crowns pulse (alpha 0.45..1,
 * out of phase) and every 6..12 s one swaps cyan ↔ magenta; the ring of the
 * mast runs one light at a time. The windows of the neighborhood (`homes`)
 * turn on and off per group with their own wall clock, except those of
 * `ALWAYS_LIT`. The timers of towers and crowns count wall time (own stream,
 * excess carried over): a long tick fires several expirations.
 * Frame 0 = everything on and still.
 */
export const TECH_BLINK_GAP_MS: [number, number] = [4000, 9000];
export const SIGN_PERIOD_MS = 3000, SIGN_STEP_MS = 150, TELECOM_STEP_MS = 100;
export const NEON_STEP_MS = 150, CROWN_PERIOD_MS = 2400, RING_STEP_MS = 200;
export const CROWN_FLIP_GAP_MS: [number, number] = [6000, 12000];
export const HOMES_GAP_MS: [number, number] = [3000, 7000];
const SEED_MAX = 2 ** 32 - 1; // seed of a derived Rng (no 0x… literal: the palette guard would take it for a color)
const CROWN_ALPHA = [0.45, 1] as const, RING_R = 0.5;
const TELECOM_R = 0.8, TELECOM_PULSE = 0.3, TELECOM_PERIOD = 1200;

export interface TechAnimChanges { windows: boolean; signs: boolean; telecom: boolean; neon: boolean; homes: boolean }
export interface TechAnim { windows(): Accent[]; signs(): Accent[]; telecom(): Accent; neon(): Accent[]; homes(): Accent[]; fired(): { homes: number; windows: number; crowns: number }; tick(dtMs: number): TechAnimChanges }

export function createTechAnim(scene: TechScene, rng: Rng, opts: { reducedMotion: boolean }): TechAnim {
  const walls = scene.towers.map((t) => visibleWalls(t.box).filter((f) => f.mat === "curtain" && f.toneOffset === 0));
  const lit: (number | null)[] = scene.towers.map((t) => rng.int(1, t.facade.floors - 1));
  const blinkRng = createRng(rng.int(0, SEED_MAX)); // own stream of the towers, derived where the first deadline used to be drawn
  const nextGap = () => blinkRng.int(TECH_BLINK_GAP_MS[0], TECH_BLINK_GAP_MS[1]);
  // windowsFired: expirations with towers (turning off an already-off tower counts even if unseen); crownsFired: color changes
  let clock = 0, blinkTimer = nextGap(), windowsFired = 0, crownsFired = 0, signStep = 0, telecomStep = 0;
  const colors = scene.neon.crowns.map((c) => c.color);
  const flipRng = createRng(rng.int(0, SEED_MAX));
  const nextFlip = () => flipRng.int(CROWN_FLIP_GAP_MS[0], CROWN_FLIP_GAP_MS[1]);
  let flipTimer = nextFlip(), neonStep = 0, ringStep = 0;
  // neighborhood lights: own stream, derived last so as not to reorder the tower and crown draws
  const homesRng = createRng(rng.int(0, SEED_MAX));
  const groupLit = new Map<string, boolean>(); for (const h of scene.homes) if (!groupLit.has(h.group)) groupLit.set(h.group, h.lit);
  const flipGroups = [...groupLit.keys()].filter((g) => !ALWAYS_LIT.has(g));
  let homesTimer = homesRng.int(HOMES_GAP_MS[0], HOMES_GAP_MS[1]), homesFired = 0;
  const signAlpha = () => 0.8 + 0.2 * Math.cos((2 * Math.PI * (clock % SIGN_PERIOD_MS)) / SIGN_PERIOD_MS); // clock 0 → alpha 1 (frame 0 still and on)
  return {
    windows: () => scene.towers.flatMap((t, k) => (lit[k] === null ? [] : facadeAccents(walls[k]!, { ...t.facade, litFloor: lit[k]! }, "amber"))),
    signs: () => scene.signs.map((a) => (a.kind === "poly" ? { ...a, alpha: opts.reducedMotion ? 1 : signAlpha() } : a)),
    telecom: () => ({ kind: "dot", at: v3(scene.telecom.x, scene.telecom.y, scene.telecom.z), r: TELECOM_R + TELECOM_PULSE * (1 + Math.sin(clock / TELECOM_PERIOD)), color: "amber" }),
    neon: () => {
      const n = scene.neon.crowns.length, at = neonStep * NEON_STEP_MS;
      const crowns = scene.neon.crowns.map((c, k): Accent => (c.kind === "poly" ? { ...c, color: colors[k]!, alpha: opts.reducedMotion || neonStep === 0 ? CROWN_ALPHA[1] : CROWN_ALPHA[0] + (CROWN_ALPHA[1] - CROWN_ALPHA[0]) * pulse(at, CROWN_PERIOD_MS, k / n) } : { ...c, color: colors[k]! }));
      const on = ringStep === 0 ? scene.neon.mastRing.map(() => true) : chase(scene.neon.mastRing.length, ringStep, 1); // step 0 = frame 0: everything on, as with reduced motion
      return [...crowns, ...scene.neon.mastRing.filter((_, k) => on[k]).map((p): Accent => ({ kind: "dot", at: p, r: RING_R, color: "magentaMid" }))];
    },
    homes: () => scene.homes.filter((h) => groupLit.get(h.group)).map((h): Accent => ({ kind: "poly", pts: h.pts, color: "amber", alpha: 1 })),
    fired: () => ({ homes: homesFired, windows: windowsFired, crowns: crownsFired }),
    tick(dtMs) {
      const c: TechAnimChanges = { windows: false, signs: false, telecom: false, neon: false, homes: false };
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return c;
      clock += dtMs;
      blinkTimer -= dtMs;
      while (blinkTimer <= 0) {
        blinkTimer += nextGap();
        if (scene.towers.length > 0) { // with no towers there is nobody to draw; the other layers go on
          const k = blinkRng.int(0, scene.towers.length - 1), floors = scene.towers[k]!.facade.floors;
          const old = lit[k];
          if (blinkRng.chance(0.3)) lit[k] = null;
          else { let nv = blinkRng.int(1, floors - 1); if (nv === old && floors > 2) nv = nv === floors - 1 ? nv - 1 : nv + 1; lit[k] = nv; } // the floor always changes if there is more than one option
          c.windows = true; windowsFired++;
        }
      }
      const ss = Math.floor(clock / SIGN_STEP_MS); if (ss !== signStep) { signStep = ss; c.signs = true; }
      const ts = Math.floor(clock / TELECOM_STEP_MS); if (ts !== telecomStep) { telecomStep = ts; c.telecom = true; }
      flipTimer -= dtMs;
      while (flipTimer <= 0) { flipTimer += nextFlip(); if (colors.length > 0) { const k = flipRng.int(0, colors.length - 1); colors[k] = colors[k] === "cyan" ? "magenta" : "cyan"; c.neon = true; crownsFired++; } }
      const ns = Math.floor(clock / NEON_STEP_MS); if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      const rs = Math.floor(clock / RING_STEP_MS); if (rs !== ringStep) { ringStep = rs; c.neon = true; }
      homesTimer -= dtMs;
      while (homesTimer <= 0 && flipGroups.length > 0) { homesTimer += homesRng.int(HOMES_GAP_MS[0], HOMES_GAP_MS[1]); const g = flipGroups[homesRng.int(0, flipGroups.length - 1)]!; groupLit.set(g, !groupLit.get(g)); homesFired++; c.homes = true; }
      return c;
    },
  };
}
