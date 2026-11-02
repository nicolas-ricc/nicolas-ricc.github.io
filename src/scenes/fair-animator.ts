import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { FairScene } from "./fair";
import { createFairAnim } from "./fair-anim";

/** Adapts the fair to the `Animator` contract: wheel, train and gondola as animated solids; lights, neons and signs as accents. */
export function fairAnimator(scene: FairScene, opts: { reducedMotion: boolean }): Animator {
  const anim = createFairAnim(scene, opts);
  const layers: Record<string, () => AnimLayer> = {
    "fair.wheel": () => ({ kind: "solid", solids: anim.wheel() }),
    "fair.wheelLights": () => ({ kind: "accent", accents: anim.wheelLights() }),
    "fair.train": () => ({ kind: "solid", solids: anim.train() }),
    "fair.drop": () => ({ kind: "solid", solids: anim.drop() }),
    "fair.neon": () => ({ kind: "accent", accents: anim.neon() }),
    "fair.signs": () => ({ kind: "accent", accents: anim.signs() }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("fairAnimator", layers),
    tick(dtMs) { const c = anim.tick(dtMs), out = new Set<string>(); if (c.wheel) out.add("fair.wheel"); if (c.lights) out.add("fair.wheelLights"); if (c.train) out.add("fair.train"); if (c.drop) out.add("fair.drop"); if (c.neon) out.add("fair.neon"); if (c.signs) out.add("fair.signs"); return out; },
  };
}
