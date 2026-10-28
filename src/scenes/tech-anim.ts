import type { Accent } from "../iso/accent";
import { facadeAccents } from "../iso/facade";
import { v3 } from "../iso/geometry";
import { tessellate } from "../iso/solids";
import { createRng, type Rng } from "../map/seed";
import { ALWAYS_LIT } from "./barrio";
import { chase, pulse } from "./neon";
import type { TechScene } from "./tech";

/**
 * El distrito tecnológico de noche, sin Pixi: cada torre tiene un piso
 * encendido y cada 4..9 s una torre al azar lo cambia de piso o lo apaga;
 * los carteles ámbar pulsan (alpha 0.6..1, período 3 s) y la luz de la torre
 * de telecomunicaciones respira. Las coronas de neón pulsan (alpha 0.45..1,
 * desfasadas) y cada 6..12 s una cambia cian ↔ magenta; el anillo del mástil
 * corre de a una luz. Las ventanas del barrio (`homes`) se encienden y apagan
 * por grupo con un reloj de pared propio, salvo las de `ALWAYS_LIT`. Frame 0 = todo encendido y quieto.
 */
export const TECH_BLINK_GAP_MS: [number, number] = [4000, 9000];
export const SIGN_PERIOD_MS = 3000, SIGN_STEP_MS = 150, TELECOM_STEP_MS = 100;
export const NEON_STEP_MS = 150, CROWN_PERIOD_MS = 2400, RING_STEP_MS = 200;
export const CROWN_FLIP_GAP_MS: [number, number] = [6000, 12000];
export const HOMES_GAP_MS: [number, number] = [3000, 7000];
const SEED_MAX = 2 ** 32 - 1; // semilla de un Rng derivado (sin literal 0x…: el guard de paleta lo tomaría por color)
const CROWN_ALPHA = [0.45, 1] as const, RING_R = 0.5;
const TELECOM_R = 0.8, TELECOM_PULSE = 0.3, TELECOM_PERIOD = 1200;

export interface TechAnimChanges { windows: boolean; signs: boolean; telecom: boolean; neon: boolean; homes: boolean }
export interface TechAnim { windows(): Accent[]; signs(): Accent[]; telecom(): Accent; neon(): Accent[]; homes(): Accent[]; fired(): { homes: number }; tick(dtMs: number): TechAnimChanges }

