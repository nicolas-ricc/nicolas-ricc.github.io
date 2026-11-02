import type { Rng } from "../map/seed";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { Scene } from "./shipyard";
import { createShipyardAnim } from "./shipyard-anim";

/** Adapts the shipyard's animations to the `Animator` contract. Not the canal water: terrain.ts hands it out and water-animator.ts animates it. */
export function shipyardAnimator(scene: Scene, rng: Rng, opts: { reducedMotion: boolean }): Animator {
  const anim = createShipyardAnim(scene, rng, opts);
  const layers: Record<string, () => AnimLayer> = {
    trolley: () => ({ kind: "solid", solids: [scene.trolley] }),
    trolleyLamp: () => ({ kind: "accent", accents: [anim.trolleyLamp()] }),
    sparks: () => ({ kind: "accent", accents: anim.sparks() }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("shipyardAnimator", layers),
    tick(dtMs) {
      const c = anim.tick(dtMs);
      const out = new Set<string>();
      if (c.trolley) { out.add("trolley"); out.add("trolleyLamp"); }
      if (c.sparks) out.add("sparks");
      return out;
    },
  };
}
