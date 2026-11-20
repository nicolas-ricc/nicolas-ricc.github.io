import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { HEAVE, HEAVE_STEP, heaveAt, seaPlatformAt, type WritingSite } from "./sign-platform";

/** Layer ids of the platform animator: its solids, then its lights. */
export const PLATFORM_LAYERS = { solid: "platform.solid", lights: "platform.lights" } as const;

/** Animator of the Writing platform: it can be moved between the two Writing sites. */
export interface PlatformAnimator extends Animator {
  readonly site: WritingSite;
  /** Moves the platform to `site`; the layers are reported at the next tick if the site differs from the one seen at the previous tick. */
  setSite(site: WritingSite): void;
}

/**
 * The sea platform at `opts.site` (default `"wide"`), heaving with `heaveAt` unless `opts.reducedMotion`, in which case it stays at its rest pose.
 * The board and its paint move as one body. Each `(site, step)` pose is built once and reused (at most 31 per site).
 * A layer is reported when the site or the quantized heave step changed since the previous tick, so at most about 12 times per second.
 * Both layers are reported after a site change, even with `dtMs` of 0 or NaN (an invalid `dtMs` does not advance the clock).
 */
export function platformAnimator(opts: { site?: WritingSite; reducedMotion: boolean }): PlatformAnimator {
  let site: WritingSite = opts.site ?? "wide", seen = site;
  let clock = 0, step = 0, seenStep = 0; // clock kept modulo the period
  const built = new Map<WritingSite, Map<number, { solids: Solid[]; accents: Accent[] }>>();
  const at = () => {
    let poses = built.get(site);
    if (!poses) built.set(site, (poses = new Map()));
    let v = poses.get(step);
    if (!v) { v = { solids: [], accents: [] }; seaPlatformAt(v.solids, v.accents, site, step * HEAVE_STEP); poses.set(step, v); }
    return v;
  };
  const layers: Record<string, () => AnimLayer> = {
    [PLATFORM_LAYERS.solid]: () => ({ kind: "solid", solids: at().solids }),
    [PLATFORM_LAYERS.lights]: () => ({ kind: "accent", accents: at().accents, bloom: false }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("platformAnimator", layers),
    get site() { return site; },
    setSite(s) { site = s; },
    tick(dtMs) {
      if (!opts.reducedMotion && Number.isFinite(dtMs) && dtMs > 0) {
        clock = (clock + dtMs) % HEAVE.periodMs;
        step = Math.round(heaveAt(clock) / HEAVE_STEP);
      }
      if (site === seen && step === seenStep) return new Set<string>();
      seen = site; seenStep = step;
      return new Set(Object.keys(layers));
    },
  };
}
