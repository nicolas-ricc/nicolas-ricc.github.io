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

/** The raft heaves (up and down, no pitch or roll): amplitude in world units and period in ms. */
export const HEAVE: Readonly<{ amp: number; periodMs: number }> = Object.freeze({ amp: 0.15, periodMs: 6700 });
/** The heave is quantized to multiples of this, so a pose can be cached (at most 31 per site). */
export const HEAVE_STEP = 0.01;
/** The heave offset at time `tMs`: a sine reduced modulo the period (so a long-running clock keeps its precision), rounded to HEAVE_STEP. */
export const heaveAt = (tMs: number): number => {
  const phase = ((tMs % HEAVE.periodMs) + HEAVE.periodMs) % HEAVE.periodMs;
  return Math.round((HEAVE.amp * Math.sin((2 * Math.PI * phase) / HEAVE.periodMs)) / HEAVE_STEP) * HEAVE_STEP;
};

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
