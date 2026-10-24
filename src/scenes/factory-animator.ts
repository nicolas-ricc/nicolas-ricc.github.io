import type { Rng } from "../map/seed";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { FactoryScene } from "./factory";
import { createFactoryAnim } from "./factory-anim";

/** Adapta la fábrica al contrato `Animator`: una capa de sólidos por chimenea y la rueda de la excavadora. */
export function factoryAnimator(scene: FactoryScene, rng: Rng, opts: { reducedMotion: boolean }): Animator {
  const anim = createFactoryAnim(scene.stacks, rng, opts);
  const smoke = scene.stacks.map((_, k) => `factory.smoke${k}`), ids = [...smoke, "factory.wheel"];
  const layers: Record<string, () => AnimLayer> = { ...Object.fromEntries(smoke.map((id, k) => [id, () => ({ kind: "solid", solids: anim.puffs(k) })])), "factory.wheel": () => ({ kind: "solid", solids: anim.wheel() }) };
  return {
    ids,
    layer: layerLookup("factoryAnimator", layers),
    tick(dtMs) { const c = anim.tick(dtMs); return new Set([...(c.smoke ? smoke : []), ...(c.wheel ? ["factory.wheel"] : [])]); },
  };
}