export function createTechAnim(scene: TechScene, rng: Rng, opts: { reducedMotion: boolean }): TechAnim {
  const walls = scene.towers.map((t) => tessellate(t.box).filter((f) => Math.abs(f.normal.z) < 1e-6 && f.mat === "curtain" && f.toneOffset === 0)); // paredes visibles, sin las caras de fachada
  const lit: (number | null)[] = scene.towers.map((t) => rng.int(1, t.facade.floors - 1));
  const nextGap = () => rng.int(TECH_BLINK_GAP_MS[0], TECH_BLINK_GAP_MS[1]);
  let clock = 0, blinkTimer = nextGap(), signStep = 0, telecomStep = 0;
  const colors = scene.neon.crowns.map((c) => c.color);
  const nextFlip = () => rng.int(CROWN_FLIP_GAP_MS[0], CROWN_FLIP_GAP_MS[1]);
  let flipTimer = nextFlip(), neonStep = 0, ringStep = 0;
  // luces del barrio: flujo propio, derivado al final para no reordenar las tiradas de torres y coronas
  const homesRng = createRng(rng.int(0, SEED_MAX));
  const groupLit = new Map<string, boolean>(); for (const h of scene.homes) if (!groupLit.has(h.group)) groupLit.set(h.group, h.lit);
  const flipGroups = [...groupLit.keys()].filter((g) => !ALWAYS_LIT.has(g));
  let homesTimer = homesRng.int(HOMES_GAP_MS[0], HOMES_GAP_MS[1]), homesFired = 0;
  const signAlpha = () => 0.8 + 0.2 * Math.cos((2 * Math.PI * (clock % SIGN_PERIOD_MS)) / SIGN_PERIOD_MS); // clock 0 → alpha 1 (frame 0 quieto y encendido)
  return {
    windows: () => scene.towers.flatMap((t, k) => (lit[k] === null ? [] : facadeAccents(walls[k]!, { ...t.facade, litFloor: lit[k]! }, "amber"))),
    signs: () => scene.signs.map((a) => (a.kind === "poly" ? { ...a, alpha: opts.reducedMotion ? 1 : signAlpha() } : a)),
    telecom: () => ({ kind: "dot", at: v3(scene.telecom.x, scene.telecom.y, scene.telecom.z), r: TELECOM_R + TELECOM_PULSE * (1 + Math.sin(clock / TELECOM_PERIOD)), color: "amber" }),
    neon: () => {
      const n = scene.neon.crowns.length, at = neonStep * NEON_STEP_MS;
      const crowns = scene.neon.crowns.map((c, k): Accent => (c.kind === "poly" ? { ...c, color: colors[k]!, alpha: opts.reducedMotion || neonStep === 0 ? CROWN_ALPHA[1] : CROWN_ALPHA[0] + (CROWN_ALPHA[1] - CROWN_ALPHA[0]) * pulse(at, CROWN_PERIOD_MS, k / n) } : { ...c, color: colors[k]! }));
      const on = ringStep === 0 ? scene.neon.mastRing.map(() => true) : chase(scene.neon.mastRing.length, ringStep, 1); // paso 0 = frame 0: todo encendido, como con reduced motion
      return [...crowns, ...scene.neon.mastRing.filter((_, k) => on[k]).map((p): Accent => ({ kind: "dot", at: p, r: RING_R, color: "magentaMid" }))];
    },
    homes: () => scene.homes.filter((h) => groupLit.get(h.group)).map((h): Accent => ({ kind: "poly", pts: h.pts, color: "amber", alpha: 1 })),
    fired: () => ({ homes: homesFired }),
    tick(dtMs) {
      const c: TechAnimChanges = { windows: false, signs: false, telecom: false, neon: false, homes: false };
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return c;
      clock += dtMs;
      blinkTimer -= dtMs;
      if (blinkTimer <= 0) {
        blinkTimer = nextGap();
        if (scene.towers.length > 0) { // sin torres no hay a quién sortear; las demás capas siguen
          const k = rng.int(0, scene.towers.length - 1), floors = scene.towers[k]!.facade.floors;
          const old = lit[k];
          if (rng.chance(0.3)) lit[k] = null;
          else { let nv = rng.int(1, floors - 1); if (nv === old && floors > 2) nv = nv === floors - 1 ? nv - 1 : nv + 1; lit[k] = nv; } // siempre cambia el piso si hay más de una opción
          c.windows = true;
        }
      }
      const ss = Math.floor(clock / SIGN_STEP_MS); if (ss !== signStep) { signStep = ss; c.signs = true; }
      const ts = Math.floor(clock / TELECOM_STEP_MS); if (ts !== telecomStep) { telecomStep = ts; c.telecom = true; }
      flipTimer -= dtMs;
      if (flipTimer <= 0) { flipTimer = nextFlip(); if (colors.length > 0) { const k = rng.int(0, colors.length - 1); colors[k] = colors[k] === "cyan" ? "magenta" : "cyan"; c.neon = true; } }
      const ns = Math.floor(clock / NEON_STEP_MS); if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      const rs = Math.floor(clock / RING_STEP_MS); if (rs !== ringStep) { ringStep = rs; c.neon = true; }
      homesTimer -= dtMs;
      while (homesTimer <= 0 && flipGroups.length > 0) { homesTimer += homesRng.int(HOMES_GAP_MS[0], HOMES_GAP_MS[1]); const g = flipGroups[homesRng.int(0, flipGroups.length - 1)]!; groupLit.set(g, !groupLit.get(g)); homesFired++; c.homes = true; }
      return c;
    },
  };
}
