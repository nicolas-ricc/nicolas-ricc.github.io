import { v3, type Vec3 } from "../iso/geometry";
import type { Solid, Tri } from "../iso/solids";
import { WATER_MATS, type TerrainMesh, type WaterMat } from "./terrain";

/**
 * Dynamic water material, without Pixi. Two crossed wave trains (a long
 * background sea from the southeast and a shorter swell from the south), plus a
 * fixed noise per triangle, give a continuous height `waveField`; rounded and
 * added to the depth `baseTone` it is the triangle's integer tone
 * (`waveTone`, −2..1: lit, down, top, up). The interference of the two trains
 * breaks the crests into short patches: a single flat wave gave straight
 * screen lines (every wave traveling northwest has its crest horizontal on
 * screen) and read as a moving stripe.
 *
 * The sun is not reflected on the water face but in `glints`: where the height
 * exceeds GLINT_H, one in every GLINT_PICK triangles gets a small diamond
 * (material `glint`, sunset coral) elongated along the screen
 * horizontal, which is the world direction (1, −1). That way the glints are small
 * shapes and not whole triangles in the ground color.
 *
 * Cost: the water is split into BANDS bands by hash (interleaved, not by screen
 * x) and each step repaints one. Each triangle refreshes every
 * BANDS × WATER_STEP_MS; since neighbors refresh in different steps,
 * a tone change dissolves grain by grain instead of jumping in stripes
 * (with bands by screen x the seam between bands showed two phases).
 * The shore foam laps instead of blinking: a slow wave along
 * the coast, with its own phase per triangle.
 */
export const WATER_STEP_MS = 150, BANDS = 6, FOAM_STEP_MS = 250;
export const SWELL = { k: { x: 0.8, y: 0.6 }, lambda: 34, T: 9000, amp: 0.65 };
export const CHOP = { k: { x: 0.3, y: 0.95 }, lambda: 21, T: 5500, amp: 0.45 };
export const ABYSS = { lambda: 1.6, T: 1.5, amp: 0.6, jitter: 2.2 }; // factors over SWELL/CHOP for the trench: longer, slower and lower waves, more broken
export const BASE_W = 0.75; // weight of the depth baseTone (continuous, −1..1) against the wave
export const NOISE_AMP = 0.2, PHASE_JITTER = 0.45;
export const GLINT_H = 0.85, GLINT_PICK = 2;
const GLINT_LONG = [1.4, 2.2], GLINT_HALF_W = 0.6;
const FOAM_T_MS = 5200, FOAM_LAMBDA = 24, FOAM_GAP = -0.35;

