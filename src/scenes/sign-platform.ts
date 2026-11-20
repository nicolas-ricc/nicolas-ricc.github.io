import type { Accent } from "../iso/accent";
import type { Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate } from "../iso/translate";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { toWorld } from "../kit/lettering";
import { CHAINSAW_FACE, CHAINSAW_X, CHAINSAW_BAR } from "../kit/marquee";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";
import { BOARD_TOP, LAYOUT, PLATFORM_SITES, REST_POSE, WRITING_CAP, raftAt, raftEnvelope, raftPlane, type RaftPose, type WritingSite } from "./raft";

// The raft lives in raft.ts (it cannot import this file: BLOG_SIGNS is built at load and calls raftAt); re-exported so consumers keep their import path.
export { BOARD_TOP, PLATFORM_SITES, REST_POSE, WRITING_CAP };
export type { RaftPose, WritingSite };

/** The raft heaves (up and down): amplitude in world units and period in ms. */
export const HEAVE: Readonly<{ amp: number; periodMs: number }> = Object.freeze({ amp: 0.15, periodMs: 6700 });
/** The raft pitches (about `RAFT_N`): amplitude in radians (1.5°) and period in ms. */
export const PITCH: Readonly<{ amp: number; periodMs: number }> = Object.freeze({ amp: (1.5 * Math.PI) / 180, periodMs: 9100 });
/** The raft rolls (about `RAFT_U`): amplitude in radians (1°) and period in ms. */
export const ROLL: Readonly<{ amp: number; periodMs: number }> = Object.freeze({ amp: (1.0 * Math.PI) / 180, periodMs: 7300 });
/** The heave is quantized to multiples of this, so consecutive ticks often share a pose and reuse its mesh. */
export const HEAVE_STEP = 0.01;
/** Pitch and roll are quantized to multiples of this (0.1°). */
export const ANGLE_STEP = (0.1 * Math.PI) / 180;

/** A sine of `wave` at phase 0, reduced modulo the period (so a long-running clock keeps its precision), rounded to multiples of `step`. */
const quantizedSine = (wave: Readonly<{ amp: number; periodMs: number }>, step: number, tMs: number): number => {
  const phase = ((tMs % wave.periodMs) + wave.periodMs) % wave.periodMs;
  return Math.round((wave.amp * Math.sin((2 * Math.PI * phase) / wave.periodMs)) / step) * step;
};

/** The heave offset at time `tMs`, rounded to HEAVE_STEP. */
export const heaveAt = (tMs: number): number => quantizedSine(HEAVE, HEAVE_STEP, tMs);
/** The pitch at time `tMs`, rounded to ANGLE_STEP. */
export const pitchAt = (tMs: number): number => quantizedSine(PITCH, ANGLE_STEP, tMs);
/** The roll at time `tMs`, rounded to ANGLE_STEP. */
export const rollAt = (tMs: number): number => quantizedSine(ROLL, ANGLE_STEP, tMs);
/** The raft's pose at time `tMs`: heave, pitch and roll, all at rest at t = 0. */
export const poseAt = (tMs: number): RaftPose => ({ dz: heaveAt(tMs), pitch: pitchAt(tMs), roll: rollAt(tMs) });
/** The pose repeats every this many ms (the lcm of the three periods). */
export const POSE_CYCLE_MS = 44_508_100;

/** Poses to check over the cycle: rest, the 8 corners of the pose cube, then 8 instants of the motion. Frozen. */
export const CYCLE_POSES: readonly Readonly<RaftPose>[] = Object.freeze([
  REST_POSE,
  ...([-1, 1] as const).flatMap((a) => ([-1, 1] as const).flatMap((b) => ([-1, 1] as const).map((c) => ({ dz: a * HEAVE.amp, pitch: b * PITCH.amp, roll: c * ROLL.amp })))),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => poseAt(k * 7919)),
].map((p) => Object.freeze(p)));

/** The raft's plan at the origin: the 4 corners of its envelope (planks with ragged ends and beam overhang) through the rest plane, moved to (0, 0). Order (a0, b0), (a1, b0), (a1, b1), (a0, b1). */
export const PLATFORM_DECK: readonly Vec2[] = (() => {
  const plane = raftPlane("wide"), e = raftEnvelope(), { x: sx, y: sy } = PLATFORM_SITES.wide;
  return ([[e.a0, e.b0], [e.a1, e.b0], [e.a1, e.b1], [e.a0, e.b1]] as const).map(([a, b]): Vec2 => { const q = toWorld(plane, a, b); return { x: q.x - sx, y: q.y - sy }; });
})();

/**
 * The Writing sign at a site, as the legibility oracle sees it: WRITING in Chainsaw Carnage as a navy decal lying on the raft's planks, which back it
 * (`raftAt(site, pose)`), posed by `pose` (default `REST_POSE`). Its x-height is the height of its shortest letter (`CHAINSAW_X`); its stroke, the width of the main stems.
 * A fresh spec on every call.
 */
export const signAt = (site: WritingSite, pose: RaftPose = REST_POSE): SignSpec =>
  signSpec({
    id: "plataforma", text: CHAINSAW_WRITING.text, size: WRITING_CAP, width: SIGN_FONT.width, decal: "navy", ground: true, plane: raftPlane(site, pose), style: "fill", backing: [raftAt(site, pose)],
    layouts: LAYOUT, xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP, bar: CHAINSAW_BAR * WRITING_CAP,
  });

/** The Writing sign of each site, for the legibility oracle. */
export const BLOG_SIGNS: Record<WritingSite, SignSpec> = { wide: signAt("wide"), tall: signAt("tall") };

/** The floating raft at a Writing site, posed by `pose`: one timber mesh (WRITING is its navy decals). A fresh mesh on every call, never BLOG_SIGNS's. */
export function seaPlatformAt(out: Solid[], site: WritingSite, pose: RaftPose = REST_POSE): void {
  out.push(raftAt(site, pose));
}

/** The raft at the origin (a relocatable piece): `seaPlatformAt("wide")` moved by −PLATFORM_SITES.wide. It has no accents. */
export function seaPlatform(out: Solid[], _accents: Accent[]): void {
  const solids: Solid[] = [], { x, y } = PLATFORM_SITES.wide;
  seaPlatformAt(solids, "wide");
  for (const s of solids) out.push(translate(s, -x, -y));
}
