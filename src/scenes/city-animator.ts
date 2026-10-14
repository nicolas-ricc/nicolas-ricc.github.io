import type { Rng } from "../map/seed";
import type { AnimLayer, Animator } from "./animator";
import type { CityScene } from "./city";
import { createCityAnim } from "./city-anim";

/** Adapta las tres animaciones de la ciudad al contrato `Animator`. Todas son capas de acentos. */
export function cityAnimator(scene: CityScene, rng: Rng, opts: { reducedMotion: boolean }): Animator {
  const anim = createCityAnim(scene.tower, scene.neon, rng, opts);
  const layers: Record<string, () => AnimLayer> = {
    "city.lit": () => ({ kind: "accent", accents: anim.lit() }),
    "city.papers": () => ({ kind: "accent", accents: anim.papers() }),
    "city.antenna": () => ({ kind: "accent", accents: [anim.antenna()] }),
  };
  return {
    ids: Object.keys(layers),
    layer: (id) => layers[id]!(),
    tick(dtMs) {
      const c = anim.tick(dtMs);
      const out = new Set<string>();
      if (c.lit) out.add("city.lit");
      if (c.papers) out.add("city.papers");
      if (c.antenna) out.add("city.antenna");
      return out;
    },
  };
}