const cx = (t: Tri): number => (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3;
const cy = (t: Tri): number => (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3;
const cz = (t: Tri): number => (t.pts[0].z + t.pts[1].z + t.pts[2].z) / 3;

/**
 * Fixed integer hash per triangle and salt. The centroids fall on a 6 u
 * grid (cx/cy = 6a+2 or 6a+4): a simple linear combination of cx/cy only takes
 * two residues mod 4 and correlates with the parity of a+b, that is with the
 * screen diagonals (glints in stripes, not scattered). This integer mixing
 * (splitmix-like) breaks that correlation; the salt gives independent
 * hashes for band, noise and glint.
 */
export const triMix = (t: Tri, salt = 0): number => {
  let h = (Math.floor(cx(t)) * 374761393 + Math.floor(cy(t)) * 668265263 + salt * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
export const triHash = (t: Tri, n = 4): number => triMix(t) % n;
/** Fixed noise per triangle in [−1, 1). */
export const triNoise = (t: Tri): number => (triMix(t, 1) / 4294967296) * 2 - 1;

/** Continuous wave height at the triangle's center, in tones (≈ −1.75..1.75). */
export function waveField(t: Tri, mat: WaterMat, clockMs: number): number {
  const x = cx(t), y = cy(t), n = triNoise(t), abyss = mat === "abyss";
  const lamF = abyss ? ABYSS.lambda : 1, tF = abyss ? ABYSS.T : 1, ampF = abyss ? ABYSS.amp : 1, jit = PHASE_JITTER * (abyss ? ABYSS.jitter : 1);
  const tau = Math.PI * 2;
  const phase = (w: typeof SWELL): number => (tau * (w.k.x * x + w.k.y * y)) / (w.lambda * lamF) + (tau * (clockMs % (w.T * tF))) / (w.T * tF);
  const swell = SWELL.amp * ampF * Math.sin(phase(SWELL) + jit * n);
  const chop = CHOP.amp * ampF * Math.sin(phase(CHOP) - jit * n);
  return swell + chop + NOISE_AMP * n;
}

/** Integer tone of the triangle: depth `baseTone` (× BASE_W) plus the wave, rounded together, in −2..1 (lit, down, top, up). */
export function waveTone(t: Tri, mat: WaterMat, clockMs: number): number {
  return Math.max(-2, Math.min(1, Math.round(BASE_W * (t.baseTone ?? 0) + waveField(t, mat, clockMs))));
}

/** Small diamond centered on the triangle, elongated along the screen horizontal (world (1, −1)); two triangles. */
export function glintShape(t: Tri, long: number): [Tri, Tri] {
  const x = cx(t), y = cy(t), z = cz(t);
  const a = long / Math.SQRT2, b = GLINT_HALF_W / Math.SQRT2; // (1,−1)/√2 and (1,1)/√2
  const e: Vec3 = v3(x + a, y - a, z), w: Vec3 = v3(x - a, y + a, z), s: Vec3 = v3(x + b, y + b, z), n: Vec3 = v3(x - b, y - b, z);
  return [{ pts: [w, n, e] }, { pts: [w, e, s] }];
}

/** Glints of a triangle at this instant: none, or the diamond (size and brightness by hash). */
export function glints(t: Tri, mat: WaterMat, clockMs: number): Tri[] {
  if (waveField(t, mat, clockMs) < GLINT_H) return [];
  const h = triMix(t, 2);
  if (h % GLINT_PICK !== 0) return [];
  const long = GLINT_LONG[(h >>> 3) % GLINT_LONG.length]!, bright = (h >>> 5) % 3 === 0 ? 1 : 0;
  return glintShape(t, long).map((g) => ({ ...g, toneOffset: bright }));
}

/** Foam: a slow wave along the coast; `false` in the gaps (`down` tone), which shift and lap. */
export function foamOn(t: Tri, clockMs: number): boolean {
  const phase = (Math.PI * 2 * (cx(t) + cy(t))) / FOAM_LAMBDA + (Math.PI * 2 * (clockMs % FOAM_T_MS)) / FOAM_T_MS + PHASE_JITTER * triNoise(t);
  return Math.sin(phase) > FOAM_GAP;
}

export interface WaterChanges { bands: Set<number>; foam: boolean }
export interface WaterAnim { band(k: number): Solid[]; foam(): Solid[]; tick(dtMs: number): WaterChanges }

export function createWaterAnim(terrain: TerrainMesh, opts: { reducedMotion: boolean }): WaterAnim {
  const all = terrain.water.flatMap((s) => (s.kind === "ground" ? s.tris.map((t) => ({ t, mat: s.mat as WaterMat })) : []));
  const bandOf = (t: Tri): number => triMix(t, 3) % BANDS; // interleaved: neighbors in different bands
  const bands: { mat: WaterMat; tris: Tri[] }[][] = Array.from({ length: BANDS }, () => WATER_MATS.map((mat) => ({ mat, tris: [] })));
  for (const { t, mat } of all) bands[bandOf(t)]![WATER_MATS.indexOf(mat)]!.tris.push(t);
  const glintSolids: (Solid & { kind: "ground" })[] = bands.map(() => ({ kind: "ground", mat: "glint", tris: [] }));
  const bandSolids: Solid[][] = bands.map((b, k) => [...b.filter((x) => x.tris.length > 0).map((x): Solid => ({ kind: "ground", mat: x.mat, tris: x.tris })), glintSolids[k]!]);
  const foamTris = terrain.foam.kind === "ground" ? terrain.foam.tris : [];

  let clock = 0, step = 0, foamStep = 0;
  const paintBand = (k: number): void => {
    const out: Tri[] = [];
    for (const b of bands[k]!) for (const t of b.tris) { t.toneOffset = waveTone(t, b.mat, clock); out.push(...glints(t, b.mat, clock)); }
    glintSolids[k]!.tris = out;
  };
  const paintFoam = (): void => { for (const t of foamTris) t.toneOffset = foamOn(t, clock) ? 0 : -1; };
  for (let k = 0; k < BANDS; k++) paintBand(k);
  paintFoam();

  return {
    band: (k) => bandSolids[k]!,
    foam: () => [terrain.foam],
    tick(dtMs) {
      const c: WaterChanges = { bands: new Set(), foam: false };
      if (opts.reducedMotion || dtMs <= 0) return c;
      clock += dtMs;
      const s = Math.floor(clock / WATER_STEP_MS);
      if (s !== step) { step = s; c.bands.add(s % BANDS); }
      for (const k of c.bands) paintBand(k);
      const fs = Math.floor(clock / FOAM_STEP_MS);
      if (fs !== foamStep) { foamStep = fs; c.foam = true; paintFoam(); }
      return c;
    },
  };
}
