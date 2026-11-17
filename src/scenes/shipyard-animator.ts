import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { Scene } from "./shipyard";
import { createShipyardAnim } from "./shipyard-anim";

/** Adapts the shipyard's animation to the `Animator` contract: one solid layer, the trolley (no accent layers since #403). Not the canal water: terrain.ts hands it out and water-animator.ts animates it. */
export function shipyardAnimator(scene: Scene, opts: { reducedMotion: boolean }): Animator {
  const anim = createShipyardAnim(scene, opts);
  const layers: Record<string, () => AnimLayer> = {
    trolley: () => ({ kind: "solid", solids: [scene.trolley] }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("shipyardAnimator", layers),
    tick(dtMs) {
      return anim.tick(dtMs).trolley ? new Set(["trolley"]) : new Set<string>();
    },
  };
}
