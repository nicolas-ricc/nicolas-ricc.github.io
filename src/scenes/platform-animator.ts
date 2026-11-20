import type { Solid } from "../iso/solids";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { poseAt, POSE_CYCLE_MS, REST_POSE, seaPlatformAt, type RaftPose, type WritingSite } from "./sign-platform";

/** Layer ids of the platform animator: its one solid layer (the raft). */
export const PLATFORM_LAYERS = { solid: "platform.solid" } as const;

/** Animator of the Writing platform: it can be moved between the two Writing sites. */
export interface PlatformAnimator extends Animator {
  readonly site: WritingSite;
  /** Moves the platform to `site`; the layers are reported at the next tick if the site differs from the one seen at the previous tick. */
  setSite(site: WritingSite): void;
}

const samePose = (a: RaftPose, b: RaftPose) => a.dz === b.dz && a.pitch === b.pitch && a.roll === b.roll;

/**
 * The sea platform at `opts.site` (default `"wide"`), heaving, pitching and rolling with `poseAt` unless `opts.reducedMotion`, in which case it stays at `REST_POSE`.
 * The raft is one timber mesh: its planks and the navy decals move as one body. The rest geometry is built once per site (in `raft.ts`); the animator keeps one memo per site, its last pose, rebuilt when `dz`, `pitch` or `roll` differs.
 * A layer is reported when the site or the quantized pose changed since the previous tick, at most 25 times per second.
 * The layer is reported after a site change, even with `dtMs` of 0 or NaN (an invalid `dtMs` does not advance the clock).
 */
export function platformAnimator(opts: { site?: WritingSite; reducedMotion: boolean }): PlatformAnimator {
  let site: WritingSite = opts.site ?? "wide", seen = site;
  let clock = 0, pose: RaftPose = REST_POSE, seenPose: RaftPose = REST_POSE; // clock kept modulo the pose cycle
  const built = new Map<WritingSite, { pose: RaftPose; solids: Solid[] }>();
  const at = () => {
    let m = built.get(site);
    if (!m || !samePose(m.pose, pose)) { const solids: Solid[] = []; seaPlatformAt(solids, site, pose); built.set(site, (m = { pose, solids })); }
    return m.solids;
  };
  const layers: Record<string, () => AnimLayer> = {
    [PLATFORM_LAYERS.solid]: () => ({ kind: "solid", solids: at() }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("platformAnimator", layers),
    get site() { return site; },
    setSite(s) { site = s; },
    tick(dtMs) {
      if (!opts.reducedMotion && Number.isFinite(dtMs) && dtMs > 0) { clock = (clock + dtMs) % POSE_CYCLE_MS; pose = poseAt(clock); }
      if (site === seen && samePose(pose, seenPose)) return new Set<string>();
      seen = site; seenPose = pose;
      return new Set(Object.keys(layers));
    },
  };
}
