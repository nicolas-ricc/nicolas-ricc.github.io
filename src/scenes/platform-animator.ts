import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { seaPlatformAt, type WritingSite } from "./sign-platform";

/** Animator of the Writing platform: it can be moved between the two Writing sites. */
export interface PlatformAnimator extends Animator {
  readonly site: WritingSite;
  /** Moves the platform to `site`; the layers are reported at the next tick if the site differs from the one seen at the previous tick. */
  setSite(site: WritingSite): void;
}

/** The sea platform at `opts.site` (default `"wide"`). Each site is built once and reused. Both layers are reported after a site change, even with `dtMs` of 0 or NaN. */
export function platformAnimator(opts: { site?: WritingSite } = {}): PlatformAnimator {
  let site: WritingSite = opts.site ?? "wide", seen = site;
  const built = new Map<WritingSite, { solids: Solid[]; accents: Accent[] }>();
  const at = () => {
    let v = built.get(site);
    if (!v) { v = { solids: [], accents: [] }; seaPlatformAt(v.solids, v.accents, site); built.set(site, v); }
    return v;
  };
  const layers: Record<string, () => AnimLayer> = {
    "platform.solid": () => ({ kind: "solid", solids: at().solids }),
    "platform.lights": () => ({ kind: "accent", accents: at().accents }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("platformAnimator", layers),
    get site() { return site; },
    setSite(s) { site = s; },
    tick() {
      if (site === seen) return new Set<string>();
      seen = site;
      return new Set(Object.keys(layers));
    },
  };
}
