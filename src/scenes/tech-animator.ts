import type { Rng } from "../map/seed";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { TechScene } from "./tech";
import { createTechAnim } from "./tech-anim";

/** Adapta el distrito tecnológico al contrato `Animator`: cinco capas de acentos. */
export function techAnimator(scene: TechScene, rng: Rng, opts: { reducedMotion: boolean }): Animator {
  const anim = createTechAnim(scene, rng, opts);
  const layers: Record<string, () => AnimLayer> = {
    "tech.windows": () => ({ kind: "accent", accents: anim.windows() }),
    "tech.signs": () => ({ kind: "accent", accents: anim.signs() }),
    "tech.telecom": () => ({ kind: "accent", accents: [anim.telecom()] }),
    "tech.neon": () => ({ kind: "accent", accents: anim.neon() }),
    "tech.homes": () => ({ kind: "accent", accents: anim.homes() }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("techAnimator", layers),
    tick(dtMs) { const c = anim.tick(dtMs), out = new Set<string>(); for (const k of ["windows", "signs", "telecom", "neon", "homes"] as const) if (c[k]) out.add(`tech.${k}`); return out; },
  };
}
