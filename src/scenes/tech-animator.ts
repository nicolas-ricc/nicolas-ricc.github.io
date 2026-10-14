import type { Rng } from "../map/seed";
import type { AnimLayer, Animator } from "./animator";
import type { TechScene } from "./tech";
import { createTechAnim } from "./tech-anim";

/** Adapta el distrito tecnológico al contrato `Animator`: cuatro capas de acentos. */
export function techAnimator(scene: TechScene, rng: Rng, opts: { reducedMotion: boolean }): Animator {
  const anim = createTechAnim(scene, rng, opts);
  const layers: Record<string, () => AnimLayer> = {
    "tech.windows": () => ({ kind: "accent", accents: anim.windows() }),
    "tech.signs": () => ({ kind: "accent", accents: anim.signs() }),
    "tech.telecom": () => ({ kind: "accent", accents: [anim.telecom()] }),
    "tech.neon": () => ({ kind: "accent", accents: anim.neon() }),
  };
  return {
    ids: Object.keys(layers),
    layer: (id) => layers[id]!(),
    tick(dtMs) { const c = anim.tick(dtMs), out = new Set<string>(); if (c.windows) out.add("tech.windows"); if (c.signs) out.add("tech.signs"); if (c.telecom) out.add("tech.telecom"); if (c.neon) out.add("tech.neon"); return out; },
  };
}
