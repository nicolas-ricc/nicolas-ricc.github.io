import type { Rng } from "../map/seed";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { FactoryScene } from "./factory";
import { createFactoryAnim } from "./factory-anim";

/** Adapta el humo de la fábrica al contrato `Animator`: una capa de sólidos por chimenea. */
export function factoryAnimator(scene: FactoryScene, rng: Rng, opts: { reducedMotion: boolean }): Animator {
  const anim = createFactoryAnim(scene.stacks, rng, opts);
  const ids = scene.stacks.map((_, k) => `factory.smoke${k}`);
  const layers: Record<string, () => AnimLayer> = Object.fromEntries(ids.map((id, k) => [id, () => ({ kind: "solid", solids: anim.puffs(k) })]));
  return {
    ids,
    layer: layerLookup("factoryAnimator", layers),
    tick: (dtMs) => new Set(anim.tick(dtMs) ? ids : []),
  };
}
